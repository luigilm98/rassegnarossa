"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Globe2,
  Languages,
  Loader2,
  Newspaper,
  RefreshCcw,
  Search,
  SlidersHorizontal,
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
import {
  SOURCE_CATALOG,
  TOPIC_TAXONOMY,
  REGION_ORDER,
  RADAR_CHANNEL_COUNT,
  type SourceDefinition,
} from "@/app/data/catalog";
import { THEORY_LIBRARY } from "@/app/data/library";
import { DOSSIERS, READING_PATHS, GLOSSARY } from "@/app/data/editorial";
import {
  filterArticles,
  mergeArticles,
  restoreSavedArticles,
  restoreNewsSnapshot,
  safeWebUrl,
  type ReadingArticle as Article,
} from "@/app/lib/reading";
import {
  preferredLanguageFor,
  rankSources,
  nextSourcePage,
} from "@/app/lib/source-selection";

type View = "notizie" | "fonti" | "teoria" | "salvati" | "metodo";
type SourceStatus = {
  sourceId: string;
  name: string;
  ok: boolean;
  count: number;
  error: string | null;
  cached: boolean;
};
type DirectorySource = SourceDefinition & {
  count: number;
  status?: SourceStatus;
  discovered?: boolean;
};
const ALL = "all";
const PAGE_SIZE = 24;
const LANGUAGES: Record<string, string> = {
  it: "Italiano",
  en: "Inglese",
  es: "Spagnolo",
  pt: "Portoghese",
  fr: "Francese",
  de: "Tedesco",
  ar: "Arabo",
  zh: "Cinese",
  ru: "Russo",
  el: "Greco",
  fa: "Persiano",
  ja: "Giapponese",
  ko: "Coreano",
  hi: "Hindi",
  tr: "Turco",
  id: "Indonesiano",
  vi: "Vietnamita",
};
const NAV: { id: View; label: string }[] = [
  { id: "notizie", label: "La rassegna" },
  { id: "fonti", label: "Atlante delle fonti" },
  { id: "teoria", label: "Biblioteca" },
  { id: "salvati", label: "Salvati" },
  { id: "metodo", label: "Il progetto" },
];
const HEADINGS = {
  notizie: {
    overline: "NOTIZIE · ANALISI · PROSPETTIVE",
    title: (
      <>
        Il mondo, da un’altra
        <br />
        <em>prospettiva.</em>
      </>
    ),
    description:
      "Voci e idee dal lavoro, dai movimenti e dal Sud globale. Una rassegna per collegare le notizie, capire i conflitti, allargare lo sguardo.",
  },
  fonti: {
    overline: "L’ATLANTE",
    title: (
      <>
        Le voci. I luoghi.
        <br />
        <em>Le prospettive.</em>
      </>
    ),
    description:
      "Giornali, riviste, sindacati e movimenti: esplora le fonti per paese, lingua e orientamento. Il punto di partenza di ogni notizia resta visibile.",
  },
  teoria: {
    overline: "LA BIBLIOTECA",
    title: (
      <>
        Capire il presente.
        <br />
        <em>Leggere in profondità.</em>
      </>
    ),
    description:
      "Testi, concetti e percorsi di lettura per dare contesto alle notizie. Una biblioteca aperta, da attraversare un’idea alla volta.",
  },
  salvati: {
    overline: "IL TUO TACCUINO",
    title: (
      <>
        Le letture che
        <br />
        <em>vuoi ritrovare.</em>
      </>
    ),
    description:
      "Conserva gli articoli che meritano tempo. Le schede restano in questo browser, anche quando chiudi la rassegna. Nessun account necessario.",
  },
  metodo: {
    overline: "IL PROGETTO",
    title: (
      <>
        Molte fonti.
        <br />
        <em>Uno sguardo consapevole.</em>
      </>
    ),
    description:
      "Rassegna Rossa è uno strumento per orientarsi nell’informazione socialista, comunista, sindacale e anticoloniale. Qui spieghiamo come funziona e quali sono i suoi limiti.",
  },
};

