"use client";

import {
  Activity,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  Languages,
  LibraryBig,
  ListFilter,
  Loader2,
  Newspaper,
  PanelRightOpen,
  Radio,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Region,
  SourceDefinition,
  SourceKind,
  TopicDefinition,
} from "@/app/data/catalog";
import { THEORY_LIBRARY } from "@/app/data/library";

type Article = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceHomepage: string;
  region: Region;
  country: string;
  language: string;
  kind: SourceKind;
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

type SourceStatus = {
  sourceId: string;
  name: string;
  ok: boolean;
  count: number;
  feedUrl: string | null;
  error: string | null;
  fetchedAt: string;
  cached: boolean;
};

type SourcesPayload = {
  sources: SourceDefinition[];
  radarChannelCount: number;
  radarArticleWindow: number;
  topics: TopicDefinition[];
  regions: Region[];
  languages: string[];
  ideologies: string[];
  kinds: SourceKind[];
};

type SourceViewItem = SourceDefinition & {
  articleCount: number;
  dynamic: boolean;
  status?: SourceStatus;
};

type TranslationState = {
  status: "idle" | "loading" | "ready" | "error";
  text: string;
  error?: string;
};

const ALL = "all";
const SOURCES_PER_BATCH = 10;
const LIMIT_PER_SOURCE = 150;
const FRESHNESS = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7g", hours: 24 * 7 },
  { id: "30d", label: "30g", hours: 24 * 30 },
  { id: "all", label: "Tutto", hours: Infinity },
];
const SORTS = [
  { id: "fresh", label: "Recenti" },
  { id: "score", label: "Rilevanza" },
  { id: "source", label: "Fonte" },
];

const LANGUAGE_NAMES: Record<string, string> = {
  ar: "Arabo",
  de: "Tedesco",
  el: "Greco",
  en: "Inglese",
  es: "Spagnolo",
  fa: "Persiano",
  fr: "Francese",
  id: "Indonesiano",
  it: "Italiano",
  ja: "Giapponese",
  ko: "Coreano",
  pl: "Polacco",
  pt: "Portoghese",
  ru: "Russo",
  tr: "Turco",
  vi: "Vietnamita",
  zh: "Cinese",
};

