import type { ArticleRecord } from "./feed";
export type EditorialAxis = "organizzare" | "studiare" | "strumenti" | "potere";
export const EDITORIAL_AXES: {
  id: EditorialAxis;
  label: string;
  description: string;
  terms: string[];
}[] = [
  {
    id: "organizzare",
    label: "Organizzarsi",
    description:
      "Lotte, organizzazione collettiva, mutualismo e risultati concreti.",
    terms: [
      "organizz",
      "scioper",
      "sindacal",
      "mutualis",
      "cooperativ",
      "mobilitaz",
      "contrattaz",
      "organizing",
      "organising",
      "collective bargaining",
      "strike",
      "trade union",
      "tenant union",
      "mutual aid",
      "huelga",
      "sindicat",
      "organiza",
      "greve",
      "gewerkschaft",
      "streik",
      "grève",
      "罢工",
      "工会",
      "забастов",
    ],
  },
  {
    id: "studiare",
    label: "Studiare",
    description:
      "Formazione politica, storia, teoria e ricerca per leggere il presente.",
    terms: [
      "formazione politica",
      "educazione popolare",
      "materialismo",
      "egemonia",
      "coscienza di classe",
      "teoria",
      "storia",
      "political education",
      "political economy",
      "class consciousness",
      "history",
      "theory",
      "study group",
      "reading group",
      "formación",
      "educación popular",
      "teoria",
      "historia",
      "éducation populaire",
      "hégémonie",
      "bildung",
      "理论",
      "历史",
      "теория",
      "истори",
    ],
  },
  {
    id: "strumenti",
    label: "Competenze e autonomia",
    description:
      "Guide, alfabetizzazione critica e strumenti utilizzabili nella vita e nell’azione collettiva.",
    terms: [
      "guida",
      "strumenti",
      "competenze",
      "alfabetizzazione",
      "pensiero critico",
      "sicurezza digitale",
      "verifica delle fonti",
      "come organizzare",
      "how to",
      "toolkit",
      "guide",
      "handbook",
      "skills",
      "critical thinking",
      "media literacy",
      "digital security",
      "public speaking",
      "open source",
      "guía",
      "herramientas",
      "pensamiento crítico",
      "manual",
      "ferramentas",
      "leitfaden",
      "medienkompetenz",
      "指南",
      "技能",
      "руководств",
      "навык",
    ],
  },
  {
    id: "potere",
    label: "Capire il potere",
    description:
      "Analisi critica di destre, centrismo, neoliberismo, propaganda e rapporti di potere.",
    terms: [
      "destr",
      "fascis",
      "neoliber",
      "centrism",
      "austerit",
      "propaganda",
      "oligarch",
      "right-wing",
      "far right",
      "derecha",
      "extrema direita",
      "droite",
      "rechts",
      "capital",
      "repression",
      "répression",
      "privatizz",
      "privatiz",
      "右翼",
      "新自由主义",
      "фашизм",
      "неолибер",
    ],
  },
];
const normalize = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
const TERMS = EDITORIAL_AXES.map((axis) => ({
  ...axis,
  terms: [...new Set(axis.terms.map(normalize))],
}));
const cache = new WeakMap<
  ArticleRecord,
  { axes: EditorialAxis[]; points: Record<EditorialAxis, number> }
>();
export function editorialAssessment(article: ArticleRecord, now = Date.now()) {
  let signals = cache.get(article);
  if (!signals) {
    const title = normalize(article.title);
    const body = normalize(
      `${article.excerpt} ${article.categories.join(" ")}`,
    );
    const points = { organizzare: 0, studiare: 0, strumenti: 0, potere: 0 };
    const analytical =
      /analisi|analysis|analisis|analyse|inchiesta|investigat|explain|strategie|strategy|critique|critica|research|anatom|understand|comprend|capire|如何|分析|анализ/.test(
        `${title} ${body}`,
      );
    for (const axis of TERMS) {
      if (axis.id === "potere" && !analytical) continue;
      const hits = axis.terms.reduce(
        (sum, term) =>
          sum + (title.includes(term) ? 2 : body.includes(term) ? 1 : 0),
        0,
      );
      points[axis.id] = Math.min(3, hits) * (axis.id === "strumenti" ? 9 : 7);
    }
    signals = {
      axes: EDITORIAL_AXES.filter((axis) => points[axis.id] > 0).map(
        (axis) => axis.id,
      ),
      points,
    };
    cache.set(article, signals);
  }
  const timestamp = Date.parse(article.publishedAt ?? "");
  const freshness =
    Number.isFinite(timestamp) && timestamp <= now
      ? Math.max(0, 10 * (1 - (now - timestamp) / (7 * 864e5)))
      : 0;
  const substance = Math.min(
    90,
    Object.values(signals.points).reduce((sum, value) => sum + value, 0),
  );
  return {
    ...signals,
    freshness: Math.round(freshness),
    score: Math.round(substance + freshness),
  };
}
function linkKey(link: string) {
  try {
    const url = new URL(link);
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.hash = "";
    return url.href;
  } catch {
    return link;
  }
}
/** Diversity changes order only. Every distinct article remains accessible. */
export function rankEditorial(
  articles: ArticleRecord[],
  preferred = "all",
  now = Date.now(),
): ArticleRecord[] {
  const seenLinks = new Set<string>(),
    seenTitles = new Set<string>();
  const ranked = articles
    .filter((article) => {
      const link = linkKey(article.link),
        title = `${article.sourceName.toLowerCase()}:${normalize(article.title)}:${article.publishedAt ?? article.id}`;
      if (seenLinks.has(link) || seenTitles.has(title)) return false;
      seenLinks.add(link);
      seenTitles.add(title);
      return true;
    })
    .map((article) => ({
      article,
      assessment: editorialAssessment(article, now),
    }))
    .sort(
      (a, b) =>
        b.assessment.score - a.assessment.score ||
        Number(b.article.language === preferred) -
          Number(a.article.language === preferred) ||
        (Date.parse(b.article.publishedAt ?? "") || 0) -
          (Date.parse(a.article.publishedAt ?? "") || 0) ||
        a.article.id.localeCompare(b.article.id),
    );
  const diversify = (items: typeof ranked) => {
    const opening: ArticleRecord[] = [],
      remaining: ArticleRecord[] = [];
    const counts = new Map<string, number>();
    for (const { article } of items) {
      const publisher = article.sourceName.toLowerCase();
      if (opening.length < 24 && (counts.get(publisher) ?? 0) < 2) {
        opening.push(article);
        counts.set(publisher, (counts.get(publisher) ?? 0) + 1);
      } else remaining.push(article);
    }
    return [...opening, ...remaining];
  };
  // Publisher diversity must not promote generic trends above useful political material.
  return [
    ...diversify(ranked.filter((item) => item.assessment.axes.length > 0)),
    ...diversify(ranked.filter((item) => item.assessment.axes.length === 0)),
  ];
}
