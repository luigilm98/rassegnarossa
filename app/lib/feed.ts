import {
  SOURCE_CATALOG,
  TOPIC_TAXONOMY,
  type SourceDefinition,
} from "@/app/data/catalog";

export type ArticleRecord = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceHomepage: string;
  region: SourceDefinition["region"];
  country: string;
  language: string;
  kind: SourceDefinition["kind"];
  ideologies: string[];
  title: string;
  link: string;
  publishedAt: string | null;
  author: string | null;
  excerpt: string;
  categories: string[];
  topics: string[];
  image: string | null;
  score: number;
};

export type SourceStatus = {
  sourceId: string;
  name: string;
  ok: boolean;
  count: number;
  feedUrl: string | null;
  error: string | null;
  fetchedAt: string;
  cached: boolean;
};

export type SourceFetchResult = {
  source: SourceDefinition;
  articles: ArticleRecord[];
  status: SourceStatus;
};

type CacheEntry = {
  expiresAt: number;
  result: SourceFetchResult;
};

const feedCache = new Map<string, CacheEntry>();
const discoveryCache = new Map<string, { expiresAt: number; urls: string[] }>();

const FEED_TTL_MS = 10 * 60 * 1000;
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const MAX_FEED_CHARS = 1_800_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) RassegnaRossa/1.0";

export function getSources(ids?: string[]) {
  if (!ids?.length) {
    return SOURCE_CATALOG;
  }
  const wanted = new Set(ids);
  return SOURCE_CATALOG.filter((source) => wanted.has(source.id));
}

export async function fetchSource(
  source: SourceDefinition,
  limit = 10,
): Promise<SourceFetchResult> {
  const cacheKey = `${source.id}:${limit}`;
  const cached = feedCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return {
      ...cached.result,
      status: { ...cached.result.status, cached: true },
    };
  }

  const candidates = await getFeedCandidates(source);
  let lastError = "No feed candidates";
  let feedShapeError: string | null = null;

  for (const candidate of candidates) {
    try {
      const xml = await fetchText(candidate);
      if (!looksLikeFeed(xml)) {
        lastError = "Response was not RSS or Atom";
        continue;
      }

      const articles = parseFeed(xml, source, candidate)
        .slice(0, Math.max(1, limit))
        .map((article) => ({
          ...article,
          score: computeArticleScore(article, source),
        }));

      if (!articles.length) {
        feedShapeError = "Feed contained no readable items";
        continue;
      }

      const result: SourceFetchResult = {
        source,
        articles,
        status: {
          sourceId: source.id,
          name: source.name,
          ok: true,
          count: articles.length,
          feedUrl: candidate,
          error: null,
          fetchedAt: new Date().toISOString(),
          cached: false,
        },
      };

      feedCache.set(cacheKey, { expiresAt: now + FEED_TTL_MS, result });
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown feed error";
    }
  }

  const result: SourceFetchResult = {
    source,
    articles: [],
    status: {
      sourceId: source.id,
      name: source.name,
      ok: false,
      count: 0,
      feedUrl: candidates[0] ?? null,
      error: feedShapeError ?? lastError,
      fetchedAt: new Date().toISOString(),
      cached: false,
    },
  };
  feedCache.set(cacheKey, { expiresAt: now + FEED_TTL_MS / 2, result });
  return result;
}

async function getFeedCandidates(source: SourceDefinition) {
  const declared = source.feedUrls ?? [];
  const discovered = await discoverFeedUrls(source.homepage);
  const guessed = guessCommonFeedUrls(source.homepage);
  const unique = [...declared, ...discovered, ...guessed]
    .map((url) => normalizeUrl(url, source.homepage))
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(unique));
}

async function discoverFeedUrls(homepage: string) {
  const cached = discoveryCache.get(homepage);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.urls;
  }

  try {
    const html = await fetchText(homepage, 600_000);
    const links = Array.from(html.matchAll(/<link\b[^>]*>/gi))
      .map((match) => match[0])
      .filter((tag) => /alternate/i.test(tag) && /(rss|atom)\+xml/i.test(tag))
      .map((tag) => getAttribute(tag, "href"))
      .filter((url): url is string => Boolean(url))
      .map((url) => normalizeUrl(url, homepage))
      .filter((url): url is string => Boolean(url));

    const urls = Array.from(new Set(links));
    discoveryCache.set(homepage, {
      expiresAt: Date.now() + DISCOVERY_TTL_MS,
      urls,
    });
    return urls;
  } catch {
    discoveryCache.set(homepage, {
      expiresAt: Date.now() + DISCOVERY_TTL_MS / 4,
      urls: [],
    });
    return [];
  }
}

function guessCommonFeedUrls(homepage: string) {
  try {
    const url = new URL(homepage);
    const basePath = url.pathname.endsWith("/")
      ? url.pathname
      : `${url.pathname}/`;
    const origin = url.origin;
    const scoped = new URL("feed/", `${origin}${basePath}`).toString();

    return [
      scoped,
      `${origin}/feed/`,
      `${origin}/rss`,
      `${origin}/rss.xml`,
      `${origin}/atom.xml`,
      `${origin}/index.xml`,
      `${origin}/?feed=rss2`,
    ];
  } catch {
    return [];
  }
}