export function AggregatorApp() {
  const [sources, setSources] = useState<SourceDefinition[]>([]);
  const [topics, setTopics] = useState<TopicDefinition[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [ideologies, setIdeologies] = useState<string[]>([]);
  const [kinds, setKinds] = useState<SourceKind[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [radarChannelCount, setRadarChannelCount] = useState(0);
  const [radarArticleWindow, setRadarArticleWindow] = useState(0);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string>(ALL);
  const [activeView, setActiveView] = useState<"notizie" | "teoria" | "fonti">(
    "notizie",
  );
  const [region, setRegion] = useState<string>(ALL);
  const [language, setLanguage] = useState<string>(ALL);
  const [ideology, setIdeology] = useState<string>(ALL);
  const [kind, setKind] = useState<string>(ALL);
  const [topic, setTopic] = useState<string>(ALL);
  const [freshness, setFreshness] = useState("7d");
  const [sort, setSort] = useState("fresh");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [readerMode, setReaderMode] = useState<"originale" | "tradotto">(
    "originale",
  );
  const [translations, setTranslations] = useState<Record<string, TranslationState>>(
    {},
  );
  const refreshToken = useRef(0);

  useEffect(() => {
    const saved =
      localStorage.getItem("rassegna-rossa.saved") ??
      localStorage.getItem("internazionale.saved");
    if (saved) {
      setSavedIds(new Set(JSON.parse(saved) as string[]));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "rassegna-rossa.saved",
      JSON.stringify(Array.from(savedIds)),
    );
  }, [savedIds]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/sources")
      .then((response) => response.json() as Promise<SourcesPayload>)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setSources(payload.sources);
        setRadarChannelCount(payload.radarChannelCount);
        setRadarArticleWindow(payload.radarArticleWindow);
        setTopics(payload.topics);
        setRegions(payload.regions);
        setLanguages(payload.languages);
        setIdeologies(payload.ideologies);
        setKinds(payload.kinds);
      })
      .catch(() => {
        if (mounted) {
          setSources([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sourceLookup = useMemo(() => {
    return new Map(sources.map((source) => [source.id, source]));
  }, [sources]);

  const eligibleSources = useMemo(() => {
    return sources.filter((source) => {
      return (
        (region === ALL || source.region === region) &&
        (language === ALL || source.language === language) &&
        (ideology === ALL ||
          source.ideologies.includes(ideology) ||
          source.kind === "radar") &&
        (kind === ALL || source.kind === kind)
      );
    });
  }, [ideology, kind, language, region, sources]);

  const refresh = useCallback(
    async (mode: "all" | "filtered" | "source" = "all") => {
      const token = refreshToken.current + 1;
      refreshToken.current = token;
      const selectedCatalogSource = sourceLookup.get(selectedSourceId);
      const targetSources =
        mode === "source" && selectedCatalogSource
          ? [selectedCatalogSource]
          : mode === "filtered"
            ? eligibleSources
            : sources;
      const ids = targetSources.map((source) => source.id);
      const chunks = chunk(ids, SOURCES_PER_BATCH);

      setLoading(true);
      setProgress({ done: 0, total: chunks.length });
      setLastRefresh(null);
      if (mode === "all") {
        setArticles([]);
        setStatuses({});
      }

      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(3, chunks.length || 1) },
        async () => {
          while (cursor < chunks.length) {
            const current = cursor;
            cursor += 1;
            const idsChunk = chunks[current];
            try {
              const response = await fetch(
                `/api/articles?sourceIds=${encodeURIComponent(
                  idsChunk.join(","),
                )}&limitPerSource=${LIMIT_PER_SOURCE}`,
              );
              const payload = (await response.json()) as {
                articles: Article[];
                statuses: SourceStatus[];
              };

              if (refreshToken.current !== token) {
                return;
              }

              setArticles((currentArticles) =>
                mergeArticles(currentArticles, payload.articles),
              );
              setStatuses((currentStatuses) => {
                const next = { ...currentStatuses };
                for (const status of payload.statuses) {
                  next[status.sourceId] = status;
                }
                return next;
              });
            } catch {
              if (refreshToken.current === token) {
                setStatuses((currentStatuses) => {
                  const next = { ...currentStatuses };
                  for (const id of idsChunk) {
                    next[id] = {
                      sourceId: id,
                      name: sourceLookup.get(id)?.name ?? id,
                      ok: false,
                      count: 0,
                      feedUrl: null,
                      error: "Richiesta non riuscita",
                      fetchedAt: new Date().toISOString(),
                      cached: false,
                    };
                  }
                  return next;
                });
              }
            } finally {
              if (refreshToken.current === token) {
                setProgress((currentProgress) => ({
                  done: Math.min(currentProgress.done + 1, currentProgress.total),
                  total: currentProgress.total,
                }));
              }
            }
          }
        },
      );

      await Promise.all(workers);
      if (refreshToken.current === token) {
        setLoading(false);
        setLastRefresh(new Date().toISOString());
      }
    },
    [eligibleSources, selectedSourceId, sourceLookup, sources],
  );

  useEffect(() => {
    if (sources.length && !articles.length && !loading) {
      void refresh("all");
    }
  }, [articles.length, loading, refresh, sources.length]);

  const filteredArticles = useMemo(() => {
    const selectedFreshness = FRESHNESS.find((item) => item.id === freshness);
    const maxAgeHours = selectedFreshness?.hours ?? Infinity;
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();

    return articles
      .filter((article) => {
        const matchesSource =
          selectedSourceId === ALL || article.sourceId === selectedSourceId;
        const matchesMap =
          (region === ALL || article.region === region) &&
          (language === ALL || article.language === language) &&
          (ideology === ALL || article.ideologies.includes(ideology)) &&
          (kind === ALL || article.kind === kind);
        const matchesTopic = topic === ALL || article.topics.includes(topic);
        const ageHours = article.publishedAt
          ? (now - Date.parse(article.publishedAt)) / 36e5
          : 0;
        const matchesFreshness =
          freshness === "all" || !article.publishedAt || ageHours <= maxAgeHours;
        const haystack = `${article.title} ${article.excerpt} ${article.sourceName} ${article.categories.join(
          " ",
        )}`.toLowerCase();
        const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);

        return (
          matchesSource &&
          matchesMap &&
          matchesTopic &&
          matchesFreshness &&
          matchesQuery
        );
      })
      .sort((left, right) => {
        if (sort === "score") {
          return right.score - left.score;
        }
        if (sort === "source") {
          return left.sourceName.localeCompare(right.sourceName);
        }
        const leftDate = left.publishedAt ? Date.parse(left.publishedAt) : 0;
        const rightDate = right.publishedAt ? Date.parse(right.publishedAt) : 0;
        return rightDate - leftDate || right.score - left.score;
      });
  }, [
    articles,
    freshness,
    ideology,
    kind,
    language,
    query,
    region,
    selectedSourceId,
    sort,
    topic,
  ]);

  const selectedArticle = useMemo(() => {
    return (
      filteredArticles.find((article) => article.id === selectedArticleId) ??
      filteredArticles[0] ??
      null
    );
  }, [filteredArticles, selectedArticleId]);

  useEffect(() => {
    if (selectedArticle && selectedArticle.id !== selectedArticleId) {
      setSelectedArticleId(selectedArticle.id);
    }
  }, [selectedArticle, selectedArticleId]);

  const sourceDirectory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      counts.set(article.sourceId, (counts.get(article.sourceId) ?? 0) + 1);
    }

    const directory = new Map<string, SourceViewItem>();
    for (const source of sources) {
      if (source.kind === "radar") {
        continue;
      }
      directory.set(source.id, {
        ...source,
        articleCount: counts.get(source.id) ?? 0,
        dynamic: false,
        status: statuses[source.id],
      });
    }

    for (const article of articles) {
      const existing = directory.get(article.sourceId);
      if (existing) {
        existing.articleCount = counts.get(article.sourceId) ?? existing.articleCount;
        existing.ideologies = Array.from(
          new Set([...existing.ideologies, ...article.ideologies]),
        );
        existing.tags = Array.from(new Set([...existing.tags, ...article.topics]));
        continue;
      }

      directory.set(article.sourceId, {
        id: article.sourceId,
        name: article.sourceName,
        homepage: article.sourceHomepage,
        region: article.region,
        country: article.country,
        language: article.language,
        kind: article.kind,
        ideologies: article.ideologies,
        tags: article.topics,
        priority: Math.max(1, Math.round(article.score / 20)),
        articleCount: counts.get(article.sourceId) ?? 1,
        dynamic: true,
      });
    }

    return Array.from(directory.values()).sort((left, right) => {
      return (
        right.articleCount - left.articleCount ||
        Number(right.dynamic) - Number(left.dynamic) ||
        left.name.localeCompare(right.name)
      );
    });
  }, [articles, sources, statuses]);

  const visibleSourceDirectory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sourceDirectory.filter((source) => {
      const matchesMap =
        (region === ALL || source.region === region) &&
        (language === ALL || source.language === language) &&
        (ideology === ALL || source.ideologies.includes(ideology)) &&
        (kind === ALL || source.kind === kind);
      const haystack = `${source.name} ${source.country} ${source.language} ${source.kind} ${source.ideologies.join(
        " ",
      )} ${source.tags.join(" ")}`.toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);

      return matchesMap && matchesQuery;
    });
  }, [ideology, kind, language, query, region, sourceDirectory]);

  const selectedSource = useMemo(() => {
    const sourceId =
      selectedSourceId !== ALL ? selectedSourceId : selectedArticle?.sourceId;
    return sourceId
      ? sourceDirectory.find((source) => source.id === sourceId) ?? null
      : null;
  }, [selectedArticle?.sourceId, selectedSourceId, sourceDirectory]);

  const relatedArticles = useMemo(() => {
    const sourceId =
      selectedSourceId !== ALL ? selectedSourceId : selectedArticle?.sourceId;
    const base = sourceId
      ? articles.filter((article) => article.sourceId === sourceId)
      : filteredArticles;

    return base
      .slice()
      .sort((left, right) => {
        const leftDate = left.publishedAt ? Date.parse(left.publishedAt) : 0;
        const rightDate = right.publishedAt ? Date.parse(right.publishedAt) : 0;
        return rightDate - leftDate || right.score - left.score;
      })
      .slice(0, 30);
  }, [articles, filteredArticles, selectedArticle?.sourceId, selectedSourceId]);

  const availableLanguages = useMemo(() => {
    return Array.from(
      new Set([...languages, ...articles.map((article) => article.language)]),
    ).sort();
  }, [articles, languages]);

  const availableIdeologies = useMemo(() => {
    return Array.from(
      new Set([
        ...ideologies,
        ...articles.flatMap((article) => article.ideologies),
      ]),
    ).sort();
  }, [articles, ideologies]);

  const stats = useMemo(() => {
    const ok = Object.values(statuses).filter((status) => status.ok).length;
    const countries = new Set(sourceDirectory.map((source) => source.country)).size;
    const emerged = sourceDirectory.filter((source) => source.dynamic).length;
    return {
      ok,
      countries,
      catalog: sources.length,
      emerged,
      indexed: articles.length,
      visible: filteredArticles.length,
      saved: savedIds.size,
    };
  }, [
    articles.length,
    filteredArticles.length,
    savedIds.size,
    sourceDirectory,
    sources.length,
    statuses,
  ]);

  const translateSelected = async () => {
    if (!selectedArticle) {
      return;
    }

    const text = `${selectedArticle.title}. ${selectedArticle.excerpt}`;
    setTranslations((current) => ({
      ...current,
      [selectedArticle.id]: { status: "loading", text: "" },
    }));

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          from: selectedArticle.language,
          to: "it",
        }),
      });
      const payload = (await response.json()) as {
        translatedText?: string;
        error?: string;
      };
      if (!response.ok || !payload.translatedText) {
        throw new Error(payload.error ?? "Traduzione non disponibile");
      }
      setTranslations((current) => ({
        ...current,
        [selectedArticle.id]: {
          status: "ready",
          text: payload.translatedText,
        },
      }));
    } catch (error) {
      setTranslations((current) => ({
        ...current,
        [selectedArticle.id]: {
          status: "error",
          text: "",
          error: error instanceof Error ? error.message : "Errore di traduzione",
        },
      }));
    }
  };

  const resetFilters = () => {
    setRegion(ALL);
    setLanguage(ALL);
    setIdeology(ALL);
    setKind(ALL);
    setTopic(ALL);
    setFreshness("7d");
    setSort("fresh");
    setQuery("");
    setSelectedSourceId(ALL);
  };

  const selectedTranslation = selectedArticle
    ? translations[selectedArticle.id] ?? { status: "idle", text: "" }
    : { status: "idle", text: "" };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Pannello principale">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Newspaper size={24} />
          </div>
          <div>
            <p className="eyebrow">Aggregatore socialista globale</p>
            <h1>Rassegna Rossa</h1>
          </div>
        </div>

        <div className="command-strip">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Cerca articoli"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca classe, guerra, Cina, sciopero..."
            />
            {query ? (
              <button
                className="icon-button ghost"
                type="button"
                onClick={() => setQuery("")}
                aria-label="Cancella ricerca"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <button
            className="icon-text-button primary"
            type="button"
            onClick={() => void refresh("all")}
            disabled={loading || !sources.length}
          >
            {loading ? <Loader2 className="spin" size={17} /> : <RefreshCcw size={17} />}
            <span>{loading ? "Sincronizzo" : "Aggiorna mondo"}</span>
          </button>
        </div>
      </section>

      <section className="status-grid" aria-label="Metriche">
        <Metric icon={<Globe2 size={18} />} label="Canali attivi" value={stats.catalog} />
        <Metric icon={<Activity size={18} />} label="Radar globali" value={radarChannelCount} />
        <Metric icon={<Radio size={18} />} label="Articoli raccolti" value={stats.indexed} />
        <Metric icon={<ListFilter size={18} />} label="Fonti emerse" value={stats.emerged} />
        <Metric icon={<CheckCircle2 size={18} />} label="Articoli filtrati" value={stats.visible} />
      </section>

      <section className="workspace">
        <aside className="left-rail" aria-label="Filtri e navigazione">
          <div className="view-tabs" role="tablist" aria-label="Sezioni">
            <ViewButton
              active={activeView === "notizie"}
              icon={<Radio size={17} />}
              label="Notizie"
              onClick={() => setActiveView("notizie")}
            />
            <ViewButton
              active={activeView === "teoria"}
              icon={<LibraryBig size={17} />}
              label="Teoria"
              onClick={() => setActiveView("teoria")}
            />
            <ViewButton
              active={activeView === "fonti"}
              icon={<ListFilter size={17} />}
              label="Fonti"
              onClick={() => setActiveView("fonti")}
            />
          </div>

          <FilterGroup title="Mappa">
            <SelectFilter label="Area" value={region} onChange={setRegion}>
              <option value={ALL}>Tutte le aree</option>
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectFilter>
            <SelectFilter label="Lingua" value={language} onChange={setLanguage}>
              <option value={ALL}>Tutte le lingue</option>
              {availableLanguages.map((item) => (
                <option key={item} value={item}>
                  {LANGUAGE_NAMES[item] ?? item.toUpperCase()}
                </option>
              ))}
            </SelectFilter>
            <SelectFilter label="Linea" value={ideology} onChange={setIdeology}>
              <option value={ALL}>Tutte le linee</option>
              {availableIdeologies.map((item) => (
                <option key={item} value={item}>
                  {capitalize(item)}
                </option>
              ))}
            </SelectFilter>
            <SelectFilter label="Tipo" value={kind} onChange={setKind}>
              <option value={ALL}>Tutti i tipi</option>
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {capitalize(item)}
                </option>
              ))}
            </SelectFilter>
          </FilterGroup>

          <FilterGroup title="Fonte">
            {selectedSource ? (
              <div className="selected-source">
                <span>
                  <strong>{selectedSource.name}</strong>
                  <small>
                    {selectedSource.articleCount.toLocaleString("it-IT")} articoli ·{" "}
                    {selectedSource.dynamic ? "emersa dal radar" : "catalogata"}
                  </small>
                </span>
                <button
                  className="icon-button ghost"
                  type="button"
                  onClick={() => setSelectedSourceId(ALL)}
                  aria-label="Libera fonte"
                  title="Libera fonte"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="source-hint">
                <strong>{visibleSourceDirectory.length.toLocaleString("it-IT")}</strong>
                <span>fonti nella selezione corrente</span>
                <small>
                  {radarChannelCount.toLocaleString("it-IT")} radar · finestra{" "}
                  {radarArticleWindow.toLocaleString("it-IT")} articoli
                </small>
              </div>
            )}
            <button
              className="icon-text-button quiet"
              type="button"
              onClick={() => setActiveView("fonti")}
            >
              <ListFilter size={16} />
              <span>Lista fonti</span>
            </button>
            <button
              className="icon-text-button quiet"
              type="button"
              onClick={() => void refresh("source")}
              disabled={
                loading ||
                selectedSourceId === ALL ||
                !sourceLookup.has(selectedSourceId)
              }
            >
              <RefreshCcw size={16} />
              <span>Aggiorna fonte</span>
            </button>
          </FilterGroup>

          <FilterGroup title="Taglio">
            <div className="chip-grid">
              <button
                className={topic === ALL ? "chip active" : "chip"}
                type="button"
                onClick={() => setTopic(ALL)}
              >
                Tutti
              </button>
              {topics.map((item) => (
                <button
                  key={item.id}
                  className={topic === item.id ? "chip active" : "chip"}
                  type="button"
                  onClick={() => setTopic(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Tempo">
            <div className="segmented">
              {FRESHNESS.map((item) => (
                <button
                  key={item.id}
                  className={freshness === item.id ? "active" : ""}
                  type="button"
                  onClick={() => setFreshness(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <SelectFilter label="Ordina" value={sort} onChange={setSort}>
              {SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectFilter>
            <button className="icon-text-button quiet" type="button" onClick={resetFilters}>
              <Filter size={16} />
              <span>Ripulisci filtri</span>
            </button>
            <button
              className="icon-text-button quiet"
              type="button"
              onClick={() => void refresh("filtered")}
              disabled={loading || !eligibleSources.length}
            >
              <RefreshCcw size={16} />
              <span>Aggiorna selezione</span>
            </button>
          </FilterGroup>
        </aside>

        <section className="content-pane" aria-live="polite">
          {activeView === "notizie" ? (
            <NewsView
              articles={filteredArticles}
              loading={loading}
              progress={progress}
              lastRefresh={lastRefresh}
              selectedArticleId={selectedArticle?.id ?? null}
              savedIds={savedIds}
              onSelect={(article) => {
                setSelectedArticleId(article.id);
                setActiveView("notizie");
              }}
              onToggleSave={(articleId) =>
                setSavedIds((current) => toggleSet(current, articleId))
              }
            />
          ) : null}

          {activeView === "teoria" ? (
            <TheoryView
              articles={filteredArticles.filter((article) =>
                article.topics.some((item) => item === "teoria" || item === "storia"),
              )}
              onSelectArticle={(article) => {
                setSelectedArticleId(article.id);
                setActiveView("notizie");
              }}
            />
          ) : null}

          {activeView === "fonti" ? (
            <SourcesView
              sources={visibleSourceDirectory}
              selectedSourceId={selectedSourceId}
              onSelect={(sourceId) => {
                setSelectedSourceId(sourceId);
                setActiveView("notizie");
              }}
              onClear={() => setSelectedSourceId(ALL)}
            />
          ) : null}
        </section>

        <aside className="reader-pane" aria-label="Esploratore fonte">
          <ExplorerPanel
            article={selectedArticle}
            source={selectedSource}
            relatedArticles={relatedArticles}
            readerMode={readerMode}
            setReaderMode={setReaderMode}
            translation={selectedTranslation}
            onTranslate={() => void translateSelected()}
            onSelectArticle={(article) => {
              setSelectedArticleId(article.id);
              setActiveView("notizie");
            }}
            saved={selectedArticle ? savedIds.has(selectedArticle.id) : false}
            onToggleSave={() => {
              if (selectedArticle) {
                setSavedIds((current) => toggleSet(current, selectedArticle.id));
              }
            }}
          />
        </aside>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="metric">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{value.toLocaleString("it-IT")}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={active ? "view-tab active" : "view-tab"}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="filter-group">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="select-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function NewsView({
  articles,
  loading,
  progress,
  lastRefresh,
  selectedArticleId,
  savedIds,
  onSelect,
  onToggleSave,
}: {
  articles: Article[];
  loading: boolean;
  progress: { done: number; total: number };
  lastRefresh: string | null;
  selectedArticleId: string | null;
  savedIds: Set<string>;
  onSelect: (article: Article) => void;
  onToggleSave: (articleId: string) => void;
}) {
  return (
    <div className="news-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Flusso vivo</p>
          <h2>Notizie navigabili</h2>
        </div>
        <div className="sync-state">
          {loading ? (
            <>
              <Loader2 className="spin" size={16} />
              <span>
                {progress.done}/{progress.total || 1}
              </span>
            </>
          ) : (
            <>
              <Clock3 size={16} />
              <span>{lastRefresh ? relativeTime(lastRefresh) : "In attesa"}</span>
            </>
          )}
        </div>
      </div>

      <div className="article-list">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            active={article.id === selectedArticleId}
            saved={savedIds.has(article.id)}
            onSelect={() => onSelect(article)}
            onToggleSave={() => onToggleSave(article.id)}
          />
        ))}
        {!articles.length && !loading ? (
          <div className="empty-state">
            <ShieldAlert size={28} />
            <strong>Nessun articolo nel taglio scelto</strong>
            <span>Cambia area, tempo o tema e rilancia la rete.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  active,
  saved,
  onSelect,
  onToggleSave,
}: {
  article: Article;
  active: boolean;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}) {
  return (
    <article className={active ? "article-card active" : "article-card"}>
      <button className="article-main" type="button" onClick={onSelect}>
        <span className="article-meta">
          <span>{article.sourceName}</span>
          <span>{article.country}</span>
          <span>{article.publishedAt ? relativeTime(article.publishedAt) : "Senza data"}</span>
        </span>
        <h3>{article.title}</h3>
        <p>{article.excerpt || "Anteprima non disponibile dal feed."}</p>
        <span className="topic-row">
          {article.topics.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {article.ideologies.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>
      </button>
      <div className="article-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onToggleSave}
          aria-label={saved ? "Rimuovi dai salvati" : "Salva articolo"}
          title={saved ? "Rimuovi dai salvati" : "Salva articolo"}
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
        <a
          className="icon-button"
          href={article.link}
          target="_blank"
          rel="noreferrer"
          aria-label="Apri fonte"
          title="Apri fonte"
        >
          <ArrowUpRight size={17} />
        </a>
      </div>
    </article>
  );
}

function TheoryView({
  articles,
  onSelectArticle,
}: {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
}) {
  return (
    <div className="theory-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Biblioteca rossa</p>
          <h2>Teoria, storia, lessico</h2>
        </div>
        <Sparkles size={20} />
      </div>

      <div className="theory-grid">
        {THEORY_LIBRARY.map((item) => (
          <article className="theory-card" key={item.id}>
            <span className="lane">{item.lane}</span>
            <h3>{item.title}</h3>
            <p className="byline">
              {item.author} · {item.period}
            </p>
            <p>{item.summary}</p>
            <div className="topic-row">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="link-row">
              {item.links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} />
                  {link.label}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="section-head compact">
        <div>
          <p className="eyebrow">Dai feed</p>
          <h2>Articoli teorici e storici</h2>
        </div>
      </div>
      <div className="article-list compact-list">
        {articles.slice(0, 12).map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            active={false}
            saved={false}
            onSelect={() => onSelectArticle(article)}
            onToggleSave={() => undefined}
          />
        ))}
      </div>
    </div>
  );
}

function SourcesView({
  sources,
  selectedSourceId,
  onSelect,
  onClear,
}: {
  sources: SourceViewItem[];
  selectedSourceId: string;
  onSelect: (sourceId: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="sources-view">
      <div className="section-head">
        <div>
          <p className="eyebrow">Atlante fonti</p>
          <h2>{sources.length.toLocaleString("it-IT")} fonti navigabili</h2>
        </div>
        {selectedSourceId !== ALL ? (
          <button className="icon-text-button quiet compact-action" type="button" onClick={onClear}>
            <X size={15} />
            <span>Tutte</span>
          </button>
        ) : null}
      </div>
      <div className="source-table" role="table" aria-label="Fonti">
        {sources.map((source) => {
          return (
            <div
              className={
                selectedSourceId === source.id ? "source-row active" : "source-row"
              }
              key={source.id}
            >
              <button
                className="source-row-main"
                type="button"
                onClick={() => onSelect(source.id)}
              >
                <span
                  className={
                    source.status?.ok || source.articleCount > 0
                      ? "source-dot ok"
                      : "source-dot"
                  }
                />
                <span>
                  <strong>{source.name}</strong>
                  <small>
                    {source.country} ·{" "}
                    {LANGUAGE_NAMES[source.language] ?? source.language.toUpperCase()} ·{" "}
                    {source.kind}
                  </small>
                </span>
                <span className="source-tags">
                  {source.ideologies.slice(0, 3).map((item) => (
                    <i key={item}>{item}</i>
                  ))}
                </span>
                <span className="source-count">
                  {source.articleCount > 0
                    ? `${source.articleCount.toLocaleString("it-IT")} articoli`
                    : source.status
                      ? source.status.ok
                        ? `${source.status.count} item`
                        : "errore"
                      : "in attesa"}
                </span>
              </button>
              <a
                className="icon-button"
                href={source.homepage}
                target="_blank"
                rel="noreferrer"
                aria-label={`Apri ${source.name}`}
                title={`Apri ${source.name}`}
              >
                <ExternalLink size={16} />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplorerPanel({
  article,
  source,
  relatedArticles,
  readerMode,
  setReaderMode,
  translation,
  onTranslate,
  onSelectArticle,
  saved,
  onToggleSave,
}: {
  article: Article | null;
  source: SourceViewItem | null;
  relatedArticles: Article[];
  readerMode: "originale" | "tradotto";
  setReaderMode: (mode: "originale" | "tradotto") => void;
  translation: TranslationState;
  onTranslate: () => void;
  onSelectArticle: (article: Article) => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  if (!article && !source) {
    return (
      <div className="reader-empty">
        <PanelRightOpen size={30} />
        <strong>Seleziona una fonte</strong>
        <span>La coda articoli apparira qui.</span>
      </div>
    );
  }

  const translatedUrl = article
    ? `https://translate.google.com/translate?sl=auto&tl=it&u=${encodeURIComponent(
        article.link,
      )}`
    : "";
  const readerUrl = readerMode === "tradotto" ? translatedUrl : article?.link ?? "";

  return (
    <div className="reader explorer">
      <div className="reader-header source-reader-header">
        <div>
          <p className="eyebrow">
            {source?.dynamic ? "Fonte emersa" : "Fonte catalogata"}
          </p>
          <h2>{source?.name ?? article?.sourceName}</h2>
          <small>
            {source?.country ?? article?.country} ·{" "}
            {LANGUAGE_NAMES[source?.language ?? article?.language ?? ""] ??
              source?.language ??
              article?.language}{" "}
            · {relatedArticles.length.toLocaleString("it-IT")} articoli in coda
          </small>
        </div>
        {source ? (
          <a
            className="icon-button"
            href={source.homepage}
            target="_blank"
            rel="noreferrer"
            aria-label={`Apri ${source.name}`}
            title={`Apri ${source.name}`}
          >
            <ExternalLink size={17} />
          </a>
        ) : null}
      </div>

      {relatedArticles.length ? (
        <div className="source-article-stack">
          {relatedArticles.map((item) => (
            <button
              key={item.id}
              className={article?.id === item.id ? "source-article active" : "source-article"}
              type="button"
              onClick={() => onSelectArticle(item)}
            >
              <span>{item.publishedAt ? relativeTime(item.publishedAt) : "Senza data"}</span>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
      ) : null}

      {article ? (
        <div className="reader-current">
          <div className="reader-current-title">
            <p className="eyebrow">{article.sourceName}</p>
            <h3>{article.title}</h3>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onToggleSave}
            aria-label={saved ? "Rimuovi dai salvati" : "Salva articolo"}
            title={saved ? "Rimuovi dai salvati" : "Salva articolo"}
          >
            {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
        </div>
      ) : null}

      <div className="reader-tools">
        <div className="segmented">
          <button
            className={readerMode === "originale" ? "active" : ""}
            type="button"
            onClick={() => setReaderMode("originale")}
          >
            Originale
          </button>
          <button
            className={readerMode === "tradotto" ? "active" : ""}
            type="button"
            onClick={() => setReaderMode("tradotto")}
          >
            Tradotto
          </button>
        </div>
        <button
          className="icon-text-button quiet"
          type="button"
          onClick={onTranslate}
          disabled={!article || translation.status === "loading"}
        >
          {translation.status === "loading" ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <Languages size={16} />
          )}
          <span>Scheda IT</span>
        </button>
        {article ? (
          <a
            className="icon-button"
            href={article.link}
            target="_blank"
            rel="noreferrer"
            aria-label="Apri in nuova scheda"
            title="Apri in nuova scheda"
          >
            <ExternalLink size={17} />
          </a>
        ) : null}
      </div>

      <div className="translation-box">
        {!article ? (
          <p>Seleziona un articolo dalla coda della fonte.</p>
        ) : translation.status === "ready" ? (
          <p>{translation.text}</p>
        ) : translation.status === "error" ? (
          <p>{translation.error}</p>
        ) : (
          <p>{article.excerpt || "Anteprima non disponibile dal feed."}</p>
        )}
      </div>

      {article ? (
        <iframe
          key={readerUrl}
          className="article-frame"
          src={readerUrl}
          title={article.title}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      ) : null}
    </div>
  );
}

function mergeArticles(current: Article[], incoming: Article[]) {
  const merged = new Map(current.map((article) => [article.id, article]));
  for (const article of incoming) {
    merged.set(article.id, article);
  }
  return Array.from(merged.values()).sort((left, right) => {
    const leftDate = left.publishedAt ? Date.parse(left.publishedAt) : 0;
    const rightDate = right.publishedAt ? Date.parse(right.publishedAt) : 0;
    return rightDate - leftDate || right.score - left.score;
  });
}

function toggleSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function relativeTime(iso: string) {
  const date = Date.parse(iso);
  if (!Number.isFinite(date)) {
    return "data incerta";
  }
  const seconds = Math.round((date - Date.now()) / 1000);
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

  for (const [unit, amount] of divisions) {
    if (Math.abs(seconds) >= amount || unit === "minute") {
      return formatter.format(Math.round(seconds / amount), unit);
    }
  }
  return "ora";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
