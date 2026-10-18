import { restoreSavedArticles } from "./reading";
export type BookmarkMutation = { kind: "article" | "book"; key: string; deleted: boolean; article?: unknown };
export type BookmarkRow = { kind: "article" | "book"; item_key: string; payload: string; deleted: number; updated_at: number };
export type BookmarkStatement = { bind(...values: unknown[]): BookmarkStatement; all(): Promise<{ results: BookmarkRow[] }>; run(): Promise<unknown> };
export type BookmarkDatabase = { prepare(sql: string): BookmarkStatement; batch(statements: BookmarkStatement[]): Promise<unknown> };

export async function handleBookmarks(request: Request, db: BookmarkDatabase | undefined, userId: string | null, bookIds: Set<string>, signInUrl = "/signin-with-chatgpt?return_to=%2F%3Fview%3Dsalvati"): Promise<Response> {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "private, no-store", "vary": "cookie" } });
  if (!userId) return reply({ authenticated: false, signInUrl }, 401);
  if (!db) return reply({ authenticated: true, error: "Archivio temporaneamente non disponibile" }, 503);
  if (request.method === "GET") {
    try {
      const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0) return reply({ error: "Invalid page" }, 400);
      const rows = await db.prepare("SELECT kind, item_key, payload, deleted, updated_at FROM bookmarks WHERE owner_id = ? ORDER BY kind, item_key LIMIT 501 OFFSET ?").bind(userId, offset).all();
      const more = rows.results.length > 500;
      const scope = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId)))].map(value => value.toString(16).padStart(2, "0")).join("");
      return reply({ authenticated: true, scope, nextOffset: more ? offset + 500 : null, items: rows.results.slice(0, 500).map(row => ({ kind: row.kind, key: row.item_key, deleted: Boolean(row.deleted), updatedAt: row.updated_at, article: row.kind === "article" && !row.deleted ? restoreSavedArticles(`[${row.payload}]`)[0] ?? null : undefined })) });
    } catch { return reply({ authenticated: true, error: "Archivio temporaneamente non disponibile" }, 503); }
  }
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Invalid origin" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "JSON required" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Invalid input" }, 400);
  let bytes = 0, raw = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 128_000) { await reader.cancel(); return reply({ error: "Payload too large" }, 413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally { reader.releaseLock(); }
  let data: { changes?: unknown };
  try { data = JSON.parse(raw); } catch { return reply({ error: "Invalid JSON" }, 400); }
  if (!data || !Array.isArray(data.changes) || !data.changes.length || data.changes.length > 25) return reply({ error: "Invalid changes" }, 400);
  const changes: { kind: string; key: string; payload: string; deleted: boolean }[] = [];
  for (const change of data.changes) {
    if (!change || !["article", "book"].includes(change.kind) || typeof change.key !== "string" || !change.key || change.key.length > 300 || typeof change.deleted !== "boolean") return reply({ error: "Invalid bookmark" }, 400);
    let payload = "null";
    if (change.kind === "book" && !bookIds.has(change.key)) return reply({ error: "Unknown book" }, 400);
    if (change.kind === "article" && !change.deleted) {
      const article = restoreSavedArticles(JSON.stringify([change.article]))[0];
      if (!article || article.id !== change.key || JSON.stringify(article).length > 10_000) return reply({ error: "Invalid article" }, 400);
      payload = JSON.stringify(article);
    }
    changes.push({ kind: change.kind, key: change.key, payload, deleted: change.deleted });
  }
  try {
    const now = Date.now();
    await db.batch(changes.map(change => db.prepare("INSERT INTO bookmarks (owner_id, kind, item_key, payload, deleted, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, kind, item_key) DO UPDATE SET payload = excluded.payload, deleted = excluded.deleted, updated_at = excluded.updated_at").bind(userId, change.kind, change.key, change.payload, Number(change.deleted), now)));
    return reply({ ok: true, saved: changes.length, updatedAt: now });
  } catch { return reply({ error: "Salvataggio non riuscito" }, 503); }
}
