/** Canonical provider language: regional editions of the same language need no translation. */
export function normalizeLanguage(language: string): string {
  const lower = language.trim().replace(/_/g, "-").toLowerCase();
  const chinese: Record<string, string> = {
    zh: "zh", "zh-cn": "zh", "zh-sg": "zh", "zh-hans": "zh",
    "zh-tw": "zh-TW", "zh-hk": "zh-TW", "zh-mo": "zh-TW", "zh-hant": "zh-TW",
  };
  return chinese[lower] ?? lower.split("-")[0];
}

/** MyMemory accepts public, credential-free CORS requests. */
export function chunkTranslationText(text: string, maxBytes = 460): string[] {
  const chunks: string[] = [];
  const encoder = new TextEncoder();
  let current = "";
  for (const word of text.match(/\S+\s*/gu) ?? []) {
    if (encoder.encode(current + word).length <= maxBytes) {
      current += word;
      continue;
    }
    if (current) {
      chunks.push(current.trim());
      current = "";
    }
    for (const char of word) {
      if (encoder.encode(current + char).length > maxBytes) {
        chunks.push(current.trim());
        current = "";
      }
      current += char;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
export async function translatePublicText(
  text: string,
  from: string,
  to: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  from = normalizeLanguage(from);
  to = normalizeLanguage(to);
  if (
    text.length > 2200 ||
    !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(from) ||
    !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(to)
  )
    throw new Error("Invalid translation input");
  if (from === to) return text;
  const signal = AbortSignal.timeout(12000);
  const translated: string[] = [];
  for (const chunk of chunkTranslationText(text)) {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", chunk);
    url.searchParams.set("langpair", `${from}|${to}`);
    const response = await fetcher(url.href, {
      signal,
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("Translation unavailable");
    const data = await response.json();
    if (
      Number(data.responseStatus ?? 200) !== 200 ||
      data.quotaFinished ||
      typeof data.responseData?.translatedText !== "string" ||
      !data.responseData.translatedText.trim()
    )
      throw new Error("Translation unavailable");
    // React renders this as text; publisher markup is never interpreted.
    translated.push(
      data.responseData.translatedText
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    );
  }
  return translated
    .join(["zh", "ja"].includes(to.split("-")[0]) ? "" : " ")
    .trim();
}

/** Public Google Translate web endpoint; not the authenticated Cloud Translation API. */
export async function translateGoogleText(
  text: string,
  from: string,
  to: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  from = normalizeLanguage(from);
  to = normalizeLanguage(to);
  if (text.length > 2200 || !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(from) || !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(to))
    throw new Error("Invalid translation input");
  if (from === to) return text;
  const signal = AbortSignal.timeout(8000);
  const translated: string[] = [];
  for (const chunk of chunkTranslationText(text, 1600)) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", from);
    url.searchParams.set("tl", to);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", chunk);
    const response = await fetcher(url.href, { signal, mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", headers: { accept: "application/json" } });
    if (!response.ok) throw Object.assign(new Error("Translation unavailable"), { status: response.status });
    const data: unknown = await response.json();
    if (!Array.isArray(data) || !Array.isArray(data[0]) || !data[0].length)
      throw new Error("Invalid translation response");
    const parts: string[] = [];
    for (const segment of data[0]) {
      if (!Array.isArray(segment) || typeof segment[0] !== "string") throw new Error("Invalid translation segment");
      parts.push(segment[0]);
    }
    const value = parts.join("").trim();
    if (!value) throw new Error("Empty translation");
    translated.push(value);
  }
  return translated.join(["zh", "ja"].includes(to.split("-")[0]) ? "" : " ").trim();
}

/** A failed provider does not make public text untranslatable by another provider. */
export async function translateAvailableText(text: string, from: string, to: string, fetcher: typeof fetch = fetch): Promise<string> {
  try { return await translateGoogleText(text, from, to, fetcher); }
  catch { return translatePublicText(text, from, to, fetcher); }
}
