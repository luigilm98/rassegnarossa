export const dynamic = "force-dynamic";

type TranslationPayload = {
  text?: string;
  from?: string;
  to?: string;
};

const translationCache = new Map<string, { expiresAt: number; value: string }>();
const TRANSLATION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_CHARS = 2200;
const CHUNK_CHARS = 460;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TranslationPayload;
    const text = normalizeText(payload.text ?? "").slice(0, MAX_TEXT_CHARS);
    const from = normalizeLanguage(payload.from ?? "auto");
    const to = normalizeLanguage(payload.to ?? "it");

    if (!text) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

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

    const chunks = chunkText(text, CHUNK_CHARS);
    const translatedChunks = [];
    for (const chunk of chunks) {
      translatedChunks.push(await translateChunk(chunk, from, to));
    }
    const translatedText = translatedChunks.join(" ").replace(/\s+/g, " ").trim();

    translationCache.set(cacheKey, {
      expiresAt: Date.now() + TRANSLATION_TTL_MS,
      value: translatedText,
    });

    return Response.json({ translatedText, provider: "mymemory" });
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
  const langpair = `${from === "auto" ? "en" : from}|${to}`;
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
    responseData?: { translatedText?: string };
    matches?: { translation?: string; quality?: string }[];
  };

  const translated = data.responseData?.translatedText?.trim();
  if (translated) {
    return decodeEntities(translated);
  }

  const fallback = data.matches?.find((match) => match.translation)?.translation;
  if (fallback) {
    return decodeEntities(fallback);
  }

  throw new Error("Translation response was empty");
}

function normalizeText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

function chunkText(text: string, maxLength: number) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (`${current} ${sentence}`.trim().length > maxLength && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) {
      return [chunk];
    }
    const pieces: string[] = [];
    for (let index = 0; index < chunk.length; index += maxLength) {
      pieces.push(chunk.slice(index, index + maxLength));
    }
    return pieces;
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
