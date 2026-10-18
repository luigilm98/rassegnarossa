/** Image requests are resolved from a configured source and a server-known article ID, never a visitor URL. */
export function publicPhotoUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol === "http:") url.protocol = "https:";
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !/[a-z]/i.test(host) || !host.includes(".") || /[\[\]:]/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|onion)$/.test(host) || /^(?:0x[\da-f]+|\d+)\./i.test(host)) return null;
    return url;
  } catch { return null; }
}
export async function readLimited(response: Response, maxBytes: number, truncate = false): Promise<Uint8Array> {
  if (!truncate && Number(response.headers.get("content-length")) > maxBytes) { await response.body?.cancel(); throw new Error("Photo response too large"); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty photo response");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      if (length + value.length > maxBytes) {
        if (!truncate) throw new Error("Photo response too large");
        chunks.push(value.subarray(0, maxBytes - length)); length = maxBytes; break;
      }
      length += value.length; chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function fetchPublicPhotoResource(url: URL, signal: AbortSignal, headers: Record<string, string>, fetcher: typeof fetch = fetch, requiredHost?: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    if (!publicPhotoUrl(current.href) || (requiredHost && current.hostname.replace(/^www\./, "") !== requiredHost)) throw new Error("Unsupported photo destination");
    const response = await fetcher(current.href, { signal, headers, redirect: "manual", credentials: "omit" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location"); await response.body?.cancel();
    const next = location && publicPhotoUrl(new URL(location, current).href);
    if (!next) throw new Error("Unsafe photo redirect"); current = next;
  }
  throw new Error("Too many photo redirects");
}
const decode = (text: string) => text.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
export function articleMetadataImages(html: string, articleUrl: string): string[] {
  const images: string[] = [];
  for (const match of html.slice(0, 300000).replace(/<!--[^]*?-->/g, "").replace(/<(script|style|template)\b[^>]*>[^]*?<\/\1\s*>/gi, "").matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3]);
    if (!/^(?:og:image(?::(?:url|secure_url))?|twitter:image(?::src)?)$/i.test(attrs.property ?? attrs.name ?? "")) continue;
    try {
      const image = publicPhotoUrl(new URL(attrs.content, articleUrl).href);
      if (image && !/(?:^|[\/_-])(?:logo|favicon|placeholder)(?:[\/_\-.]|$)/i.test(image.pathname)) images.push(image.href);
    } catch { /* Invalid metadata is not an image. */ }
  }
  return [...new Set(images)].slice(0, 4);
}