function normalizeUrl(url: string, base?: string) {
  try {
    const parsed = new URL(decodeXml(url), base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchText(url: string, maxChars = MAX_FEED_CHARS) {
  const response = await fetch(url, {
    headers: {
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await response.arrayBuffer();
  const text = decodeResponseText(buffer, contentType);
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function decodeResponseText(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  const charset =
    contentType.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase() ?? "";
  const shouldDecodeUtf16 =
    charset.includes("utf-16") ||
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes[0] === 0xfe && bytes[1] === 0xff);

  if (shouldDecodeUtf16) {
    const littleEndian =
      charset.includes("le") ||
      bytes[0] === 0xff ||
      (bytes[0] !== 0xfe && bytes[1] !== 0xff);
    const start = bytes[0] === 0xff || bytes[0] === 0xfe ? 2 : 0;
    let output = "";
    for (let index = start; index + 1 < bytes.length; index += 2) {
      const code = littleEndian
        ? bytes[index] | (bytes[index + 1] << 8)
        : (bytes[index] << 8) | bytes[index + 1];
      output += String.fromCharCode(code);
    }
    return output;
  }

  const label =
    charset.includes("utf-16")
      ? charset.includes("be")
        ? "utf-16be"
        : "utf-16le"
      : bytes[0] === 0xff && bytes[1] === 0xfe
        ? "utf-16le"
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? "utf-16be"
          : "utf-8";

  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function looksLikeFeed(text: string) {
  return /<(rss|feed|rdf:RDF)\b/i.test(text) || /<(item|entry)\b/i.test(text);
}

function parseFeed(
  xml: string,
  source: SourceDefinition,
  feedUrl: string,
): ArticleRecord[] {
  const blockType = /<entry\b/i.test(xml) ? "entry" : "item";
  const blocks = Array.from(
    xml.matchAll(new RegExp(`<${blockType}\\b[\\s\\S]*?<\\/${blockType}>`, "gi")),
  ).map((match) => match[0]);

  return blocks
    .map((block) => parseItemBlock(block, source, feedUrl, blockType))
    .filter((article): article is ArticleRecord => Boolean(article));
}

function parseItemBlock(
  block: string,
  source: SourceDefinition,
  feedUrl: string,
  blockType: "entry" | "item",
): ArticleRecord | null {
  const rawTitle = cleanText(extractTag(block, ["title"]) ?? "");
  const rawLink =
    blockType === "entry"
      ? extractAtomLink(block) ?? extractTag(block, ["link"])
      : extractTag(block, ["link"]) ?? extractAtomLink(block);
  const link = normalizeUrl(rawLink ?? "", feedUrl);
  const detectedSource =
    source.kind === "radar" ? extractItemSource(block, feedUrl) : null;
  const articleSourceName = detectedSource?.name ?? source.name;
  const articleSourceHomepage = detectedSource?.url ?? source.homepage;
  const articleSourceId = detectedSource
    ? `radar:${stableHash(detectedSource.key).slice(1)}`
    : source.id;
  const title = detectedSource
    ? stripSourceSuffix(rawTitle, detectedSource.name)
    : rawTitle;

  if (!title || !link) {
    return null;
  }

  const rawContent =
    extractTag(block, ["content:encoded", "content", "summary", "description"]) ??
    "";
  const excerpt = clampText(cleanText(rawContent), 520);
  const published =
    parseDate(
      extractTag(block, ["pubDate", "published", "updated", "dc:date"]) ?? "",
    ) ?? null;
  const categories = extractTags(block, "category")
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 8);
  const author =
    cleanText(
      extractTag(block, ["dc:creator", "author", "name", "creator"]) ?? "",
    ) || null;
  const image = extractImage(block, feedUrl);
  const articleText = `${title} ${excerpt} ${categories.join(" ")} ${source.tags.join(
    " ",
  )}`;
  const topics = classifyTopics(
    articleText,
  );
  const ideologies = inferIdeologies(articleText, source.ideologies);
  const idSeed =
    extractTag(block, ["guid", "id"]) ?? `${source.id}:${link}:${title}`;

  return {
    id: stableHash(`${articleSourceId}:${idSeed}:${link}`),
    sourceId: articleSourceId,
    sourceName: articleSourceName,
    sourceHomepage: articleSourceHomepage,
    region: source.region,
    country: source.country,
    language: source.language,
    kind: source.kind,
    ideologies,
    title,
    link,
    publishedAt: published,
    author,
    excerpt,
    categories,
    topics,
    image,
    score: 0,
  };
}

function extractItemSource(block: string, feedUrl: string) {
  const tag = block.match(/<source\b[^>]*>[\s\S]*?<\/source>/i)?.[0] ?? null;
  if (!tag) {
    return null;
  }

  const label =
    cleanText(tag.replace(/^<source\b[^>]*>/i, "").replace(/<\/source>$/i, "")) ||
    "Fonte radar";
  const rawUrl = getAttribute(tag, "url");
  const url = rawUrl ? normalizeUrl(rawUrl, feedUrl) : null;
  const key = sourceIdentity(url, label);

  return {
    name: label,
    url: url ?? `https://${key}/`,
    key,
  };
}

function sourceIdentity(url: string | null, label: string) {
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // Fall through to the readable label.
    }
  }
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || stableHash(label).slice(1);
}

function stripSourceSuffix(title: string, sourceName: string) {
  const suffix = ` - ${sourceName}`.toLowerCase();
  return title.toLowerCase().endsWith(suffix)
    ? title.slice(0, -suffix.length).trim()
    : title;
}

function extractTag(block: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = block.match(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
    );
    if (match?.[1]) {
      return decodeXml(stripCdata(match[1]).trim());
    }
  }
  return null;
}

function extractTags(block: string, name: string) {
  const escaped = escapeRegExp(name);
  return Array.from(
    block.matchAll(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi"),
    ),
  ).map((match) => decodeXml(stripCdata(match[1] ?? "").trim()));
}

function extractAtomLink(block: string) {
  const linkTags = Array.from(block.matchAll(/<link\b[^>]*>/gi)).map(
    (match) => match[0],
  );
  const alternate =
    linkTags.find((tag) => /rel=["']alternate["']/i.test(tag)) ?? linkTags[0];
  return alternate ? getAttribute(alternate, "href") : null;
}

function extractImage(block: string, feedUrl: string) {
  const enclosure = Array.from(block.matchAll(/<enclosure\b[^>]*>/gi))
    .map((match) => match[0])
    .find((tag) => /image\//i.test(getAttribute(tag, "type") ?? ""));
  const media =
    block.match(/<(media:thumbnail|media:content)\b[^>]*>/i)?.[0] ?? null;
  const htmlImg = block.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1] ?? null;
  const raw =
    (enclosure && getAttribute(enclosure, "url")) ??
    (media && getAttribute(media, "url")) ??
    htmlImg;
  return raw ? normalizeUrl(raw, feedUrl) : null;
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${escapeRegExp(name)}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeXml(match[1]) : null;
}

function parseDate(value: string) {
  const time = Date.parse(cleanText(value));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function classifyTopics(text: string) {
  const haystack = text.toLowerCase();
  return TOPIC_TAXONOMY.filter((topic) =>
    topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  ).map((topic) => topic.id);
}

function inferIdeologies(text: string, baseIdeologies: string[]) {
  const haystack = text.toLowerCase();
  const inferred = IDEOLOGY_RULES.filter((rule) =>
    rule.needles.some((needle) => haystack.includes(needle)),
  ).map((rule) => rule.id);

  return Array.from(new Set([...baseIdeologies, ...inferred]));
}

const IDEOLOGY_RULES = [
  {
    id: "comunista",
    needles: [
      "communism",
      "communist",
      "comunismo",
      "comunista",
      "communisme",
      "kommunismus",
      "коммунизм",
      "共产主义",
      "共産主義",
      "공산주의",
      "komunizm",
      "شيوعية",
    ],
  },
  {
    id: "socialista",
    needles: [
      "socialism",
      "socialist",
      "socialismo",
      "socialista",
      "socialisme",
      "sozialismus",
      "социализм",
      "社会主义",
      "社会主義",
      "사회주의",
      "sosyalizm",
      "اشتراكية",
    ],
  },
  {
    id: "marxista",
    needles: [
      "marx",
      "marxism",
      "marxismo",
      "marxisme",
      "marksizm",
      "маркс",
      "марксизм",
      "马克思",
      "マルクス",
      "마르크스",
      "مارکس",
    ],
  },
  {
    id: "sindacale",
    needles: [
      "union",
      "strike",
      "workers",
      "sindac",
      "sciopero",
      "trabajadores",
      "huelga",
      "greve",
      "gewerkschaft",
      "забастовка",
      "профсоюз",
      "工会",
      "罢工",
      "노동조합",
      "اضراب",
    ],
  },
  {
    id: "antimperialista",
    needles: [
      "imperialism",
      "anti-imperial",
      "imperialismo",
      "antiimperial",
      "imperialisme",
      "империализм",
      "帝国主义",
      "帝国主義",
      "제국주의",
      "امپریالیسم",
      "إمبريالية",
      "nato",
      "otan",
      "нато",
      "北约",
    ],
  },
  {
    id: "stato socialista",
    needles: [
      "china",
      "cina",
      "中国",
      "китай",
      "vietnam",
      "cuba",
      "brics",
      "multipolar",
      "multipolare",
      "многополяр",
      "多极化",
    ],
  },
];

function computeArticleScore(article: ArticleRecord, source: SourceDefinition) {
  const ageHours = article.publishedAt
    ? (Date.now() - Date.parse(article.publishedAt)) / 36e5
    : 72;
  const recency = Math.max(0, 80 - ageHours);
  const topicWeight = article.topics.length * 6;
  return Math.round(source.priority * 10 + recency + topicWeight);
}

function cleanText(value: string) {
  return stripHtml(decodeXml(stripCdata(value)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
}

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function clampText(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trim()}...`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `a${(hash >>> 0).toString(16)}`;
}
