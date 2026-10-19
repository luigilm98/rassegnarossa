import type { ArticleRecord } from "./feed";
import { createBoundedCache } from "./bounded-cache.ts";
export type Placement = "featured" | "opening" | "popular";
export type SourceImage = { link: string; image: string; fallbacks?: string[] };
export type SourceHighlight = { link: string; placement: Placement; rank: number };
type Node = { tag: string; attrs: Record<string, string>; parent?: Node; children: Node[]; text: string; blocked: boolean };
const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const POPULAR = /^(?:pi[uù]\s+letti|most\s+(?:read|viewed|popular)|m[aá]s\s+le[ií]dos|mais\s+lidos|les\s+plus\s+lus|meistgelesen|الأكثر\s+قراءة|阅读排行|最多阅读|самое\s+читаемое)\s*(?:\([^)]{0,30}\)|:)?$/i;
const FEATURED = /^(?:in evidenza|primo piano|in apertura|featured(?: stories)?|top stories|highlights|destacados|en portada|[aà] la une)$/i;
const decode = (text: string) => text.replace(/&(?:amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi, entity => {
  const common: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&lt;": "<", "&gt;": ">" };
  if (common[entity.toLowerCase()]) return common[entity.toLowerCase()];
  const code = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
});
const linkKeys = createBoundedCache<string, string>(8192, 2_000_000, (value, key) => (value.length + key.length) * 2);
export function highlightLinkKey(link: string): string {
  const cached = linkKeys.get(link);
  if (cached !== undefined) return cached;
  try {
    const url = new URL(link);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    const key = url.href;
    linkKeys.set(link, key);
    return key;
  } catch { return ""; }
}
/** Static public HTML only. No scripts, numeric view guesses or visitor-supplied URLs. */
export function parseSourcePage(html: string, homepage: string): { highlights: SourceHighlight[]; images: SourceImage[] } {
  const clean = html.slice(0, 1_200_000).replace(/<!--[^]*?-->/g, "").replace(/<(script|style|noscript|template|svg)\b[^>]*>[^]*?<\/\1\s*>/gi, "");
  const root: Node = { tag: "root", attrs: {}, children: [], text: "", blocked: false };
  const stack = [root], nodes: Node[] = [];
  const token = /<\/?([a-z][a-z0-9:-]*)\b([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = token.exec(clean))) {
    const parent = stack[stack.length - 1];
    if (match[3]) { parent.text += decode(match[3]).slice(0, 500); continue; }
    const tag = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const index = stack.map(node => node.tag).lastIndexOf(tag);
      if (index > 0) stack.length = index;
      continue;
    }
    if (nodes.length >= 35_000 || stack.length >= 100) break;
    const attrs: Record<string, string> = {};
    for (const attr of match[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3] ?? attr[4] ?? "");
    const blocked = parent.blocked || ["nav", "footer", "form"].includes(tag) ||
      (tag === "header" && !stack.some(node => node.tag === "article")) ||
      attrs["aria-hidden"] === "true" || /(?:^|\s)hidden(?:\s|=|$)/i.test(match[2]) || /display\s*:\s*none/i.test(attrs.style ?? "");
    const node: Node = { tag, attrs, parent, children: [], text: "", blocked };
    parent.children.push(node); nodes.push(node);
    if (!VOID.has(tag) && !match[0].endsWith("/>")) stack.push(node);
  }
  const descendants = (node: Node): Node[] => node.children.flatMap(child => [child, ...descendants(child)]);
  const content = (node: Node): string => (node.text + node.children.map(content).join(" ")).trim();
  const homeHost = new URL(homepage).hostname.replace(/^www\./, "");
  const link = (node: Node): string | null => {
    if (node.blocked || node.tag !== "a" || !node.attrs.href) return null;
    try {
      const url = new URL(node.attrs.href, homepage);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.hostname.replace(/^www\./, "") !== homeHost) return null;
      if (url.pathname === "/" || /\/(?:category|tag|author|account|login|cart|shop|donate|search)(?:\/|$)/i.test(url.pathname)) return null;
      return url.href;
    } catch { return null; }
  };
  const results: SourceHighlight[] = [], seen = new Set<string>();
  const counts = { featured: 0, opening: 0, popular: 0 };
  const add = (node: Node, placement: Placement, limit = 20) => {
    const href = link(node), key = href && `${placement}:${highlightLinkKey(href)}`;
    if (!href || !key || seen.has(key) || counts[placement] >= limit) return;
    seen.add(key); results.push({ link: href, placement, rank: ++counts[placement] });
  };
  for (const node of nodes) {
    if (node.blocked) continue;
    const marker = `${node.attrs.class ?? ""} ${node.attrs.id ?? ""}`;
    let placement: Placement | undefined;
    if (/(?:most[-_]read|most[-_]viewed|most[-_]popular|popular[-_]posts|posts[-_]popular|wpp[-_]list|widget[-_\w]*popular)/i.test(marker)) placement = "popular";
    else if (/(?:featured(?:[-_]|\s|$)|[-_]hero(?:[-_]|\s|$)|lead[-_](?:story|article)|top[-_]stor|primo[-_]piano|in[-_]evidenza|jeg_slider)/i.test(marker)) placement = "featured";
    if (placement) for (const anchor of [node, ...descendants(node)]) add(anchor, placement);
    const isHeading = /^h[1-6]$/.test(node.tag);
    const isShortLabel = ["div", "span", "p"].includes(node.tag) && !node.children.length && node.text.trim().length < 70;
    if (!isHeading && !isShortLabel) continue;
    const title = content(node).replace(/\s+/g, " ").slice(0, 120);
    const headingPlacement = POPULAR.test(title) && title.length < 70 ? "popular" : FEATURED.test(title) ? "featured" : undefined;
    if (headingPlacement) {
      let container = node.parent;
      if (container && container.children.length === 1) container = container.parent;
      if (container && !["body", "main", "html", "root"].includes(container.tag) && descendants(container).length < 1000)
        for (const anchor of descendants(container)) add(anchor, headingPlacement);
    }
  }
  // First actual headline links are an opening-position signal, never a readership claim.
  for (const node of nodes.filter(node => !node.blocked && /^h[123]$/.test(node.tag)))
    for (const anchor of descendants(node)) add(anchor, "opening", 5);
  const images: SourceImage[] = [];
  const pictured = new Set<string>();
  const safeImage = (value: string) => {
    try { const url = new URL(value, homepage); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  };
  for (const node of nodes) {
    if (node.blocked || node.tag !== "img" || node.attrs.width === "1" || node.attrs.height === "1") continue;
    const sizes = (node.attrs["data-srcset"] ?? node.attrs.srcset ?? "").split(",").flatMap(candidate => {
      const match = candidate.trim().match(/^(\S+)\s+(\d+)w$/);
      const image = match && safeImage(match[1]);
      return image && Number(match![2]) >= 480 ? [{ image, width: Number(match![2]) }] : [];
    }).sort((a, b) => a.width - b.width);
    const rawImages = [node.attrs["data-src"], node.attrs["data-lazy-src"], node.attrs["data-original"], node.attrs.src]
      .flatMap(value => value && safeImage(value) ? [safeImage(value)!] : []);
    const image = (sizes.find(size => size.width >= 640) ?? sizes.at(-1))?.image ?? rawImages[0];
    const fallbacks = [...new Set([...rawImages, ...sizes.map(size => size.image)])].filter(value => value !== image).slice(0, 4);
    if (!image) continue;
    let parent = node.parent, href: string | null = null;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parent) {
      if (parent.tag === "a") { href = link(parent); break; }
      if (["body", "main", "root"].includes(parent.tag)) break;
      const anchors = descendants(parent).filter(child => child.tag === "a");
      const links = [...new Set(anchors.flatMap(anchor => { const value = link(anchor); return value ? [value] : []; }))];
      // A photo is associated only with an unambiguous story, never a whole section.
      if (links.length === 1) { href = links[0]; break; }
      if (parent.tag === "article") break;
    }
    const key = href && highlightLinkKey(href);
    if (href && key && !pictured.has(key)) { images.push({ link: href, image, ...(fallbacks.length ? { fallbacks } : {}) }); pictured.add(key); }
    if (images.length >= 120) break;
  }
  return { highlights: results, images };
}
export function parseSourceHighlights(html: string, homepage: string): SourceHighlight[] {
  return parseSourcePage(html, homepage).highlights;
}
/** Match photos to exact collected article links; never assign publisher logos or unrelated pictures. */
export function applySourceImages<T extends { link: string; image: string | null; imageFallbacks?: string[] }>(articles: T[], photos: SourceImage[]): T[] {
  if (!photos.length || !articles.length) return articles;
  const byLink = new Map(photos.map(photo => [highlightLinkKey(photo.link), photo]));
  let changed = false;
  const result = articles.map(article => {
    const photo = byLink.get(highlightLinkKey(article.link));
    if (!photo) return article;
    const alternates = Array.isArray(photo.fallbacks) ? photo.fallbacks : [];
    const image = article.image || photo.image;
    const fallbacks = [...new Set([...(Array.isArray(article.imageFallbacks) ? article.imageFallbacks : []), photo.image, ...alternates])].filter(value => value !== image).slice(0, 4);
    if (image === article.image && JSON.stringify(fallbacks) === JSON.stringify(article.imageFallbacks ?? [])) return article;
    changed = true;
    return { ...article, image, ...(fallbacks.length ? { imageFallbacks: fallbacks } : {}) };
  });
  return changed ? result : articles;
}
export function rankSourceHighlights(articles: ArticleRecord[], highlights: SourceHighlight[], mode: "featured" | "popular"): ArticleRecord[] {
  const scores = new Map<string, number>();
  for (const item of highlights) {
    if (mode === "popular" && item.placement !== "popular") continue;
    if (mode === "featured" && item.placement === "popular") continue;
    const score = (item.placement === "featured" ? 300 : item.placement === "popular" ? 200 : 100) - Math.min(item.rank, 99);
    const key = highlightLinkKey(item.link);
    scores.set(key, Math.max(scores.get(key) ?? 0, score));
  }
  const articleScores = new Map(articles.map(article => [article.id, scores.get(highlightLinkKey(article.link)) ?? 0]));
  return [...articles].sort((a, b) => articleScores.get(b.id)! - articleScores.get(a.id)!);
}

/** Select fixed catalogue destinations only, and only after their articles arrive. */
export function highlightSources<T extends { id: string; homepage: string; kind: string }>(catalog: T[], articles: { sourceId: string; sourceHomepage: string }[]): T[] {
  const ids = new Set(articles.map(article => article.sourceId));
  const homepages = new Set(articles.map(article => highlightLinkKey(article.sourceHomepage)));
  const seen = new Set<string>();
  return catalog.filter(source => {
    const key = highlightLinkKey(source.homepage);
    if (source.kind === "radar" || /youtube\.com/.test(source.homepage) || seen.has(key) || (!ids.has(source.id) && !homepages.has(key))) return false;
    seen.add(key); return true;
  });
}
