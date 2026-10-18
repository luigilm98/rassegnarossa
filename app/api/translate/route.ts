import { chunkTranslationText, translateGoogleText } from "@/app/lib/translation";
export const dynamic = "force-dynamic";

type TranslationPayload = {
  text?: string;
  from?: string;
  to?: string;
};

const translationCache = new Map<
  string,
  { expiresAt: number; value: string }
>();
const TRANSLATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_CHARS = 2200;
const CHUNK_CHARS = 460;
let unavailableUntil = 0;
let googleUnavailableUntil = 0;

export async function POST(request: Request) {
  try {
    let payload: TranslationPayload;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (
      !payload ||
      typeof payload.text !== "string" ||
      (payload.from !== undefined && typeof payload.from !== "string") ||
      (payload.to !== undefined && typeof payload.to !== "string")
    )
      return Response.json(
        { error: "Invalid translation input" },
        { status: 400 },
      );
    const text = normalizeText(payload.text);
    if (text.length > MAX_TEXT_CHARS)
      return Response.json({ error: "Text too long" }, { status: 413 });
    const from = normalizeLanguage(payload.from ?? "auto");
    const to = normalizeLanguage(payload.to ?? "it");

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    if (
      !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(from) ||
      !/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(to)
    )
      return Response.json(
        { error: "An explicit source and target language are required" },
        { status: 400 },
      );

    if (from === to) {
      return Response.json({ translatedText: text, provider: "identity" });
    }

    const cacheKey = `${from}:${to}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Response.json({
        translatedText: cached.value,
        provider: "cache",
      });
    }

    let translatedText: string;
    let provider = "google-web";
    try {
      if (Date.now() < googleUnavailableUntil) throw new Error("Google rate limited");
      translatedText = await translateGoogleText(text, from, to);
    } catch (error) {
      if ((error as { status?: number })?.status === 429) googleUnavailableUntil = Date.now() + 60_000;
      // MyMemory's quota must never prevent another provider from succeeding.
      if (Date.now() < unavailableUntil)
        return Response.json({ error: "Translation temporarily unavailable" }, { status: 503 });
      const chunks = chunkTranslationText(text, CHUNK_CHARS);
      const translatedChunks = [];
      for (const chunk of chunks) translatedChunks.push(await translateChunk(chunk, from, to));
      translatedText = translatedChunks.join(["zh", "ja"].includes(to.split("-")[0]) ? "" : " ").replace(/\s+/g, " ").trim();
      provider = "mymemory";
    }

    if (translationCache.size >= 2048)
      translationCache.delete(translationCache.keys().next().value!);
    translationCache.set(cacheKey, {
      expiresAt: Date.now() + TRANSLATION_TTL_MS,
      value: translatedText,
    });

    return Response.json({ translatedText, provider });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Translation service unavailable",
      },
      { status: 502 },
    );
  }
}

async function translateChunk(text: string, from: string, to: string) {
  const langpair = `${from}|${to}`;
  const endpoint = new URL("https://api.mymemory.translated.net/get");
  endpoint.searchParams.set("q", text);
  endpoint.searchParams.set("langpair", langpair);

  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent": "InternazionaleRSS/1.0",
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Translation HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    responseStatus?: number | string;
    quotaFinished?: boolean;
    responseData?: { translatedText?: string };
    matches?: { translation?: string; quality?: string }[];
  };

  if (Number(data.responseStatus ?? 200) !== 200 || data.quotaFinished) {
    unavailableUntil = Date.now() + 60_000;
    throw new Error("Translation provider limit or error");
  }

  const translated = data.responseData?.translatedText?.trim();
  if (translated) {
    return decodeEntities(translated);
  }

  const fallback = data.matches?.find(
    (match) => match.translation,
  )?.translation;
  if (fallback) {
    return decodeEntities(fallback);
  }

  throw new Error("Translation response was empty");
}

function normalizeText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLanguage(language: string) {
  const lower = language.toLowerCase();
  const map: Record<string, string> = {
    "pt-br": "pt",
    "pt-pt": "pt",
    "es-419": "es",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
    auto: "auto",
  };
  return map[lower] ?? lower.split("-")[0] ?? "en";
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
