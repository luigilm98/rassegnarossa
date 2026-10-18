"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { restoreSavedArticles, type ReadingArticle } from "@/app/lib/reading";
import type { BookmarkMutation } from "@/app/lib/bookmarks";
export type RestoredCollection = { articles: ReadingArticle[]; books: string[]; removed: { kind: string; key: string }[]; replace: boolean };
type Options = { ready: boolean; articles: ReadingArticle[]; books: string[]; onRestore: (value: RestoredCollection) => void };
const OUTBOX = "rassegna-rossa.cloud-outbox:";
const ACCOUNT = "rassegna-rossa.saved-account";
export function useCloudBookmarks(options: Options) {
  const latest = useRef(options); latest.current = options;
  const scope = useRef("");
  const authenticated = useRef(false);
  const known = useRef(new Set<string>());
  const outbox = useRef(new Map<string, BookmarkMutation>());
  const inflight = useRef(false);
  const acknowledged = useRef(new Map<string, { mutation: BookmarkMutation; updatedAt: number }>());
  const [account, setAccount] = useState(false);
  const [status, setStatus] = useState<"checking" | "local" | "syncing" | "synced" | "error">("checking");
  const [tick, setTick] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, setPending] = useState(0);
  const [signInUrl, setSignInUrl] = useState("/signin-with-chatgpt?return_to=%2F%3Fview%3Dsalvati");
  const persist = useCallback(() => {
    setPending(outbox.current.size);
    try { localStorage.setItem(OUTBOX + scope.current, JSON.stringify({ scope: scope.current, changes: [...outbox.current.values()] })); } catch { /* Server copies remain authoritative. */ }
  }, []);
  const change = useCallback((mutation: BookmarkMutation) => {
    if (!authenticated.current) {
      try { localStorage.removeItem(ACCOUNT); } catch { /* Optional cache. */ }
      return;
    }
    const key = `${mutation.kind}:${mutation.key}`;
    outbox.current.set(key, mutation); known.current.add(key);
    persist(); setStatus("syncing"); setTick(value => value + 1);
  }, [persist]);
  useEffect(() => {
    if (!options.ready) return;
    let active = true;
    const controller = new AbortController();
    let requestVersion = 0;
    const load = async () => {
      const currentVersion = ++requestVersion;
      try {
        const response = await fetch("/api/bookmarks", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
        const data = await response.json();
        if (response.ok && data.authenticated && Array.isArray(data.items)) {
          let offset = data.nextOffset;
          while (typeof offset === "number") {
            const pageResponse = await fetch(`/api/bookmarks?offset=${offset}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
            const page = await pageResponse.json();
            if (!pageResponse.ok || page.scope !== data.scope || !Array.isArray(page.items)) throw new Error("Archive unavailable");
            data.items.push(...page.items); offset = page.nextOffset;
          }
        }
        if (!active || currentVersion !== requestVersion) return;
        if (response.status === 401) {
          authenticated.current = false; setAccount(false); setStatus("local");
          if (typeof data.signInUrl === "string" && data.signInUrl.startsWith("/signin-with-chatgpt?")) setSignInUrl(data.signInUrl);
          try { if (localStorage.getItem(ACCOUNT)) latest.current.onRestore({ articles: [], books: [], removed: [], replace: true }); } catch { /* Optional cache. */ }
          return;
        }
        if (!response.ok || !data.authenticated || typeof data.scope !== "string" || !Array.isArray(data.items)) throw new Error("Cloud unavailable");
        const firstLoad = !authenticated.current || scope.current !== data.scope;
        let previousScope: string | null = null;
        try { previousScope = localStorage.getItem(ACCOUNT); } catch { /* Optional cache. */ }
        const switched = Boolean(previousScope && previousScope !== data.scope);
        if (firstLoad) {
          outbox.current.clear();
          acknowledged.current.clear();
          try {
            const saved = JSON.parse(localStorage.getItem(OUTBOX + data.scope) ?? "null");
            if (saved?.scope === data.scope && Array.isArray(saved.changes))
              for (const item of saved.changes) if (["article", "book"].includes(item?.kind) && typeof item.key === "string" && typeof item.deleted === "boolean") outbox.current.set(`${item.kind}:${item.key}`, item);
          } catch { /* Invalid cached work must not affect server data. */ }
        }
        scope.current = data.scope; authenticated.current = true;
        known.current = new Set(data.items.map((item: { kind: string; key: string }) => `${item.kind}:${item.key}`));
        const merged = new Map<string, BookmarkMutation>(data.items.map((item: BookmarkMutation) => [`${item.kind}:${item.key}`, item]));
        const serverVersions = new Map<string, number>(data.items.map((item: { kind: string; key: string; updatedAt: number }) => [`${item.kind}:${item.key}`, item.updatedAt]));
        for (const [key, ack] of acknowledged.current) {
          if ((serverVersions.get(key) ?? -1) < ack.updatedAt) merged.set(key, ack.mutation);
          else acknowledged.current.delete(key);
        }
        for (const [key, item] of outbox.current) { merged.set(key, item); known.current.add(key); }
        let localArticles = switched ? [] : latest.current.articles;
        let localBooks = switched ? [] : latest.current.books;
        if (firstLoad && previousScope === data.scope) {
          try {
            localArticles = restoreSavedArticles(localStorage.getItem("rassegna-rossa.saved-articles"));
            const values = JSON.parse(localStorage.getItem("rassegna-rossa.saved-books") ?? "[]");
            if (Array.isArray(values)) localBooks = values.filter((value): value is string => typeof value === "string");
          } catch { /* The private cloud copy can restore without a local cache. */ }
        }
        for (const article of localArticles) if (!merged.has(`article:${article.id}`)) merged.set(`article:${article.id}`, { kind: "article", key: article.id, deleted: false, article });
        for (const id of localBooks) if (!merged.has(`book:${id}`)) merged.set(`book:${id}`, { kind: "book", key: id, deleted: false });
        const values = [...merged.values()];
        latest.current.onRestore({
          articles: restoreSavedArticles(JSON.stringify(values.filter(item => item.kind === "article" && !item.deleted).map(item => item.article))),
          books: values.filter(item => item.kind === "book" && !item.deleted).map(item => item.key),
          removed: values.filter(item => item.deleted).map(item => ({ kind: item.kind, key: item.key })), replace: switched,
        });
        try { localStorage.setItem(ACCOUNT, data.scope); } catch { /* Cloud data does not depend on browser storage. */ }
        setAccount(true); setStatus(outbox.current.size || values.some(item => !item.deleted && !known.current.has(`${item.kind}:${item.key}`)) ? "syncing" : "synced"); persist(); setTick(value => value + 1);
      } catch { if (active && currentVersion === requestVersion) setStatus("error"); }
    };
    void load();
    const timer = setInterval(() => { if (authenticated.current && document.visibilityState === "visible") void load(); }, 60_000);
    const resume = () => { void load(); };
    window.addEventListener("online", resume); window.addEventListener("focus", resume);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); };
  }, [options.ready, persist, reloadKey]);
  useEffect(() => {
    if (!account || !options.ready) return;
    for (const article of options.articles)
      if (!known.current.has(`article:${article.id}`)) change({ kind: "article", key: article.id, article, deleted: false });
    for (const key of options.books)
      if (!known.current.has(`book:${key}`)) change({ kind: "book", key, deleted: false });
  }, [account, options.ready, options.articles, options.books, change]);
  useEffect(() => {
    if (!account || !outbox.current.size) return;
    const timer = setTimeout(() => {
      if (inflight.current || !authenticated.current) return;
      inflight.current = true;
      const operationScope = scope.current;
      void (async () => {
        try {
          while (outbox.current.size && authenticated.current && scope.current === operationScope) {
            const batch: [string, BookmarkMutation][] = [];
            for (const entry of outbox.current.entries()) {
              if (batch.length >= 20 || (batch.length > 0 && new TextEncoder().encode(JSON.stringify({ changes: [...batch, entry].map(([, value]) => value) })).length > 100_000)) break;
              batch.push(entry);
            }
            const response = await fetch("/api/bookmarks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes: batch.map(([, value]) => value) }), signal: AbortSignal.timeout(10000) });
            if (response.status === 401) setReloadKey(value => value + 1);
            if (!response.ok) throw new Error("Save unavailable");
            if (scope.current !== operationScope) return;
            const result = await response.json();
            for (const [key, mutation] of batch) if (outbox.current.get(key) === mutation) {
              acknowledged.current.set(key, { mutation, updatedAt: Number(result.updatedAt) || Date.now() });
              outbox.current.delete(key);
            }
            persist();
          }
          if (scope.current === operationScope && authenticated.current) setStatus("synced");
        } catch { if (scope.current === operationScope && authenticated.current) setStatus("error"); }
        finally { inflight.current = false; if (scope.current !== operationScope && authenticated.current && outbox.current.size) setTick(value => value + 1); }
      })();
    }, 300);
    return () => { clearTimeout(timer); };
  }, [account, tick, persist]);
  return { account, status, pending, signInUrl, change, retry: () => { setTick(value => value + 1); setReloadKey(value => value + 1); } };
}
