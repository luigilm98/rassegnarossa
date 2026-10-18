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