export function AggregatorApp() {
  const [view, setView] = useState<View>("notizie");
  const [articles, setArticles] = useState<Article[]>([]);
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [ideology, setIdeology] = useState(ALL);
  const [topic, setTopic] = useState(ALL);
  const [sourceId, setSourceId] = useState(ALL);
  const [days, setDays] = useState("30");
  const [sort, setSort] = useState("fresh");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({
    done: 0,
    total: 16,
  });
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("L’informazione, oltre i confini");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState("it");
  const [newsUpdatedAt, setNewsUpdatedAt] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [refreshNotice, setRefreshNotice] = useState("");
  const attemptedRef = useRef<Set<string>>(new Set());
  const refreshNumber = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const readerDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setDateLabel(
      new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
    try {
      const restored = restoreSavedArticles(
        localStorage.getItem("rassegna-rossa.saved-articles"),
      );
      let rawIds: unknown = [];
      try {
        rawIds = JSON.parse(
          localStorage.getItem("rassegna-rossa.saved") ??
            localStorage.getItem("internazionale.saved") ??
            "[]",
        );
      } catch {
        /* Valid saved cards still restore if legacy IDs are corrupt. */
      }
      setSavedIds(
        new Set([
          ...restored.map((a) => a.id),
          ...(Array.isArray(rawIds)
            ? rawIds.filter((id): id is string => typeof id === "string")
            : []),
        ]),
      );
      setSavedArticles(restored);
    } catch {
      setStorageWarning(true);
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(
        "rassegna-rossa.saved",
        JSON.stringify(Array.from(savedIds)),
      );
      localStorage.setItem(
        "rassegna-rossa.saved-articles",
        JSON.stringify(savedArticles),
      );
    } catch {
      setStorageWarning(true);
    }
  }, [savedIds, savedArticles, storageReady]);

  useEffect(() => {
    // Old saved IDs become persistent article cards when their feed is fetched again.
    if (!articles.length || !storageReady) return;
    setSavedArticles((current) => {
      const matching = articles.filter((a) => savedIds.has(a.id));
      const next = mergeArticles(
        current.filter((a) => savedIds.has(a.id)),
        matching,
      );
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [articles, savedIds, storageReady]);

  const reset = useCallback(() => {
    setQuery("");
    setRegion(ALL);
    setLanguage(ALL);
    setKind(ALL);
    setIdeology(ALL);
    setTopic(ALL);
    setSourceId(ALL);
    setDays("30");
    setSort("fresh");
    setVisibleCount(PAGE_SIZE);
  }, []);
  const navigate = (next: View) => {
    setView(next);
    reset();
    setFiltersOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const stopRefresh = () => {
    ++refreshNumber.current;
    abortRef.current?.abort();
    setLoading(false);
    setLastRefresh(new Date().toISOString());
  };
  const pickTopic = (id: string) => {
    reset();
    setView("notizie");
    setTopic(id);
    document
      .getElementById("letture")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const eligibleSources = useMemo(
    () =>
      SOURCE_CATALOG.filter(
        (s) =>
          (region === ALL || s.region === region) &&
          (language === ALL || s.language === language) &&
          (kind === ALL || s.kind === kind) &&
          (ideology === ALL ||
            s.ideologies.includes(ideology) ||
            s.kind === "radar") &&
          (sourceId === ALL || s.id === sourceId),
      ),
    [region, language, kind, ideology, sourceId],
  );

  const refresh = useCallback(
    async (
      scope: "initial" | "all" | "selection" | "more" = "all",
      preferred = preferredLanguage,
      explicitIds?: string[],
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const run = ++refreshNumber.current;
      const ordered = rankSources(SOURCE_CATALOG, preferred);
      const targets = explicitIds
        ? ordered.filter((source) => explicitIds.includes(source.id))
        : scope === "more"
          ? nextSourcePage(eligibleSources, preferred, attemptedRef.current)
          : scope === "selection"
            ? rankSources(eligibleSources, preferred).slice(0, 16)
            : scope === "all" && attemptedRef.current.size
              ? ordered
                  .filter((source) => attemptedRef.current.has(source.id))
                  .slice(0, 32)
              : ordered.slice(0, 16);
      setLoading(true);
      setRefreshNotice("");
      setProgress({ done: 0, total: targets.length });
      const runTimeout = setTimeout(() => {
        if (run !== refreshNumber.current) return;
        setRefreshNotice(
          "Aggiornamento parziale: alcune fonti richiedono più tempo. Le altre notizie restano disponibili.",
        );
        controller.abort();
      }, 25000);
      let cursor = 0;
      try {
        await Promise.all(
          Array.from({ length: Math.min(6, targets.length) }, async () => {
            while (cursor < targets.length && !controller.signal.aborted) {
              const source = targets[cursor++];
              const requestController = new AbortController();
              const abort = () => requestController.abort();
              controller.signal.addEventListener("abort", abort, {
                once: true,
              });
              const timeout = setTimeout(abort, 10000);
              try {
                const response = await fetch(
                  `/api/articles?sourceIds=${encodeURIComponent(source.id)}&limitPerSource=24`,
                  { signal: requestController.signal },
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = (await response.json()) as {
                  articles: Article[];
                  statuses: SourceStatus[];
                };
                if (
                  !Array.isArray(payload.articles) ||
                  !Array.isArray(payload.statuses)
                )
                  throw new Error("Risposta non valida");
                if (run !== refreshNumber.current || controller.signal.aborted)
                  return;
                setArticles((current) =>
                  mergeArticles(current, payload.articles),
                );
                if (payload.articles.length) setNewsUpdatedAt(Date.now());
                setStatuses((current) => ({
                  ...current,
                  ...Object.fromEntries(
                    payload.statuses.map((status) => [status.sourceId, status]),
                  ),
                }));
              } catch {
                if (run !== refreshNumber.current || controller.signal.aborted)
                  return;
                setStatuses((current) => ({
                  ...current,
                  [source.id]: {
                    sourceId: source.id,
                    name: source.name,
                    ok: false,
                    count: 0,
                    error:
                      "La fonte non ha risposto in tempo. Puoi aprire direttamente il suo sito.",
                    cached: false,
                  },
                }));
              } finally {
                clearTimeout(timeout);
                controller.signal.removeEventListener("abort", abort);
                if (
                  run === refreshNumber.current &&
                  !controller.signal.aborted
                ) {
                  attemptedRef.current.add(source.id);
                  setAttemptedIds(new Set(attemptedRef.current));
                  setProgress((current) => ({
                    ...current,
                    done: Math.min(current.total, current.done + 1),
                  }));
                }
              }
            }
          }),
        );
      } finally {
        clearTimeout(runTimeout);
        if (run === refreshNumber.current) {
          setLoading(false);
          setLastRefresh(new Date().toISOString());
        }
      }
    },
    [eligibleSources, preferredLanguage],
  );

  useEffect(() => {
    const available = [
      ...new Set(SOURCE_CATALOG.map((source) => source.language)),
    ];
    let preferred = preferredLanguageFor(
      navigator.languages?.length ? navigator.languages : [navigator.language],
      available,
    );
    let fresh = false;
    try {
      const chosen = localStorage.getItem("rassegna-rossa.language");
      if (chosen === ALL || (chosen && available.includes(chosen)))
        preferred = chosen;
      const snapshot = restoreNewsSnapshot(
        localStorage.getItem("rassegna-rossa.feed-cache"),
      );
      if (snapshot) {
        setArticles(snapshot.articles);
        setNewsUpdatedAt(snapshot.updatedAt);
        setLastRefresh(new Date(snapshot.updatedAt).toISOString());
        fresh = snapshot.fresh;
        const ids = new Set(
          snapshot.articles
            .map((article) => article.sourceId)
            .filter((id) => SOURCE_CATALOG.some((source) => source.id === id)),
        );
        attemptedRef.current = ids;
        setAttemptedIds(new Set(ids));
      }
    } catch {
      /* Caching is optional, including in private browsing. */
    }
    setPreferredLanguage(preferred);
    if (fresh) setLoading(false);
    else void refresh("initial", preferred);
    return () => {
      abortRef.current?.abort();
      ++refreshNumber.current;
    };
    // Only the initial page loads automatically; subsequent pages are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageReady || !newsUpdatedAt || !articles.length) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "rassegna-rossa.feed-cache",
          JSON.stringify({
            updatedAt: newsUpdatedAt,
            articles: articles.slice(0, 300),
          }),
        );
      } catch {
        /* Never discard bookmarks to make room for a feed cache. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [articles, newsUpdatedAt, storageReady]);

  const choosePriority = (value: string) => {
    setPreferredLanguage(value);
    try {
      localStorage.setItem("rassegna-rossa.language", value);
    } catch {}
    void refresh("initial", value);
  };
  const openSource = (id: string) => {
    reset();
    setView("notizie");
    setSourceId(id);
    setDays("Infinity");
    void refresh("selection", preferredLanguage, [id]);
    requestAnimationFrame(() =>
      document
        .getElementById("letture")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "/" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        readerDialog.current?.open ||
        target?.isContentEditable ||
        target?.closest("input, textarea, select")
      )
        return;
      const search = document.getElementById("rassegna-search");
      if (search) {
        event.preventDefault();
        search.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const allArticles = useMemo(
    () => mergeArticles(savedArticles, articles),
    [savedArticles, articles],
  );
  const filtered = useMemo(
    () =>
      filterArticles(
        view === "salvati"
          ? allArticles.filter((a) => savedIds.has(a.id))
          : articles,
        {
          query,
          region,
          language,
          kind,
          ideology,
          topic,
          source: sourceId,
          days: view === "salvati" ? Infinity : Number(days),
          sort,
          preferredLanguage,
        },
      ),
    [
      view,
      allArticles,
      articles,
      savedIds,
      query,
      region,
      language,
      kind,
      ideology,
      topic,
      sourceId,
      days,
      sort,
      preferredLanguage,
    ],
  );
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    view,
    query,
    region,
    language,
    kind,
    ideology,
    topic,
    sourceId,
    days,
    sort,
  ]);
  const selectedArticle = allArticles.find((a) => a.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedArticle) {
      if (!readerDialog.current?.open) readerDialog.current?.showModal();
      readerDialog.current?.scrollTo({ top: 0 });
    }
  }, [selectedArticle]);

  const toggleSave = (article: Article) => {
    const saving = !savedIds.has(article.id);
    setSavedIds((current) => {
      const next = new Set(current);
      saving ? next.add(article.id) : next.delete(article.id);
      return next;
    });
    setSavedArticles((current) =>
      saving
        ? mergeArticles(current, [article])
        : current.filter((a) => a.id !== article.id),
    );
  };
  const directory = useMemo(() => {
    const counts = new Map<string, number>();
    const sources = new Map<string, DirectorySource>(
      SOURCE_CATALOG.filter((s) => s.kind !== "radar").map((s) => [
        s.id,
        { ...s, count: 0, status: statuses[s.id] },
      ]),
    );
    for (const article of articles) {
      counts.set(article.sourceId, (counts.get(article.sourceId) ?? 0) + 1);
      if (!sources.has(article.sourceId))
        sources.set(article.sourceId, {
          id: article.sourceId,
          name: article.sourceName,
          homepage: article.sourceHomepage,
          region: article.region,
          country: article.country,
          language: article.language,
          kind: article.kind,
          ideologies: article.ideologies,
          tags: article.topics,
          priority: 1,
          count: 0,
          discovered: true,
        });
    }
    return Array.from(sources.values())
      .map((s) => ({ ...s, count: counts.get(s.id) ?? 0 }))
      .sort(
        (a, b) =>
          Number(b.language === preferredLanguage) -
            Number(a.language === preferredLanguage) ||
          a.name.localeCompare(b.name, "it"),
      );
  }, [articles, statuses, preferredLanguage]);
  const visibleSources = useMemo(
    () =>
      directory.filter(
        (s) =>
          (region === ALL || s.region === region) &&
          (language === ALL || s.language === language) &&
          (kind === ALL || s.kind === kind) &&
          (ideology === ALL || s.ideologies.includes(ideology)) &&
          (!query.trim() ||
            `${s.name} ${s.country} ${s.tags.join(" ")} ${s.ideologies.join(" ")}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())),
      ),
    [directory, region, language, kind, ideology, query],
  );
  const languages = useMemo(
    () => [...new Set(SOURCE_CATALOG.map((s) => s.language))].sort(),
    [],
  );
  const ideologies = useMemo(
    () =>
      [...new Set(SOURCE_CATALOG.flatMap((s) => s.ideologies))]
        .filter((i) => i !== "radar" && i !== "trasversale")
        .sort(),
    [],
  );
  const countries = new Set(
    SOURCE_CATALOG.filter((s) => s.kind !== "radar").map((s) => s.country),
  ).size;
  const okCount = new Set(articles.map((article) => article.sourceId)).size;
  const failedCount = Object.values(statuses).filter((s) => !s.ok).length;
  const filterCount =
    [region, language, kind, ideology, topic, sourceId].filter((f) => f !== ALL)
      .length + (query ? 1 : 0);
  const heading = HEADINGS[view];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#letture">
        Vai ai contenuti
      </a>
      <header className="site-header">
        <div className="utility-bar">
          <span>{dateLabel}</span>
          <span>
            <span className="live-dot" /> Fonti aperte. Sguardo internazionale.
          </span>
        </div>
        <div className="masthead">
          <button
            className="wordmark"
            onClick={() => navigate("notizie")}
            aria-label="Rassegna Rossa, pagina iniziale"
          >
            <span className="brand-symbol" aria-hidden="true">
              <Globe2 size={30} strokeWidth={1.3} />
            </span>
            <span>
              rassegna<span className="wordmark-red">rossa</span>
              <span className="brand-period">.</span>
            </span>
          </button>
          <p className="brand-note">
            Le notizie passano.
            <br />
            <strong>Le connessioni restano.</strong>
          </p>
        </div>
        <nav className="main-nav" aria-label="Navigazione principale">
          <div className="nav-links">
            {NAV.map((item) => (
              <button
                key={item.id}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => navigate(item.id)}
              >
                {item.label}
                {item.id === "salvati" && savedIds.size > 0 ? (
                  <span className="nav-count">{savedIds.size}</span>
                ) : null}
              </button>
            ))}
          </div>
          <span className="nav-caption">
            Un osservatorio, molte voci <ArrowUpRight size={14} />
          </span>
        </nav>
      </header>

      <main>
        <section
          className={`editorial-hero ${view !== "notizie" ? "hero-compact" : ""}`}
          aria-labelledby="page-title"
        >
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="small-square" /> {heading.overline}
            </p>
            <h1 id="page-title">{heading.title}</h1>
            <p className="hero-description">{heading.description}</p>
            {view === "notizie" ? (
              <div className="hero-links">
                <a href="#letture" className="button button-dark">
                  Entra nella rassegna <ArrowDown size={16} />
                </a>
                <button
                  className="text-link"
                  onClick={() => navigate("teoria")}
                >
                  Esplora la biblioteca <ArrowUpRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
          {view === "notizie" ? (
            <div className="hero-art" aria-hidden="true">
              <OrbitalGlobe />
              <span className="globe-note">
                NESSUN CONFINE
                <br />
                ALLA COMPRENSIONE.
              </span>
              <span className="globe-coordinate">
                RR / OSSERVATORIO GLOBALE
              </span>
            </div>
          ) : (
            <div className="hero-index" aria-hidden="true">
              {view === "fonti"
                ? "02"
                : view === "teoria"
                  ? "03"
                  : view === "salvati"
                    ? "04"
                    : "05"}
              <span>RASSEGNA ROSSA</span>
            </div>
          )}
        </section>

        <div className="edition-line">
          <span>
            <span className="live-dot" />{" "}
            {loading
              ? "Raccolta delle notizie in corso"
              : "Una rete di prospettive"}
          </span>
          <span>
            {directory.filter((s) => !s.discovered).length} testate e canali{" "}
            <i>/</i> {countries} paesi <i>/</i> {languages.length} lingue
          </span>
          <button onClick={() => navigate("metodo")}>
            Come leggiamo le fonti <ArrowUpRight size={14} />
          </button>
        </div>

        {view === "notizie" ? (
          <section className="dossier-strip" aria-label="Percorsi tematici">
            {DOSSIERS.slice(0, 4).map((d) => (
              <button
                key={d.id}
                onClick={() => pickTopic(d.id)}
                className={topic === d.id ? "active" : ""}
              >
                <span>{d.number} / ESPLORA</span>
                <strong>{d.short}</strong>
                <ArrowUpRight size={18} />
              </button>
            ))}
          </section>
        ) : null}

        <section
          id="letture"
          className="reading-section"
          aria-label="Contenuti della rassegna"
        >
          {view === "notizie" || view === "salvati" || view === "fonti" ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    {view === "fonti"
                      ? "L’INFORMAZIONE HA UN’ORIGINE"
                      : view === "salvati"
                        ? "IL TEMPO DI APPROFONDIRE"
                        : "DALLA RETE AL CONTESTO"}
                  </p>
                  <h2>
                    {view === "notizie"
                      ? "La rassegna"
                      : view === "salvati"
                        ? "Le tue letture"
                        : "Atlante delle fonti"}
                    <span className="section-count">
                      {view === "fonti"
                        ? visibleSources.length
                        : filtered.length}
                    </span>
                  </h2>
                </div>
                {view !== "salvati" ? (
                  <button
                    className="button button-outline"
                    disabled={loading}
                    onClick={() =>
                      void refresh(
                        filterCount && eligibleSources.length
                          ? "selection"
                          : "all",
                      )
                    }
                  >
                    {loading ? (
                      <Loader2 size={15} className="spin" />
                    ) : (
                      <RefreshCcw size={15} />
                    )}
                    <span>
                      {loading ? "Aggiornamento" : "Aggiorna notizie"}
                    </span>
                  </button>
                ) : (
                  <span className="local-note">
                    <Bookmark size={15} /> Solo in questo browser
                  </span>
                )}
              </div>
              <div className="language-priority">
                <label>
                  <Languages size={16} />
                  <span>Prima i titoli in</span>
                  <select
                    aria-label="Lingua da mettere in evidenza"
                    value={preferredLanguage}
                    onChange={(event) => choosePriority(event.target.value)}
                  >
                    <option value={ALL}>Tutte le lingue</option>
                    {languages.map((code) => (
                      <option key={code} value={code}>
                        {LANGUAGES[code] ?? code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  Preferenza del browser, modificabile. Le altre lingue restano
                  disponibili.
                </span>
              </div>
              {view === "notizie" ? (
                <div
                  className="source-shortcuts"
                  aria-label="Fonti in evidenza"
                >
                  {["ottolina", "dazibao", "ottolina-dazibao"].map((id) => {
                    const source = SOURCE_CATALOG.find(
                      (item) => item.id === id,
                    )!;
                    return (
                      <div key={id}>
                        <button onClick={() => openSource(id)}>
                          <Newspaper size={15} />
                          {source.name}
                          <ArrowRight size={14} />
                        </button>
                        <a
                          href={source.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Apri direttamente ${source.name}`}
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    );
                  })}
                  <button
                    className="text-link"
                    onClick={() => navigate("fonti")}
                  >
                    Tutte le{" "}
                    {directory.filter((source) => !source.discovered).length}{" "}
                    fonti <ArrowUpRight size={14} />
                  </button>
                </div>
              ) : null}
              <div className="filter-toolbar">
                <label className="search-box">
                  <Search size={18} />
                  <input
                    id="rassegna-search"
                    aria-label={
                      view === "fonti" ? "Cerca fonti" : "Cerca articoli"
                    }
                    placeholder={
                      view === "fonti"
                        ? "Cerca una fonte, un paese…"
                        : "Cerca notizie, fonti, parole chiave…"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query ? (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Cancella ricerca"
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <kbd>/</kbd>
                  )}
                </label>
                <label className="inline-select">
                  <Globe2 size={16} />
                  <span className="sr-only">Area geografica</span>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value={ALL}>Tutto il mondo</option>
                    {REGION_ORDER.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                {view === "notizie" ? (
                  <label className="inline-select">
                    <span className="sr-only">Periodo</span>
                    <select
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    >
                      <option value="1">Ultime 24 ore</option>
                      <option value="7">Ultimi 7 giorni</option>
                      <option value="30">Ultimi 30 giorni</option>
                      <option value="Infinity">Tutte le date</option>
                    </select>
                    <ChevronDown size={14} />
                  </label>
                ) : null}
                <button
                  className={`filter-toggle ${filtersOpen ? "active" : ""}`}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  aria-expanded={filtersOpen}
                  aria-controls="advanced-filters"
                >
                  <SlidersHorizontal size={16} /> Filtri{" "}
                  {filterCount > 0 ? <span>{filterCount}</span> : null}
                </button>
              </div>
              {filtersOpen ? (
                <div id="advanced-filters" className="advanced-filters">
                  <Select label="Lingua" value={language} change={setLanguage}>
                    <option value={ALL}>Tutte le lingue</option>
                    {languages.map((l) => (
                      <option value={l} key={l}>
                        {LANGUAGES[l] ?? l.toUpperCase()}
                      </option>
                    ))}
                  </Select>
                  <Select label="Tipo di fonte" value={kind} change={setKind}>
                    <option value={ALL}>Tutti i tipi</option>
                    {[...new Set(directory.map((s) => s.kind))].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </Select>
                  <Select
                    label="Orientamento dichiarato nel catalogo"
                    value={ideology}
                    change={setIdeology}
                  >
                    <option value={ALL}>Tutti gli orientamenti</option>
                    {ideologies.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </Select>
                  {view !== "fonti" ? (
                    <Select label="Ordina per" value={sort} change={setSort}>
                      <option value="fresh">Più recenti</option>
                      <option value="score">Punteggio tematico</option>
                      <option value="source">Nome della fonte</option>
                    </Select>
                  ) : null}
                  <button className="text-link" onClick={reset}>
                    <X size={14} /> Azzera filtri
                  </button>
                </div>
              ) : null}
              {view !== "fonti" ? (
                <div className="topic-tabs" aria-label="Argomenti">
                  <button
                    onClick={() => setTopic(ALL)}
                    aria-pressed={topic === ALL}
                  >
                    Tutti i temi
                  </button>
                  {TOPIC_TAXONOMY.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      aria-pressed={topic === t.id}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {sourceId !== ALL ? (
                <div className="active-source">
                  <Newspaper size={16} />
                  <span>
                    Fonte:{" "}
                    <strong>
                      {directory.find((s) => s.id === sourceId)?.name ??
                        sourceId}
                    </strong>
                  </span>
                  <button
                    onClick={() => setSourceId(ALL)}
                    aria-label="Mostra tutte le fonti"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}
              {storageWarning ? (
                <p className="notice" role="status">
                  Il browser non ha consentito l’accesso ai salvataggi. Puoi
                  continuare a leggere, ma i nuovi preferiti potrebbero non
                  restare dopo la chiusura.
                </p>
              ) : null}
              {refreshNotice ? (
                <p className="notice" role="status">
                  {refreshNotice}
                </p>
              ) : null}
              {loading && view !== "salvati" ? (
                <div className="sync-progress" role="status">
                  <div>
                    <span>
                      <Loader2 size={13} className="spin" /> Le notizie arrivano
                      progressivamente
                    </span>
                    <span>
                      {progress.done} / {progress.total} canali{" "}
                      <button onClick={stopRefresh}>Interrompi</button>
                    </span>
                  </div>
                  <progress
                    value={progress.done}
                    max={progress.total || 1}
                    aria-label="Raccolta dei canali"
                  />
                </div>
              ) : null}
              {view === "fonti" ? (
                <SourcesDirectory
                  sources={visibleSources}
                  onSelect={openSource}
                />
              ) : (
                <div className="news-layout">
                  <div className="news-main">
                    {topic !== ALL ? (
                      <div className="topic-intro">
                        <p className="eyebrow">PERCORSO TEMATICO</p>
                        <h3>
                          {DOSSIERS.find((d) => d.id === topic)?.title ??
                            TOPIC_TAXONOMY.find((t) => t.id === topic)?.label}
                        </h3>
                        <p>
                          {DOSSIERS.find((d) => d.id === topic)?.description ??
                            "Una selezione automatica dai feed: confronta le voci e risali sempre alla fonte originale."}
                        </p>
                      </div>
                    ) : null}
                    <div className="news-grid" aria-label="Articoli">
                      {filtered.slice(0, visibleCount).map((article, index) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          featured={index === 0 && view === "notizie"}
                          saved={savedIds.has(article.id)}
                          onSelect={() => setSelectedId(article.id)}
                          onSave={() => toggleSave(article)}
                        />
                      ))}
                    </div>
                    {!filtered.length ? (
                      <EmptyState
                        loading={loading && view !== "salvati"}
                        saved={view === "salvati"}
                        filtered={filterCount > 0 || topic !== ALL}
                        onReset={reset}
                        onExplore={() =>
                          navigate(view === "salvati" ? "notizie" : "fonti")
                        }
                        onRetry={() =>
                          void refresh(
                            filterCount && eligibleSources.length
                              ? "selection"
                              : "all",
                          )
                        }
                      />
                    ) : null}
                    {filtered.length > visibleCount ? (
                      <button
                        className="button button-outline load-more"
                        onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                      >
                        Altri{" "}
                        {Math.min(PAGE_SIZE, filtered.length - visibleCount)}{" "}
                        articoli <ArrowDown size={16} />
                        <span>
                          {visibleCount} di {filtered.length}
                        </span>
                      </button>
                    ) : null}
                    {view === "notizie" ? (
                      <div className="collection-more">
                        <p>
                          {attemptedIds.size} canali già consultati o presenti
                          in memoria. Il catalogo completo è già disponibile
                          nell’atlante.
                        </p>
                        <button
                          className="button button-dark"
                          disabled={
                            loading ||
                            !eligibleSources.some(
                              (source) => !attemptedIds.has(source.id),
                            )
                          }
                          onClick={() => void refresh("more")}
                        >
                          Carica altre fonti <ArrowDown size={16} />
                        </button>
                        <button
                          className="text-link"
                          onClick={() => navigate("fonti")}
                        >
                          Esplora tutte le testate <ArrowUpRight size={15} />
                        </button>
                        {newsUpdatedAt ? (
                          <small>
                            Ultime notizie recuperate:{" "}
                            {relativeTime(
                              new Date(newsUpdatedAt).toISOString(),
                            )}
                            . Le schede in memoria possono precedere l’ultimo
                            tentativo.
                          </small>
                        ) : null}
                      </div>
                    ) : null}
                    {!loading && failedCount > 0 && view === "notizie" ? (
                      <p className="feed-note">
                        <CircleHelp size={15} /> {failedCount} canali non hanno
                        risposto. Le notizie disponibili restano leggibili.{" "}
                        <button onClick={() => navigate("fonti")}>
                          Consulta le fonti
                        </button>
                      </p>
                    ) : null}
                  </div>
                  <aside
                    className="editorial-sidebar"
                    aria-label="Per orientarti"
                  >
                    <div className="sidebar-section">
                      <p className="eyebrow">IL FILO DELLE NOTIZIE</p>
                      <h3>
                        Segui una domanda.
                        <br />
                        <em>Non solo un titolo.</em>
                      </h3>
                      <div className="sidebar-topics">
                        {DOSSIERS.map((d) => (
                          <button key={d.id} onClick={() => pickTopic(d.id)}>
                            <span>{d.number}</span>
                            <strong>{d.title}</strong>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="library-promo">
                      <BookOpen size={26} strokeWidth={1.3} />
                      <p className="eyebrow">OLTRE L’ATTUALITÀ</p>
                      <h3>
                        Le idee hanno
                        <br />
                        una storia.
                      </h3>
                      <p>
                        Dieci punti di partenza, tre percorsi. Da Marx alla
                        riproduzione sociale.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => navigate("teoria")}
                      >
                        Apri la biblioteca <ArrowRight size={16} />
                      </button>
                      <span className="promo-letter" aria-hidden="true">
                        R
                      </span>
                    </div>
                    <div className="sidebar-section network-note">
                      <p className="eyebrow">L’OSSERVATORIO</p>
                      <div>
                        <strong>{okCount}</strong>
                        <span>
                          fonti rappresentate
                          <br />
                          nelle notizie recuperate
                        </span>
                      </div>
                      <p>
                        {RADAR_CHANNEL_COUNT} canali radar affiancano le fonti
                        del catalogo. Sono strumenti di ricerca, non editori né
                        garanzie di attendibilità.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => navigate("metodo")}
                      >
                        Leggi il metodo <ArrowUpRight size={14} />
                      </button>
                      {lastRefresh ? (
                        <small>
                          Ultimo tentativo: {relativeTime(lastRefresh)}
                        </small>
                      ) : null}
                    </div>
                  </aside>
                </div>
              )}
            </>
          ) : null}
          {view === "teoria" ? (
            <LibraryView query={query} setQuery={setQuery} />
          ) : null}
          {view === "metodo" ? (
            <MethodView onSources={() => navigate("fonti")} />
          ) : null}
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <span className="footer-brand">
            rassegna<span>rossa.</span>
          </span>
          <p>
            Per capire il mondo,
            <br />
            mettiamo in relazione le sue voci.
          </p>
          <button className="text-link" onClick={() => navigate("metodo")}>
            Il progetto e il metodo <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="footer-bottom">
          <span>Aggregatore socialista globale · Notizie, teoria, fonti.</span>
          <span>
            Ogni contenuto appartiene alla sua fonte. I salvati restano nel tuo
            browser.
          </span>
        </div>
      </footer>
      <dialog
        ref={readerDialog}
        className="reader-dialog"
        aria-labelledby="reader-title"
        onClose={() => setSelectedId(null)}
        onCancel={() => setSelectedId(null)}
      >
        {selectedArticle ? (
          <ArticleReader
            key={selectedArticle.id}
            article={selectedArticle}
            saved={savedIds.has(selectedArticle.id)}
            onSave={() => toggleSave(selectedArticle)}
            onClose={() => readerDialog.current?.close()}
            related={articles
              .filter(
                (a) =>
                  a.sourceId === selectedArticle.sourceId &&
                  a.id !== selectedArticle.id,
              )
              .slice(0, 3)}
            onSelect={setSelectedId}
          />
        ) : null}
      </dialog>
    </div>
  );
}

function Select({
  label,
  value,
  change,
  children,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => change(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function OrbitalGlobe() {
  return (
    <svg viewBox="0 0 500 370" className="orbital-globe">
      <defs>
        <clipPath id="globe-clip">
          <circle cx="255" cy="180" r="139" />
        </clipPath>
        <pattern
          id="globe-dots"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1" fill="currentColor" opacity=".28" />
        </pattern>
      </defs>
      <circle cx="255" cy="180" r="139" fill="url(#globe-dots)" />
      <g fill="none" stroke="currentColor" strokeWidth=".8" opacity=".65">
        <circle cx="255" cy="180" r="139" />
        <ellipse cx="255" cy="180" rx="94" ry="139" />
        <ellipse cx="255" cy="180" rx="44" ry="139" />
        <ellipse cx="255" cy="180" rx="139" ry="46" />
        <ellipse cx="255" cy="180" rx="139" ry="96" />
        <path d="M116 180h278M255 41v278" />
      </g>
      <g clipPath="url(#globe-clip)" fill="currentColor" opacity=".85">
        <path d="m163 86 27-19 31 10 4 24-17 13 3 21-15 13-6 24-23-8-8-31-17-19zm29 95 29 8 13 26-6 30-17 25-7 28-15-16 3-33-15-31zM263 89l24-11 13 16 25-3 9 12 24 1 31 20-11 21-29 3-15-13-20 7-14-17-22 4-5-19-19-1zm7 49 28 2 21 22-5 36-17 31-19-13-7-32-16-20zm73 29 16-10 14 20-4 22-14-5zm5 76 24-9 22 16-5 22-27-3-20-12z" />
      </g>
      <g fill="none" stroke="currentColor">
        <ellipse
          cx="255"
          cy="180"
          rx="221"
          ry="69"
          transform="rotate(-28 255 180)"
          strokeWidth="1.3"
        />
        <ellipse
          cx="255"
          cy="180"
          rx="204"
          ry="91"
          transform="rotate(34 255 180)"
          strokeDasharray="3 6"
          opacity=".6"
        />
      </g>
      <circle cx="100" cy="251" r="5" fill="currentColor" />
      <circle cx="420" cy="109" r="7" fill="currentColor" />
      <path
        d="M100 251h-42v29M420 109h32V79"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
      />
    </svg>
  );
}

function ArticleCard({
  article,
  featured = false,
  saved,
  onSelect,
  onSave,
}: {
  article: Article;
  featured?: boolean;
  saved: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = safeWebUrl(article.image);
  return (
    <article className={`article-card ${featured ? "featured" : ""}`}>
      <button className="article-open" onClick={onSelect}>
        {image && !imageFailed ? (
          <div className="article-image">
            <img
              src={image}
              alt=""
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
            <span className="image-category">{article.region}</span>
          </div>
        ) : featured ? (
          <div className="article-typographic" aria-hidden="true">
            <Globe2 size={80} strokeWidth={0.5} />
            <span>VOCI DAL MONDO</span>
          </div>
        ) : null}
        <div className="article-copy">
          <div className="article-meta">
            <span>{article.sourceName}</span>
            <span>
              {article.publishedAt
                ? relativeTime(article.publishedAt)
                : "Data non indicata"}
            </span>
          </div>
          <h3>{article.title}</h3>
          <p>
            {article.excerpt ||
              "Questo feed non fornisce un estratto. Apri la scheda per leggere l’articolo sul sito della fonte."}
          </p>
        </div>
      </button>
      <div className="article-bottom">
        <span>
          {article.country} <i>·</i>{" "}
          {LANGUAGES[article.language] ?? article.language.toUpperCase()}
        </span>
        <div>
          <button
            className={`save-button ${saved ? "is-saved" : ""}`}
            onClick={onSave}
            aria-label={
              saved
                ? `Rimuovi dai salvati: ${article.title}`
                : `Salva articolo: ${article.title}`
            }
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>
          <button
            className="read-button"
            onClick={onSelect}
            aria-label={`Leggi la scheda: ${article.title}`}
          >
            <ArrowUpRight size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  loading,
  saved,
  filtered,
  onReset,
  onExplore,
  onRetry,
}: {
  loading: boolean;
  saved: boolean;
  filtered: boolean;
  onReset: () => void;
  onExplore: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        {loading ? (
          <Loader2 size={27} className="spin" />
        ) : saved ? (
          <Bookmark size={27} />
        ) : (
          <Search size={27} />
        )}
      </span>
      <p className="eyebrow">
        {loading
          ? "COLLEGHIAMO LE FONTI"
          : saved
            ? "IL TUO TACCUINO"
            : "UNO SGUARDO PIÙ AMPIO"}
      </p>
      <h3>
        {loading
          ? "Le prime voci stanno arrivando."
          : saved
            ? "Le letture importanti, tutte qui."
            : "Nessun articolo in questa selezione."}
      </h3>
      <p>
        {loading
          ? "Ogni fonte ha i suoi tempi. Gli articoli compariranno appena disponibili; nel frattempo puoi esplorare il catalogo e la biblioteca."
          : saved
            ? "Usa il segnalibro sulle schede per conservare titolo, estratto e link. I vecchi segnalibri saranno recuperati quando le relative notizie torneranno nei feed."
            : "Prova un altro tema, una finestra temporale più ampia oppure consulta direttamente le fonti. L’assenza di risultati non significa assenza di notizie."}
      </p>
      <div className="empty-actions">
        {filtered ? (
          <button className="button button-dark" onClick={onReset}>
            Azzera filtri <X size={14} />
          </button>
        ) : null}
        <button className="button button-outline" onClick={onExplore}>
          {saved ? "Esplora le notizie" : "Esplora le fonti"}
          <ArrowRight size={15} />
        </button>
        {!saved && !loading ? (
          <button className="text-link" onClick={onRetry}>
            <RefreshCcw size={14} /> Riprova aggiornamento
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SourcesDirectory({
  sources,
  onSelect,
}: {
  sources: DirectorySource[];
  onSelect: (id: string) => void;
}) {
  const [limit, setLimit] = useState(36);
  return (
    <>
      <div className="directory-intro">
        <p>
          Ogni fonte ha una storia e un punto di vista. Le etichette sono
          classificazioni del catalogo, non certificazioni editoriali. Le fonti
          emerse dai radar sono indicate separatamente.
        </p>
        <span>
          <span className="status-dot status-ok" /> Contenuti disponibili{" "}
          <span className="status-dot status-wait" /> Non verificato o non
          disponibile
        </span>
      </div>
      <div className="source-grid">
        {sources.slice(0, limit).map((s) => (
          <article className="source-card" key={s.id}>
            <div className="source-card-top">
              <span className="source-monogram" aria-hidden="true">
                {s.name
                  .replace(/^(the|il|la|le) /i, "")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span
                className={`source-availability ${(s.status ? s.status.ok : s.count > 0) ? "available" : ""}`}
              >
                <span
                  className={`status-dot ${(s.status ? s.status.ok : s.count > 0) ? "status-ok" : "status-wait"}`}
                />
                {s.status && !s.status.ok
                  ? "Ultimo tentativo fallito"
                  : s.count
                    ? `${s.count} articoli`
                    : s.status?.ok
                      ? "Contenuti disponibili"
                      : "Non ancora verificato"}
              </span>
            </div>
            <span className="source-region">
              {s.region} / {s.country}
            </span>
            <h3>{s.name}</h3>
            <p>
              {LANGUAGES[s.language] ?? s.language.toUpperCase()} <i>·</i>{" "}
              {s.kind}
              {s.discovered ? " · Emersa dal radar" : ""}
            </p>
            <div className="source-tags">
              {s.ideologies.slice(0, 3).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="source-card-actions">
              <button className="text-link" onClick={() => onSelect(s.id)}>
                Leggi le notizie <ArrowRight size={15} />
              </button>
              <a
                href={safeWebUrl(s.homepage) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Apri il sito di ${s.name}`}
              >
                <ExternalLink size={17} />
              </a>
            </div>
          </article>
        ))}
      </div>
      {!sources.length ? (
        <p className="notice">
          Nessuna fonte corrisponde alla ricerca. Prova un altro paese, una
          lingua diversa o azzera i filtri.
        </p>
      ) : null}
      {sources.length > limit ? (
        <button
          className="button button-outline load-more"
          onClick={() => setLimit((n) => n + 36)}
        >
          Mostra altre fonti <ArrowDown size={15} />
        </button>
      ) : null}
    </>
  );
}

function LibraryView({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (s: string) => void;
}) {
  const [path, setPath] = useState("all");
  const active = READING_PATHS.find((p) => p.id === path);
  const books = THEORY_LIBRARY.filter(
    (book) =>
      (!active || active.books.includes(book.id)) &&
      `${book.title} ${book.author} ${book.summary} ${book.tags.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="library-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">NON SERVE LEGGERE TUTTO. SERVE INIZIARE.</p>
          <h2>Tre percorsi, molte domande.</h2>
        </div>
        <BookOpen size={24} strokeWidth={1.3} />
      </div>
      <div className="reading-paths">
        {READING_PATHS.map((p, i) => (
          <button
            className={`reading-path ${path === p.id ? "active" : ""}`}
            key={p.id}
            onClick={() => setPath(path === p.id ? ALL : p.id)}
            aria-pressed={path === p.id}
          >
            <span className="path-number">0{i + 1}</span>
            <span className="eyebrow">{p.subtitle}</span>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <span className="path-link">
              {p.books.length} letture <ArrowUpRight size={17} />
            </span>
          </button>
        ))}
      </div>
      <div className="library-toolbar">
        <div>
          <p className="eyebrow">TESTI E ORIZZONTI</p>
          <h2>{active?.title ?? "La biblioteca aperta"}</h2>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            aria-label="Cerca nella biblioteca"
            placeholder="Un autore, un testo, un concetto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {active ? (
          <button className="text-link" onClick={() => setPath(ALL)}>
            Tutti i testi <X size={15} />
          </button>
        ) : null}
      </div>
      <div className="book-grid">
        {books.map((book, index) => (
          <article className="book-card" key={book.id}>
            <div
              className={`book-cover book-tone-${index % 4}`}
              aria-hidden="true"
            >
              <span>LA BIBLIOTECA / RASSEGNA ROSSA</span>
              <strong>{book.title}</strong>
              <em>{book.author}</em>
              <span className="cover-year">{book.period}</span>
            </div>
            <div className="book-info">
              <p className="eyebrow">{book.lane}</p>
              <h3>{book.title}</h3>
              <p className="book-author">
                {book.author} · {book.period}
              </p>
              <p>{book.summary}</p>
              <div className="book-links">
                {book.links.map((link) => (
                  <a
                    href={link.url}
                    key={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                    <ArrowUpRight size={15} />
                  </a>
                ))}
              </div>
              <small>
                {["dipendenza", "femminismo-marxista"].includes(book.id)
                  ? "Percorso tematico: i link portano a riviste e archivi di approfondimento."
                  : book.id === "gramsciana"
                    ? "Il link porta alla Fondazione Gramsci, non al testo integrale dei Quaderni."
                    : "Testo disponibile presso l’archivio esterno indicato."}
              </small>
            </div>
          </article>
        ))}
      </div>
      {!books.length ? (
        <div className="notice">
          Nessun testo trovato. Prova un altro autore o cancella la ricerca.
        </div>
      ) : null}
      <section className="glossary">
        <div>
          <p className="eyebrow">LE PAROLE PER ORIENTARSI</p>
          <h2>
            Un piccolo lessico,
            <br />
            <em>una porta d’ingresso.</em>
          </h2>
          <p>
            Definizioni introduttive, non esaustive. I concetti assumono
            significati diversi nelle diverse tradizioni: i testi sono il luogo
            per approfondirli.
          </p>
        </div>
        <div>
          {GLOSSARY.map((g) => (
            <details key={g.term}>
              <summary>
                {g.term}
                <span>+</span>
              </summary>
              <p>{g.definition}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function MethodView({ onSources }: { onSources: () => void }) {
  return (
    <div className="method-view">
      <div className="method-intro">
        <p className="eyebrow">DALLE FONTI ALLE DOMANDE</p>
        <h2>
          Una rassegna per leggere.
          <br />
          <em>Non un verdetto su cosa pensare.</em>
        </h2>
        <p>
          Mettiamo vicine prospettive che spesso restano lontane: il lavoro e la
          geopolitica, l’attualità e la teoria, le voci locali e le relazioni
          globali. La selezione ha un orientamento esplicito. Non pretende di
          rappresentare tutte le posizioni né di sostituire il confronto con le
          fonti.
        </p>
      </div>
      <div className="method-grid">
        {[
          {
            n: "01",
            title: "Da dove arrivano le notizie",
            text: "Un catalogo di fonti e canali radar alimenta la raccolta tramite feed RSS e Atom. Per i canali YouTube configurati, leggiamo anche i titoli pubblici nella pagina dei video quando il feed non è utilizzabile. I radar sono ricerche tematiche: possono far emergere editori non inclusi nel catalogo. Una corrispondenza con una parola chiave non prova un orientamento politico.",
          },
          {
            n: "02",
            title: "Come sono organizzate",
            text: "Titoli ed estratti vengono ordinati per data, filtrati per provenienza e classificati con parole chiave. Il punteggio tematico è un’euristica, non una misura di verità, qualità o rilevanza assoluta. Una data mancante o errata può influire sull’ordine.",
          },
          {
            n: "03",
            title: "Cosa puoi leggere qui",
            text: "Ogni scheda offre ciò che il feed rende disponibile, con il link all’articolo originale. Non ospitiamo una copia integrale autorevole. Alcuni editori limitano estratti o anteprime: il sito originale resta il riferimento.",
          },
          {
            n: "04",
            title: "Traduzioni e servizi esterni",
            text: "La traduzione della scheda invia titolo ed estratto a MyMemory su tua richiesta e può contenere errori. La traduzione della pagina apre Google Translate. Immagini e anteprime possono comportare richieste ai siti degli editori.",
          },
          {
            n: "05",
            title: "Il tuo taccuino resta tuo",
            text: "I salvati sono memorizzati in localStorage, solo in questo browser. Una cache temporanea delle schede dei feed velocizza le visite successive; la priorità linguistica segue le preferenze del browser ed è modificabile. Non sono sincronizzati e non richiedono un account. Cancellare i dati del browser elimina anche le schede salvate. Non conserviamo una cronologia personale di lettura sul server.",
          },
          {
            n: "06",
            title: "Disponibilità, attribuzione, limiti",
            text: "I feed possono cambiare, non rispondere o essere incompleti. Le cache sono temporanee e ogni aggiornamento è un tentativo di raccolta. Testi e immagini appartengono ai rispettivi titolari: la presenza in rassegna non implica adesione dell’editore al progetto.",
          },
        ].map((item) => (
          <article key={item.n}>
            <span>{item.n}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <div className="method-outro">
        <Globe2 size={34} strokeWidth={1} />
        <div>
          <h3>Parti dalle voci.</h3>
          <p>Scopri chi pubblica, da dove scrive e con quale prospettiva.</p>
        </div>
        <button className="button button-dark" onClick={onSources}>
          Esplora le fonti <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ArticleReader({
  article,
  saved,
  onSave,
  onClose,
  related,
  onSelect,
}: {
  article: Article;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  related: Article[];
  onSelect: (id: string) => void;
}) {
  const [translation, setTranslation] = useState<{
    status: string;
    text: string;
  }>({ status: "idle", text: "" });
  const [embed, setEmbed] = useState(false);
  const translate = async () => {
    setTranslation({ status: "loading", text: "" });
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `${article.title}. ${article.excerpt}`,
          from: article.language,
          to: "it",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.translatedText)
        throw new Error(
          "Traduzione non disponibile. Puoi continuare a leggere il testo originale.",
        );
      setTranslation({ status: "ready", text: result.translatedText });
    } catch {
      setTranslation({
        status: "error",
        text: "La traduzione non è disponibile in questo momento. Riprova oppure apri l’originale.",
      });
    }
  };
  return (
    <div className="article-reader">
      <div className="reader-top">
        <span className="eyebrow">LA SCHEDA / RASSEGNA ROSSA</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Chiudi lettura"
          autoFocus
        >
          <X size={21} />
        </button>
      </div>
      <div className="reader-content">
        <div className="reader-meta">
          <span>{article.sourceName}</span>
          <span>{article.country}</span>
          <span>
            {article.publishedAt
              ? relativeTime(article.publishedAt)
              : "Data non indicata"}
          </span>
        </div>
        <h2 id="reader-title">{article.title}</h2>
        <p className="reader-byline">
          {article.author ? `${article.author} · ` : ""}
          {LANGUAGES[article.language] ?? article.language.toUpperCase()}
        </p>
        <p className="reader-excerpt">
          {article.excerpt ||
            "La fonte non fornisce un estratto per questo articolo. Il testo completo è disponibile sul sito dell’editore."}
        </p>
        <div className="reader-actions">
          <a
            href={safeWebUrl(article.link) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-dark"
          >
            Leggi sulla fonte <ArrowUpRight size={16} />
          </a>
          <button
            className={`button button-outline ${saved ? "is-saved" : ""}`}
            onClick={onSave}
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {saved ? "Salvato" : "Salva lettura"}
          </button>
        </div>
        <div className="reader-translation">
          <div>
            <Languages size={19} />
            <strong>Una lingua in più, una distanza in meno.</strong>
          </div>
          <p>
            Traduci titolo ed estratto in italiano con MyMemory. Il testo viene
            inviato al servizio esterno e la traduzione può contenere errori.
          </p>
          <button
            className="text-link"
            onClick={() => void translate()}
            disabled={translation.status === "loading"}
          >
            {translation.status === "loading" ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Languages size={15} />
            )}
            {translation.status === "loading"
              ? "Traduzione in corso…"
              : translation.status === "ready"
                ? "Traduci di nuovo"
                : "Traduci la scheda"}
          </button>
          {translation.status === "ready" || translation.status === "error" ? (
            <p
              className={`translation-result ${translation.status}`}
              role="status"
            >
              {translation.text}
            </p>
          ) : null}
          <a
            href={`https://translate.google.com/translate?sl=${encodeURIComponent(article.language)}&tl=it&u=${encodeURIComponent(safeWebUrl(article.link) ?? "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Apri la pagina con Google Translate <ArrowUpRight size={14} />
          </a>
        </div>
        <details className="reader-embed">
          <summary>
            Anteprima del sito originale <ChevronDown size={16} />
          </summary>
          <p>
            Caricando l’anteprima contatti il sito della fonte. Alcuni editori
            bloccano l’incorporamento: in quel caso usa “Leggi sulla fonte”.
          </p>
          {embed ? (
            <iframe
              title={`Anteprima: ${article.title}`}
              src={safeWebUrl(article.link) ?? undefined}
              sandbox="allow-scripts allow-popups allow-forms"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <button
              className="button button-outline"
              onClick={() => setEmbed(true)}
            >
              Carica anteprima esterna <ExternalLink size={15} />
            </button>
          )}
        </details>
        {related.length ? (
          <section className="reader-related">
            <p className="eyebrow">DALLA STESSA FONTE</p>
            {related.map((a) => (
              <button key={a.id} onClick={() => onSelect(a.id)}>
                <span>{a.title}</span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </section>
        ) : null}
        <p className="reader-attribution">
          Titolo ed estratto sono attribuiti a {article.sourceName}. La fonte
          originale rimane il riferimento per contenuto completo, aggiornamenti
          e correzioni.
        </p>
      </div>
    </div>
  );
}

function relativeTime(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "Data non indicata";
  const seconds = Math.round((time - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
  for (const [unit, amount] of [
    ["year", 31536e3],
    ["month", 2592e3],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as [Intl.RelativeTimeFormatUnit, number][])
    if (Math.abs(seconds) >= amount)
      return formatter.format(Math.round(seconds / amount), unit);
  return "ora";
}
