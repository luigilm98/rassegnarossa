"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
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
  lazy,
  Suspense,
  memo,
  useDeferredValue,
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
  type SourceDefinition,
} from "@/app/data/catalog";
import BOOK_IDS from "@/app/data/book-ids.json" with { type: "json" };
import { DOSSIERS } from "@/app/data/editorial";
import {
  filterArticles,
  validateArticles,
  mergeArticles,
  restoreSavedArticles,
  restoreNewsSnapshot,
  safeWebUrl,
  type ReadingArticle as Article,
} from "@/app/lib/reading";
import {
  preferredLanguageFor,
  resolveLanguageChoices,
} from "@/app/lib/source-selection";

import type { SourceStatus } from "@/app/lib/feed";
import { createBatchedSink } from "@/app/lib/batched-sink";
import { CommunityEmblem } from "./CommunityEmblem";
import { QUOTATIONS, nextQuotation } from "@/app/data/quotes";
import { ArticleImage } from "./ArticleImage";
import { InitialLoadBoundary } from "./InitialLoadBoundary";
import { historyId } from "@/app/lib/history-navigation";
import { VideoCarousel } from "./VideoCarousel";
import { WorldWatch } from "./WorldWatch";
import { useStableNews } from "./StableNews";
import { useCloudBookmarks, type RestoredCollection } from "./CloudBookmarks";
import { createPublisherResolver } from "@/app/lib/publisher";
import { useSourceHighlights } from "./SourceHighlights";
import { applySourceImages, highlightLinkKey, rankSourceHighlights } from "@/app/lib/source-highlights";
import {
  LocalizationProvider,
  LocalizedText,
  TranslationNotice,
  useLocale,
  LanguageName,
  LocalizedInput,
} from "./Localization";

import { collectionOrder, collectAll } from "@/app/lib/collection";
import {
  EDITORIAL_AXES,
  editorialAssessment,
  rankEditorial,
  type EditorialAxis,
} from "@/app/lib/editorial-ranking";

type FeedPayload = { articles: Article[]; statuses: SourceStatus[] };
type View = "notizie" | "fonti" | "teoria" | "salvati" | "metodo";
type DirectorySource = SourceDefinition & {
  count: number;
  status?: SourceStatus;
  discovered?: boolean;
};
const ALL = "all";
const validBookIds = new Set(BOOK_IDS);
const LibraryView = lazy(() => import("./LibraryView").then(module => ({ default: module.LibraryView })));
const SavedBooks = lazy(() => import("./LibraryView").then(module => ({ default: module.SavedBooks })));
const publisherFor = createPublisherResolver(SOURCE_CATALOG);
const PAGE_SIZE = 24;
const NAV: { id: View; label: string }[] = [
  { id: "notizie", label: "La rassegna" },
  { id: "fonti", label: "Atlante delle fonti" },
  { id: "teoria", label: "Biblioteca" },
  { id: "salvati", label: "Salvati" },
];
const HEADINGS = {
  notizie: {
    overline: "NOTIZIE · ANALISI · PROSPETTIVE",
    title: "Una citazione per cominciare",
    description:
      "Voci e idee dal lavoro, dai movimenti e dal Sud globale. Una rassegna per collegare le notizie, capire i conflitti, allargare lo sguardo.",
  },
  fonti: {
    overline: "L’ATLANTE",
    title: (
      <>
        <LocalizedText>{"Le voci. I luoghi."}</LocalizedText>
        <br />
        <em>
          <LocalizedText>{"Le prospettive."}</LocalizedText>
        </em>
      </>
    ),
    description:
      "Giornali, riviste, sindacati e movimenti: esplora le fonti per paese, lingua e orientamento. Il punto di partenza di ogni notizia resta visibile.",
  },
  teoria: {
    overline: "LA BIBLIOTECA",
    title: (
      <>
        <LocalizedText>{"Capire il presente."}</LocalizedText>
        <br />
        <em>
          <LocalizedText>{"Leggere in profondità."}</LocalizedText>
        </em>
      </>
    ),
    description:
      "Testi, concetti e percorsi di lettura per dare contesto alle notizie. Una biblioteca aperta, da attraversare un’idea alla volta.",
  },
  salvati: {
    overline: "IL TUO TACCUINO",
    title: (
      <>
        <LocalizedText>{"Le letture che"}</LocalizedText>
        <br />
        <em>
          <LocalizedText>{"vuoi ritrovare."}</LocalizedText>
        </em>
      </>
    ),
    description:
      "Articoli e libri da ritrovare. Accedi con ChatGPT per conservarli nel tuo archivio personale anche dopo la cancellazione dei dati del browser.",
  },
  metodo: {
    overline: "IL PROGETTO",
    title: (
      <>
        <LocalizedText>{"Molte fonti."}</LocalizedText>
        <br />
        <em>
          <LocalizedText>{"Uno sguardo consapevole."}</LocalizedText>
        </em>
      </>
    ),
    description:
      "Internazionale Rossa è uno strumento per orientarsi nell’informazione socialista, comunista, sindacale e anticoloniale. Qui spieghiamo come funziona e quali sono i suoi limiti.",
  },
};

export function AggregatorApp() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [browserLanguage, setBrowserLanguage] = useState("it");
  const [view, setView] = useState<View>("notizie");
  useEffect(() => {
    if (historyId(new URL(window.location.href).searchParams.get("storia"))) setView("teoria");
  }, []);
  const [articles, setArticles] = useState<Article[]>([]);
  const [statuses, setStatuses] = useState<Record<string, SourceStatus>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [savedBooks, setSavedBooks] = useState<Set<string>>(new Set());
  const [storageReady, setStorageReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [region, setRegion] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [ideology, setIdeology] = useState(ALL);
  const [topic, setTopic] = useState(ALL);
  const [sourceId, setSourceId] = useState(ALL);
  const [days, setDays] = useState("30");
  const [sort, setSort] = useState("featured");
  const sourceHighlights = useSourceHighlights(articles, view === "notizie" || view === "salvati");
  const displayArticles = useMemo(() => applySourceImages(articles, sourceHighlights.images), [articles, sourceHighlights.images]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [orderVersion, setOrderVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [initialWindowReady, setInitialWindowReady] = useState(false);
  const [readingChoice, setReadingChoice] = useState("auto");
  const [editorialAxis, setEditorialAxis] = useState<EditorialAxis | "all">(
    "all",
  );
  const preferredRef = useRef("it");
  const hasArticlesRef = useRef(false);
  const collectingRef = useRef(false);
  const [progress, setProgress] = useState({
    done: 0,
    total: SOURCE_CATALOG.length,
  });
  const [dateLabel, setDateLabel] = useState("L’informazione, oltre i confini");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState("it");
  const [newsUpdatedAt, setNewsUpdatedAt] = useState(0);
  const [refreshNotice, setRefreshNotice] = useState("");
  const refreshNumber = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const readerDialog = useRef<HTMLDialogElement>(null);
  const controls = useRef<HTMLDetailsElement>(null);

  const restoreCollection = useCallback((snapshot: RestoredCollection) => {
    const removedArticles = new Set(snapshot.removed.filter(item => item.kind === "article").map(item => item.key));
    const removedBooks = new Set(snapshot.removed.filter(item => item.kind === "book").map(item => item.key));
    setSavedArticles(current => mergeArticles(snapshot.replace ? [] : current, snapshot.articles).filter(article => !removedArticles.has(article.id)));
    setSavedIds(current => new Set([...(snapshot.replace ? [] : current), ...snapshot.articles.map(article => article.id)].filter(id => !removedArticles.has(id))));
    setSavedBooks(current => new Set([...(snapshot.replace ? [] : current), ...snapshot.books].filter(id => validBookIds.has(id) && !removedBooks.has(id))));
  }, []);
  const cloud = useCloudBookmarks({ ready: storageReady, articles: savedArticles, books: useMemo(() => [...savedBooks], [savedBooks]), onRestore: restoreCollection });
  const toggleBook = (id: string) => {
    const saving = !savedBooks.has(id);
    setSavedBooks(current => { const next = new Set(current); saving ? next.add(id) : next.delete(id); return next; });
    cloud.change({ kind: "book", key: id, deleted: !saving });
  };

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
      const claimed = Boolean(localStorage.getItem("rassegna-rossa.saved-account"));
      setSavedIds(
        new Set(claimed ? [] : [
          ...restored.map((a) => a.id),
          ...(Array.isArray(rawIds)
            ? rawIds.filter((id): id is string => typeof id === "string")
            : []),
        ]),
      );
      if (!claimed) {
        setSavedArticles(restored);
        const books = JSON.parse(localStorage.getItem("rassegna-rossa.saved-books") ?? "[]");
        if (Array.isArray(books)) setSavedBooks(new Set(books.filter(id => validBookIds.has(id))));
      }
      const requestedView = new URLSearchParams(window.location.search).get("view");
      if (NAV.some(item => item.id === requestedView)) setView(requestedView as View);
    } catch {
      setStorageWarning(true);
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      if (localStorage.getItem("rassegna-rossa.saved-account") && !cloud.account) return;
      localStorage.setItem(
        "rassegna-rossa.saved",
        JSON.stringify(Array.from(savedIds)),
      );
      localStorage.setItem(
        "rassegna-rossa.saved-articles",
        JSON.stringify(savedArticles),
      );
      localStorage.setItem("rassegna-rossa.saved-books", JSON.stringify([...savedBooks]));
    } catch {
      setStorageWarning(true);
    }
  }, [savedIds, savedArticles, savedBooks, storageReady, cloud.account]);

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
    setEditorialAxis("all");
    setRegion(ALL);
    setKind(ALL);
    setIdeology(ALL);
    setTopic(ALL);
    setSourceId(ALL);
    setDays("30");
    setSort("featured");
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
    setCollecting(false);
    collectingRef.current = false;
    setRefreshNotice(
      "Raccolta interrotta. Le notizie già recuperate restano disponibili.",
    );
  };

  const refresh = useCallback(
    async (
      _scope: "initial" | "all" | "selection" = "all",
      preferred = preferredRef.current,
      explicitIds?: string[],
    ) => {
      const applyResult = (payload: FeedPayload) => {
        if (
          !Array.isArray(payload.articles) ||
          !Array.isArray(payload.statuses)
        )
          return;
        const cards = validateArticles(payload.articles);
        if (cards.length) {
          hasArticlesRef.current = true;
          setLoading(false);
          setNewsUpdatedAt(Date.now());
          setArticles((current) => mergeArticles(current, cards));
        }
        setStatuses((current) => ({
          ...current,
          ...Object.fromEntries(
            payload.statuses.map((status) => [status.sourceId, status]),
          ),
        }));
      };
      const worker = async (source: SourceDefinition, signal: AbortSignal) => {
        const response = await fetch(
          `/api/articles?sourceIds=${encodeURIComponent(source.id)}&limitPerSource=24&includeImages=1`,
          { signal },
        );
        if (!response.ok) throw new Error("Source unavailable");
        return (await response.json()) as FeedPayload;
      };
      // Opening one source never interrupts the full catalogue collection.
      if (explicitIds) {
        await Promise.all(
          SOURCE_CATALOG.filter((source) =>
            explicitIds.includes(source.id),
          ).map(async (source) => {
            try {
              applyResult(await worker(source, AbortSignal.timeout(18000)));
            } catch {
              /* Full collection remains active. */
            }
          }),
        );
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const run = ++refreshNumber.current;
      const targets = collectionOrder(SOURCE_CATALOG, preferred);
      collectingRef.current = true;
      setCollecting(true);
      setLoading(!hasArticlesRef.current);
      setRefreshNotice("");
      setProgress({ done: 0, total: targets.length });
      const firstScreenDeadline = setTimeout(() => {
        if (run === refreshNumber.current) { setLoading(false); setInitialWindowReady(true); }
      }, 3000);
      try {
        let completed = 0;
        const sink = createBatchedSink<{ payload?: FeedPayload; done?: number }>(updates => {
          if (run !== refreshNumber.current) return;
          const payloads = updates.flatMap(update => update.payload ? [update.payload] : []);
          if (payloads.length) applyResult({
            articles: payloads.flatMap(payload => Array.isArray(payload.articles) ? payload.articles : []),
            statuses: payloads.flatMap(payload => Array.isArray(payload.statuses) ? payload.statuses : []),
          });
          const last = updates.filter(update => update.done !== undefined).at(-1);
          if (last) setProgress({ done: last.done!, total: targets.length });
        });
        const options = {
          signal: controller.signal,
          worker,
          onResult: (_source: SourceDefinition, payload: FeedPayload) => {
            if (run === refreshNumber.current) sink.push({ payload });
          },
          onError: (source: SourceDefinition) => {
            if (run !== refreshNumber.current) return;
            sink.push({ payload: { articles: [], statuses: [{
              sourceId: source.id, name: source.name, ok: false, count: 0, feedUrl: null,
              fetchedAt: new Date().toISOString(), cached: false,
              error: "Verifica del feed non completata nel tempo previsto. Il sito originale resta accessibile.",
            }] } });
          },
          onProgress: () => {
            completed++;
            if (run === refreshNumber.current) sink.push({ done: completed });
          },
        };
        try {
          await Promise.all([
            collectAll({ ...options, items: targets.filter(source => source.kind !== "radar"), concurrency: 6, timeoutMs: 14000 }),
            collectAll({ ...options, items: targets.filter(source => source.kind === "radar"), concurrency: 2, timeoutMs: 18000 }),
          ]);
        } finally {
          sink.flush();
          sink.clear();
        }
      } finally {
        clearTimeout(firstScreenDeadline);
        if (run === refreshNumber.current) {
          collectingRef.current = false;
          setCollecting(false);
          setLoading(false);
          setInitialWindowReady(true);
              }
      }
    },
    [],
  );

  useEffect(() => {
    const available = [
      ...new Set(SOURCE_CATALOG.map((source) => source.language)),
    ];
    const detected = preferredLanguageFor(
      navigator.languages?.length ? navigator.languages : [navigator.language],
      available,
    );
    setBrowserLanguage(detected);
    setPreferredLanguage(detected);
    preferredRef.current = detected;
    let initialSourcePreference = detected;
    try {
      const previous = Number(
        sessionStorage.getItem("rassegna-rossa.quote") ?? "-1",
      );
      const next = nextQuotation(previous);
      setQuoteIndex(next);
      sessionStorage.setItem("rassegna-rossa.quote", String(next));
    } catch {
      setQuoteIndex(Math.floor(Math.random() * QUOTATIONS.length));
    }
    try {
      const choices = resolveLanguageChoices(
        {
          reading: localStorage.getItem("rassegna-rossa.reading-language"),
          sources: localStorage.getItem("rassegna-rossa.source-language"),
          legacy: localStorage.getItem("rassegna-rossa.language"),
        },
        available,
      );
      setReadingChoice(choices.reading);
      setLanguage(choices.sources);
      initialSourcePreference = choices.sources !== ALL ? choices.sources : choices.reading !== "auto" ? choices.reading : detected;
      const snapshot = restoreNewsSnapshot(
        localStorage.getItem("rassegna-rossa.feed-cache"),
      );
      if (snapshot) {
        setArticles(snapshot.articles);
        setInitialWindowReady(snapshot.articles.length > 0);
        hasArticlesRef.current = snapshot.articles.length > 0;
        setLoading(false);
        setNewsUpdatedAt(snapshot.updatedAt);
      }
    } catch {
      /* Browser storage is optional. */
    }
    void refresh("initial", initialSourcePreference);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !collectingRef.current)
        void refresh("all", preferredRef.current);
    }, 600000);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
      ++refreshNumber.current;
    };
  }, [refresh]);

  useEffect(() => {
    if (!storageReady || !newsUpdatedAt || !articles.length) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "rassegna-rossa.feed-cache",
          JSON.stringify({
            updatedAt: newsUpdatedAt,
            articles: rankEditorial(displayArticles).slice(0, 1200),
          }),
        );
      } catch {
        /* Never discard bookmarks to make room for a feed cache. */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [displayArticles, newsUpdatedAt, storageReady]);

  const chooseReadingLanguage = (value: string) => {
    setReadingChoice(value);
    try {
      localStorage.setItem("rassegna-rossa.reading-language", value);
    } catch {
      /* Optional storage. */
    }
  };
  const chooseSourceLanguage = (value: string) => {
    setLanguage(value);
    try {
      localStorage.setItem("rassegna-rossa.source-language", value);
    } catch {
      /* Optional storage. */
    }
    if (value !== ALL) {
      const immediate = SOURCE_CATALOG.filter(source => source.language === value && source.kind !== "radar").slice(0, 4).map(source => source.id);
      if (immediate.length) void refresh("selection", preferredRef.current, immediate);
    }
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
        if (controls.current) controls.current.open = true;
        requestAnimationFrame(() => search.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const allArticles = useMemo(
    () => mergeArticles(savedArticles, displayArticles),
    [savedArticles, displayArticles],
  );
  const matched = useMemo(
    () =>
      filterArticles(
        view === "salvati"
          ? allArticles.filter((a) => savedIds.has(a.id))
          : displayArticles,
        {
          query: deferredQuery,
          region,
          language,
          kind,
          ideology,
          topic,
          source: sourceId,
          days: view === "salvati" ? Infinity : Number(days),
          sort,
        },
      ),
    [
      view,
      allArticles,
      displayArticles,
      savedIds,
      deferredQuery,
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
  const filtered = useMemo(() => {
    const selected =
      editorialAxis === "all" || view === "salvati"
        ? matched
        : matched.filter((article) =>
            editorialAssessment(article).axes.includes(editorialAxis),
          );
    if (view !== "salvati" && sort === "featured")
      return rankSourceHighlights(rankEditorial(selected, preferredLanguage), sourceHighlights.highlights, "featured");
    if (sort === "popular") {
      const links = new Set(sourceHighlights.highlights.filter(item => item.placement === "popular").map(item => highlightLinkKey(item.link)));
      const ranked = selected.filter(article => links.has(highlightLinkKey(article.link)));
      return ranked.length ? rankSourceHighlights(ranked, sourceHighlights.highlights, "popular") : selected;
    }
    return sort === "editorial" && view !== "salvati"
      ? rankEditorial(selected, preferredLanguage)
      : selected;
  }, [matched, editorialAxis, view, sort, preferredLanguage, sourceHighlights.highlights]);
  const orderedArticles = useStableNews(filtered, JSON.stringify([view, deferredQuery, region, language, kind, ideology, topic, sourceId, days, sort, editorialAxis, orderVersion]));
  const newerOrderAvailable = orderedArticles.some((article, index) => filtered[index]?.id !== article.id);
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
    editorialAxis,
  ]);
  const selectedArticle = allArticles.find((a) => a.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedArticle) {
      if (!readerDialog.current?.open) readerDialog.current?.showModal();
      readerDialog.current?.scrollTo({ top: 0 });
    }
  }, [selectedArticle]);

  const toggleSave = useCallback((article: Article) => {
    const saving = !savedIds.has(article.id);
    cloud.change({ kind: "article", key: article.id, article, deleted: !saving });
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
  }, [savedIds, cloud.change]);
  const directory = useMemo(() => {
    const counts = new Map<string, number>();
    const sources = new Map<string, DirectorySource>(
      SOURCE_CATALOG.map((s) => [
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
      .map((s) => ({
        ...s,
        count:
          counts.get(s.id) ?? (s.kind === "radar" ? (s.status?.count ?? 0) : 0),
      }))
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
  const failedPublishers = SOURCE_CATALOG.filter(source => source.kind !== "radar" && statuses[source.id]?.ok === false).length;
  const failedRadars = SOURCE_CATALOG.filter(source => source.kind === "radar" && statuses[source.id]?.ok === false).length;
  const failedCount = failedPublishers + failedRadars;
  const filterCount =
    [region, language, kind, ideology, topic, sourceId, editorialAxis].filter((f) => f !== ALL).length +
    (days !== "30" ? 1 : 0) +
    (query ? 1 : 0);
  const heading = HEADINGS[view];
  const ContentHeading = view === "notizie" ? "h1" : "h2";
  const matchedLinks = useMemo(() => new Set(matched.map(article => highlightLinkKey(article.link))), [matched]);
  const hasSourceSelection = sourceHighlights.highlights.some(item =>
    (sort === "popular" ? item.placement === "popular" : item.placement !== "popular") && matchedLinks.has(highlightLinkKey(item.link)));
  const readingLanguage =
    readingChoice === "auto" ? browserLanguage : readingChoice;
  const quote = QUOTATIONS[quoteIndex];
  useEffect(() => {
    setDateLabel(
      new Intl.DateTimeFormat(readingLanguage, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, [readingLanguage]);

  return (
    <LocalizationProvider language={readingLanguage}>
      <InitialLoadBoundary collecting={(view === "notizie" && !initialWindowReady && orderedArticles.length < PAGE_SIZE) || (view === "salvati" && cloud.status === "checking")} progress={progress} language={readingLanguage}>
      <div className="app-shell">
        <a className="skip-link" href="#letture">
          <LocalizedText>{"Vai ai contenuti"}</LocalizedText>
        </a>
        <header className="site-header">
          <div className="utility-bar">
            <span>{dateLabel}</span>
            <span>
              <span className="live-dot" />
              <LocalizedText>
                {" Fonti aperte. Sguardo internazionale."}
              </LocalizedText>
            </span>
          </div>
          <div className="masthead">
            <button
              className="wordmark"
              onClick={() => navigate("notizie")}
              aria-label="Internazionale Rossa, pagina iniziale"
            >
              <span className="brand-symbol" aria-hidden="true">
                <CommunityEmblem compact />
              </span>
              <span>
                internazionale<span className="wordmark-black"> rossa</span>
                <span className="brand-period">
                  <LocalizedText>{"."}</LocalizedText>
                </span>
              </span>
            </button>

          </div>
          <nav className="main-nav" aria-label="Navigazione principale">
            <div className="nav-links">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <LocalizedText>{item.label}</LocalizedText>
                  {item.id === "salvati" && savedIds.size + savedBooks.size > 0 ? (
                    <span className="nav-count">
                      <LocalizedText>{savedIds.size + savedBooks.size}</LocalizedText>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <span className="nav-caption">
              <LocalizedText>{"Un osservatorio, molte voci "}</LocalizedText>
              <ArrowUpRight size={14} />
            </span>
          </nav>
        </header>

        <main>
          {view === "notizie" ? <VideoCarousel /> : null}
          {view !== "notizie" ? (
            <section className="editorial-hero hero-compact" aria-labelledby="page-title">
              <div className="hero-copy">
                <p className="eyebrow"><LocalizedText>{heading.overline}</LocalizedText></p>
                <h1 id="page-title">{heading.title}</h1>
                <p className="hero-description"><LocalizedText>{heading.description}</LocalizedText></p>
              </div>
            </section>
          ) : null}

          <section
            id="letture"
            className="reading-section"
            aria-label="Contenuti della rassegna"
          >
            {view === "notizie" || view === "salvati" || view === "fonti" ? (
              <>
                <details className="reading-controls-banner" ref={controls}>
                  <summary>
                    <span className="controls-banner-title"><SlidersHorizontal size={17} /><LocalizedText>{view === "notizie" ? "La rassegna" : view === "salvati" ? "Le tue letture" : "Atlante delle fonti"}</LocalizedText><span className="controls-banner-count">{view === "fonti" ? visibleSources.length : filtered.length}</span></span>
                    <span className="controls-banner-state"><LocalizedText>Lettura</LocalizedText>: <LanguageName code={readingLanguage} /><span aria-hidden="true"> · </span><LocalizedText>Fonti</LocalizedText>: {language === ALL ? <LocalizedText>Tutte</LocalizedText> : <LanguageName code={language} />}{filterCount ? <> · {filterCount} <LocalizedText>filtri</LocalizedText></> : null}</span>
                    <span className="controls-banner-action"><LocalizedText>Personalizza</LocalizedText><ChevronDown size={17} /></span>
                  </summary>
                  <div className="reading-controls-content">
                <div className="section-heading">
                  <div className="reading-heading-copy">
                    <p className="eyebrow">
                      <LocalizedText>
                        {view === "fonti"
                          ? "L’INFORMAZIONE HA UN’ORIGINE"
                          : view === "salvati"
                            ? "IL TEMPO DI APPROFONDIRE"
                            : "DALLA RETE AL CONTESTO"}
                      </LocalizedText>
                    </p>
                    <ContentHeading id={view === "notizie" ? "page-title" : undefined}>
                      <LocalizedText>
                        {view === "notizie"
                          ? "La rassegna"
                          : view === "salvati"
                            ? "Le tue letture"
                            : "Atlante delle fonti"}
                      </LocalizedText>
                      <span className="section-count">
                        <LocalizedText>
                          {view === "fonti"
                            ? visibleSources.length
                            : filtered.length}
                        </LocalizedText>
                      </span>
                    </ContentHeading>
                  </div>
                <div className="language-controls">
                  <label className="reading-language-control">
                    <Languages size={19} />
                    <span>
                      <strong>
                        <LocalizedText>Lingua di lettura</LocalizedText>
                      </strong>
                      <small>
                        <LocalizedText>
                          Traduce la pagina e le schede
                        </LocalizedText>
                      </small>
                    </span>
                    <select
                      aria-label="Lingua di lettura"
                      value={readingChoice}
                      onChange={(event) =>
                        chooseReadingLanguage(event.target.value)
                      }
                    >
                      <option value="auto">
                        <LocalizedText>Automatica · browser</LocalizedText>
                      </option>
                      {languages.map((code) => (
                        <option key={code} value={code}>
                          <LanguageName code={code} />
                        </option>
                      ))}
                    </select>
                  </label>

                </div>
                  {view !== "salvati" ? (
                    <button
                      className="button button-outline"
                      aria-label="Aggiorna notizie e ordine"
                      onClick={() => { setOrderVersion(value => value + 1); if (!collecting) void refresh("all"); }}
                    >
                      <RefreshCcw size={15} />
                      <span>
                        <LocalizedText>
                          {newerOrderAvailable ? "Aggiorna ordine" : "Aggiorna"}
                        </LocalizedText>
                      </span>
                    </button>
                  ) : (
                    <span className="local-note">
                      <Bookmark size={15} />
                      <LocalizedText>{cloud.account ? " Raccolta personale" : " Copia su questo dispositivo"}</LocalizedText>
                    </span>
                  )}
                </div>
                {view === "salvati" ? (
                  <div className="cloud-library-status" role="status">
                    <LocalizedText>{cloud.status === "checking" ? "Verifica dell’archivio personale…" : cloud.status === "synced" ? "Articoli e libri salvati nel tuo account. Li ritrovi anche dopo aver cancellato i dati del browser." : cloud.status === "syncing" ? "Sincronizzazione dei salvataggi in corso…" : cloud.status === "local" ? "Questa copia è solo sul dispositivo. Accedi per conservarla nel tuo archivio personale." : "La sincronizzazione non è riuscita. Le modifiche in attesa restano sul dispositivo."}</LocalizedText>
                    {!cloud.account && cloud.status === "local" ? <a href={cloud.signInUrl} target="_top"><LocalizedText>Accedi con ChatGPT</LocalizedText></a> : null}
                    {cloud.status === "error" ? <button className="text-link" onClick={cloud.retry}><LocalizedText>Riprova sincronizzazione</LocalizedText></button> : null}
                  </div>
                ) : null}
                {view !== "salvati" && cloud.status === "local" && savedIds.size + savedBooks.size > 0 ? <p className="account-save-note"><LocalizedText>Salvati su questo dispositivo.</LocalizedText> <a href={cloud.signInUrl} target="_top"><LocalizedText>Accedi per conservarli nel tuo account</LocalizedText></a></p> : null}
                <TranslationNotice />
                <div className="filter-toolbar">
                  <label className="search-box">
                    <Search size={18} />
                    <LocalizedInput
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
                      <kbd>
                        <LocalizedText>{"/"}</LocalizedText>
                      </kbd>
                    )}
                  </label>
                  <label className="source-language-control source-language-inline">
                    <Newspaper size={16} />
                    <span>
                      <strong>
                        <LocalizedText>
                          Lingua delle fonti
                        </LocalizedText>
                      </strong>
                      <small>
                        <LocalizedText>
                          Seleziona la lingua originale delle fonti
                        </LocalizedText>
                      </small>
                    </span>
                    <select
                      aria-label="Lingua delle fonti in analisi"
                      value={language}
                      onChange={(event) =>
                        chooseSourceLanguage(event.target.value)
                      }
                    >
                      <option value={ALL}>
                        <LocalizedText>Tutte le lingue</LocalizedText>
                      </option>
                      {languages.map((code) => (
                        <option key={code} value={code}>
                          <LanguageName code={code} />
                        </option>
                      ))}
                    </select>
                  </label>
                  {view !== "fonti" ? (
                    <label className="inline-select news-order">
                      <span><LocalizedText>Ordina</LocalizedText></span>
                      <select aria-label="Ordina le notizie" value={sort} onChange={event => setSort(event.target.value)}>
                        <option value="featured"><LocalizedText>In evidenza dalle fonti</LocalizedText></option>
                        <option value="editorial"><LocalizedText>Priorità politica e formativa</LocalizedText></option>
                        <option value="fresh"><LocalizedText>Ultimi articoli</LocalizedText></option>
                        <option value="popular"><LocalizedText>Più letti sulle fonti</LocalizedText></option>
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
                    <SlidersHorizontal size={16} />
                    <LocalizedText>{" Filtri"}</LocalizedText>
                    <LocalizedText> </LocalizedText>
                    {filterCount > 0 ? (
                      <span>
                        <LocalizedText>{filterCount}</LocalizedText>
                      </span>
                    ) : null}
                  </button>
                </div>
                <div id="advanced-filters" className="advanced-filters unified-filters" hidden={!filtersOpen}>

                    <Select label="Area geografica" value={region} change={setRegion}>
                      <option value={ALL}><LocalizedText>Tutto il mondo</LocalizedText></option>
                      {REGION_ORDER.map(value => <option key={value} value={value}><LocalizedText>{value}</LocalizedText></option>)}
                    </Select>
                    <Select label="Periodo" value={days} change={setDays}>
                      {[["0.25", "Ultime 6 ore"], ["0.5", "Ultime 12 ore"], ["1", "Ultime 24 ore"], ["3", "Ultimi 3 giorni"], ["7", "Ultimi 7 giorni"], ["30", "Ultimi 30 giorni"], ["Infinity", "Tutte le date"]].map(([value, label]) => <option key={value} value={value}><LocalizedText>{label}</LocalizedText></option>)}
                    </Select>
                    <Select label="Fonte" value={sourceId} change={setSourceId}>
                      <option value={ALL}><LocalizedText>Tutte le fonti</LocalizedText></option>
                      {directory.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                    </Select>
                    {view !== "fonti" ? <>
                      <Select label="Argomento" value={topic} change={setTopic}>
                        <option value={ALL}><LocalizedText>Tutti gli argomenti</LocalizedText></option>
                        {TOPIC_TAXONOMY.map(item => <option key={item.id} value={item.id}><LocalizedText>{item.label}</LocalizedText></option>)}
                      </Select>
                      <Select label="Approfondimento" value={editorialAxis} change={value => setEditorialAxis(value as EditorialAxis | "all")}>
                        <option value={ALL}><LocalizedText>Tutti gli approfondimenti</LocalizedText></option>
                        {EDITORIAL_AXES.map(axis => <option key={axis.id} value={axis.id}><LocalizedText>{axis.label}</LocalizedText></option>)}
                      </Select>
                    </> : null}
                    <Select label="Tipo di fonte" value={kind} change={setKind}>
                      <option value={ALL}>
                        <LocalizedText>{"Tutti i tipi"}</LocalizedText>
                      </option>
                      {[...new Set(directory.map((s) => s.kind))].map((k) => (
                        <option key={k} value={k}>
                          <LocalizedText>{k}</LocalizedText>
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Orientamento dichiarato nel catalogo"
                      value={ideology}
                      change={setIdeology}
                    >
                      <option value={ALL}>
                        <LocalizedText>
                          {"Tutti gli orientamenti"}
                        </LocalizedText>
                      </option>
                      {ideologies.map((i) => (
                        <option key={i} value={i}>
                          <LocalizedText>{i}</LocalizedText>
                        </option>
                      ))}
                    </Select>
                    <button className="text-link" onClick={() => { reset(); chooseSourceLanguage(ALL); }}>
                      <X size={14} />
                      <LocalizedText>{" Azzera filtri"}</LocalizedText>
                    </button>
                </div>
                {view === "notizie" && (sort === "popular" || sort === "featured") && !hasSourceSelection ? (
                  <p className="sort-note" role="status"><LocalizedText>{sourceHighlights.coverage.busy
                    ? "Le notizie sono già leggibili. Si aggiornano le selezioni delle fonti."
                    : sort === "popular"
                      ? "Nessuna classifica dei più letti disponibile per questi articoli. Mostriamo gli ultimi pubblicati."
                      : "Selezioni delle prime pagine non disponibili per questi articoli. È attiva la priorità politica e formativa."}</LocalizedText></p>
                ) : null}
                {sourceId !== ALL ? (
                  <div className="active-source">
                    <Newspaper size={16} />
                    <span>
                      <LocalizedText>{"Fonte:"}</LocalizedText>
                      <LocalizedText> </LocalizedText>
                      <strong>
                        <LocalizedText>
                          {directory.find((s) => s.id === sourceId)?.name ??
                            sourceId}
                        </LocalizedText>
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
                    <LocalizedText>
                      {
                        "Il browser non ha consentito l’accesso ai salvataggi. Puoi continuare a leggere, ma i nuovi preferiti potrebbero non restare dopo la chiusura."
                      }
                    </LocalizedText>
                  </p>
                ) : null}
                {refreshNotice ? (
                  <p className="notice" role="status">
                    <LocalizedText>{refreshNotice}</LocalizedText>
                  </p>
                ) : null}
                {view !== "salvati" ? (
                  <details className="collection-status">
                    <summary>
                      <span className="live-dot" />
                      <LocalizedText>
                        {collecting
                          ? "Rete completa in raccolta automatica"
                          : "Ultimo ciclo di raccolta"}
                      </LocalizedText>
                      <span>
                        {progress.done}/{progress.total}{" "}
                        <LocalizedText>canali consultati</LocalizedText>
                      </span>
                    </summary>
                    <p>
                      <LocalizedText>
                        Tutte le fonti partecipano, con richieste parallele
                        limitate per mantenere il sito utilizzabile. Puoi
                        leggere, cercare e filtrare durante la raccolta. Una
                        fonte lenta non blocca le altre.
                      </LocalizedText>
                    </p>
                    <progress
                      value={progress.done}
                      max={progress.total || 1}
                      aria-label="Copertura della raccolta"
                    />
                    {collecting ? (
                      <button className="text-link" onClick={stopRefresh}>
                        <LocalizedText>Interrompi questo ciclo</LocalizedText>
                      </button>
                    ) : null}
                  </details>
                ) : null}
                  </div>
                </details>
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
                          <p className="eyebrow">
                            <LocalizedText>{"PERCORSO TEMATICO"}</LocalizedText>
                          </p>
                          <h3>
                            <LocalizedText>
                              {DOSSIERS.find((d) => d.id === topic)?.title ??
                                TOPIC_TAXONOMY.find((t) => t.id === topic)
                                  ?.label}
                            </LocalizedText>
                          </h3>
                          <p>
                            <LocalizedText>
                              {DOSSIERS.find((d) => d.id === topic)
                                ?.description ??
                                "Una selezione automatica dai feed: confronta le voci e risali sempre alla fonte originale."}
                            </LocalizedText>
                          </p>
                        </div>
                      ) : null}
                      {view === "salvati" && savedBooks.size ? <Suspense fallback={<p role="status"><LocalizedText>Apertura dei libri salvati…</LocalizedText></p>}><SavedBooks savedBooks={savedBooks} query={query} onToggleBook={toggleBook} /></Suspense> : null}
                      <div className="news-grid" aria-label="Articoli">
                        {orderedArticles
                          .slice(0, visibleCount)
                          .map((article) => (
                            <ArticleCard
                              key={`${orderVersion}:${article.id}`}
                              article={article}
                              saved={savedIds.has(article.id)}
                              onSelect={setSelectedId}
                              onSave={toggleSave}
                            />
                          ))}
                      </div>
                      {!filtered.length && !(view === "salvati" && savedBooks.size) ? (
                        <EmptyState
                          loading={loading && view !== "salvati"}
                          collecting={collecting}
                          saved={view === "salvati"}
                          filtered={filterCount > 0 || topic !== ALL}
                          onReset={reset}
                          onExplore={() =>
                            navigate(view === "salvati" ? "notizie" : "fonti")
                          }
                          onRetry={() => void refresh("all")}
                        />
                      ) : null}
                      {filtered.length > visibleCount ? (
                        <button
                          className="button button-outline load-more"
                          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                        >
                          <LocalizedText>{"Altri"}</LocalizedText>
                          <LocalizedText> </LocalizedText>
                          <LocalizedText>
                            {Math.min(
                              PAGE_SIZE,
                              filtered.length - visibleCount,
                            )}
                          </LocalizedText>
                          <LocalizedText> </LocalizedText>
                          <LocalizedText>{"articoli "}</LocalizedText>
                          <ArrowDown size={16} />
                          <span>
                            <LocalizedText>{visibleCount}</LocalizedText>
                            <LocalizedText>{" di "}</LocalizedText>
                            <LocalizedText>{filtered.length}</LocalizedText>
                          </span>
                        </button>
                      ) : null}
                      {!loading && failedCount > 0 && view === "notizie" ? (
                        <p className="feed-note">
                          <CircleHelp size={15} />{" "}
                          <span>{failedPublishers} <LocalizedText>fonti dirette con feed da ricontrollare</LocalizedText> · {failedRadars} <LocalizedText>ricerche radar non disponibili</LocalizedText>. <LocalizedText>Le copie già raccolte restano leggibili.</LocalizedText></span>
                          <button onClick={() => navigate("fonti")}>
                            <LocalizedText>{"Consulta le fonti"}</LocalizedText>
                          </button>
                        </p>
                      ) : null}
                    </div>
                    {view === "notizie" ? <WorldWatch networkArticles={displayArticles} /> : null}
                  </div>
                )}
              </>
            ) : null}
            {view === "teoria" ? (
              <Suspense fallback={<p className="reader-message" role="status"><LocalizedText>Apertura della biblioteca…</LocalizedText></p>}><LibraryView query={query} setQuery={setQuery} savedBooks={savedBooks} onToggleBook={toggleBook} /></Suspense>
            ) : null}
            {view === "metodo" ? (
              <MethodView onSources={() => navigate("fonti")} />
            ) : null}
          </section>
          {view === "notizie" ? (
            <section className="daily-quotation" aria-label="Una citazione per approfondire">
              <blockquote><LocalizedText>{quote.text}</LocalizedText></blockquote>
              <p><strong>{quote.author}</strong> · <a href={quote.url} target="_blank" rel="noopener noreferrer"><LocalizedText>{quote.work}</LocalizedText>, {quote.year}</a></p>
              <small><LocalizedText>{quote.note}</LocalizedText> · Marxists Internet Archive</small>
            </section>
          ) : null}
        </main>
        <footer className="site-footer">
          <div className="footer-top">
            <span className="footer-brand">
              internazionale<span> rossa.</span>
            </span>
            <p>
              <LocalizedText>{"Per capire il mondo,"}</LocalizedText>
              <br />
              <LocalizedText>
                {"mettiamo in relazione le sue voci."}
              </LocalizedText>
            </p>
            <button className="text-link" onClick={() => navigate("metodo")}>
              <LocalizedText>{"Il progetto e il metodo "}</LocalizedText>
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="footer-bottom">
            <span>
              <LocalizedText>
                {"Aggregatore socialista globale · Notizie, teoria, fonti."}
              </LocalizedText>
            </span>
            <span>
              <LocalizedText>
                {
                  "Ogni contenuto appartiene alla sua fonte. Accedi per sincronizzare i salvati."
                }
              </LocalizedText>
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
      </InitialLoadBoundary>
    </LocalizationProvider>
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
      <span>
        <LocalizedText>{label}</LocalizedText>
      </span>
      <select value={value} onChange={(e) => change(e.target.value)}>
        <LocalizedText>{children}</LocalizedText>
      </select>
    </label>
  );
}

const ArticleCard = memo(function ArticleCard({
  article,
  saved,
  onSelect,
  onSave,
}: {
  article: Article;
  saved: boolean;
  onSelect: (id: string) => void;
  onSave: (article: Article) => void;
}) {
  return (
    <article className="article-card">
      <button className="article-open" onClick={() => onSelect(article.id)}>
        <ArticleImage articleLink={article.link} sourceId={article.feedSourceId ?? article.sourceId} articleId={article.id} image={article.image} fallbacks={article.imageFallbacks} region={article.region} />
        <div className="article-copy">
          <div className="article-meta">
            <span>{article.sourceName}</span>
            <span>
              <LocalizedText>
                {article.publishedAt
                  ? relativeTime(article.publishedAt)
                  : "Data non indicata"}
              </LocalizedText>
            </span>
          </div>
          <h3>
            <LocalizedText priority={2} defer from={publisherFor(article).language}>
              {article.title}
            </LocalizedText>
          </h3>
          <p>
            <LocalizedText
              priority={1}
              defer
              from={article.excerpt ? publisherFor(article).language : "it"}
            >
              {article.excerpt ||
                "Questo feed non fornisce un estratto. Apri la fonte per leggere l’articolo."}
            </LocalizedText>
          </p>
        </div>
      </button>
      <a
        className="publisher-link"
        href={safeWebUrl(article.link) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        <LocalizedText>{"Leggi e sostieni la fonte "}</LocalizedText>
        <ArrowUpRight size={14} />
      </a>
      <div className="article-bottom">
        <span>
          <LocalizedText>{publisherFor(article).country ?? "Paese non verificato"}</LocalizedText>{" "}
          <i>
            <LocalizedText>{"·"}</LocalizedText>
          </i>
          <LocalizedText> </LocalizedText>
          <LanguageName code={publisherFor(article).language} />
        </span>
        <div>
          <button
            className={`save-button ${saved ? "is-saved" : ""}`}
            onClick={() => onSave(article)}
            aria-label={
              saved
                ? `Rimuovi dai salvati: ${article.title}`
                : `Salva articolo: ${article.title}`
            }
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          </button>

        </div>
      </div>
    </article>
  );
});

function EmptyState({
  loading,
  collecting = false,
  saved,
  filtered,
  onReset,
  onExplore,
  onRetry,
}: {
  loading: boolean;
  collecting?: boolean;
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
        <LocalizedText>
          {loading
            ? "COLLEGHIAMO LE FONTI"
            : saved
              ? "IL TUO TACCUINO"
              : "UNO SGUARDO PIÙ AMPIO"}
        </LocalizedText>
      </p>
      <h3>
        <LocalizedText>
          {loading
            ? "Le prime voci stanno arrivando."
            : saved
              ? "Le letture importanti, tutte qui."
              : "Nessun articolo in questa selezione."}
        </LocalizedText>
      </h3>
      <p>
        <LocalizedText>
          {loading
            ? "Ogni fonte ha i suoi tempi. Gli articoli compariranno appena disponibili; nel frattempo puoi esplorare il catalogo e la biblioteca."
            : saved
              ? "Usa il segnalibro sulle schede per conservare titolo, estratto e link. I vecchi segnalibri saranno recuperati quando le relative notizie torneranno nei feed."
              : "Prova un altro tema, una finestra temporale più ampia oppure consulta direttamente le fonti. L’assenza di risultati non significa assenza di notizie."}
        </LocalizedText>
      </p>
      <div className="empty-actions">
        {filtered ? (
          <button className="button button-dark" onClick={onReset}>
            <LocalizedText>{"Azzera filtri "}</LocalizedText>
            <X size={14} />
          </button>
        ) : null}
        <button className="button button-outline" onClick={onExplore}>
          <LocalizedText>
            {saved ? "Esplora le notizie" : "Esplora le fonti"}
          </LocalizedText>
          <ArrowRight size={15} />
        </button>
        {!saved && !loading && !collecting ? (
          <button className="text-link" onClick={onRetry}>
            <RefreshCcw size={14} />
            <LocalizedText>{" Riprova aggiornamento"}</LocalizedText>
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
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["Italia", "Europa"]),
  );
  const groups = useMemo(() => {
    const buckets = new Map<string, DirectorySource[]>();
    for (const source of sources) {
      const key = source.discovered
        ? "Fonti emerse dai radar"
        : source.kind === "radar"
          ? "Radar di ricerca"
          : source.region;
      const bucket = buckets.get(key) ?? [];
      bucket.push(source);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      const order = [
        ...REGION_ORDER,
        "Fonti emerse dai radar",
        "Radar di ricerca",
      ] as string[];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [sources]);
  const groupNames = groups.map(([name]) => name).join("|");
  useEffect(() => {
    const names = groupNames.split("|").filter(Boolean);
    if (names.length === 1)
      setExpanded((previous) => new Set([...previous, names[0]]));
  }, [groupNames]);
  return (
    <div className="source-atlas">
      <div className="directory-intro">
        <p>
          <LocalizedText>
            Tutta la rete è inclusa nella raccolta automatica. Apri un’area per
            esplorare le testate; i radar di ricerca e le fonti da essi scoperte
            rimangono distinti dagli editori del catalogo.
          </LocalizedText>
        </p>
        <span>
          <LocalizedText>
            Le etichette descrivono il catalogo, non certificano
            l’attendibilità.
          </LocalizedText>
        </span>
      </div>
      <div className="atlas-overview">
        {groups.map(([name, items]) => (
          <a
            href={`#atlas-${name.replace(/\s/g, "-")}`}
            key={name}
            onClick={() =>
              setExpanded((previous) => new Set([...previous, name]))
            }
          >
            <strong>{items.length}</strong>
            <LocalizedText>{name}</LocalizedText>
          </a>
        ))}
      </div>
      {groups.map(([name, items]) => {
        const open = expanded.has(name);
        return (
          <details
            className="atlas-group"
            key={name}
            id={`atlas-${name.replace(/\s/g, "-")}`}
            open={open}
            onToggle={(event) => {
              const nextOpen = event.currentTarget.open;
              setExpanded((previous) => {
                if (previous.has(name) === nextOpen) return previous;
                const next = new Set(previous);
                if (nextOpen) next.add(name);
                else next.delete(name);
                return next;
              });
            }}
          >
            <summary>
              <span>
                <LocalizedText>{name}</LocalizedText>
              </span>
              <span>
                {items.length}{" "}
                <LocalizedText>
                  {name === "Radar di ricerca" ? "canali" : "fonti"}
                </LocalizedText>
              </span>
            </summary>
            {open ? (
              <div className="atlas-rows">
                {items.map((source) => (
                  <article className="atlas-row" key={source.id}>
                    <div>
                      <h3>
                        {source.kind === "radar" ? (
                          <LocalizedText>{source.name}</LocalizedText>
                        ) : (
                          source.name
                        )}
                      </h3>
                      <p>
                        <LocalizedText>{source.country}</LocalizedText> ·{" "}
                        <LanguageName code={source.language} /> ·{" "}
                        <LocalizedText>
                          {source.tags.includes("archivio")
                            ? "Archivio"
                            : source.kind}
                        </LocalizedText>
                      </p>
                    </div>
                    <span
                      className={`atlas-status ${source.status?.ok || source.count ? "available" : ""}`}
                    >
                      {source.count ? (
                        <>
                          {source.count} <LocalizedText>articoli</LocalizedText>
                        </>
                      ) : (
                        <LocalizedText>
                          {source.status?.ok
                            ? "Feed disponibile"
                            : source.status
                              ? "Fonte non disponibile"
                              : "In raccolta"}
                        </LocalizedText>
                      )}
                    </span>
                    <div className="atlas-actions">
                      <button
                        className="text-link"
                        onClick={() => onSelect(source.id)}
                      >
                        <LocalizedText>Articoli</LocalizedText>
                        <ArrowRight size={14} />
                      </button>
                      <a
                        href={safeWebUrl(source.homepage) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Apri ${source.name}`}
                      >
                        <ExternalLink size={17} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </details>
        );
      })}
      {!sources.length ? (
        <p className="notice">
          <LocalizedText>
            Nessuna fonte corrisponde alla selezione. Cambia lingua delle fonti
            o azzera la ricerca.
          </LocalizedText>
        </p>
      ) : null}
    </div>
  );
}

function MethodView({ onSources }: { onSources: () => void }) {
  return (
    <div className="method-view">
      <div className="method-intro">
        <p className="eyebrow">
          <LocalizedText>{"DALLE FONTI ALLE DOMANDE"}</LocalizedText>
        </p>
        <h2>
          <LocalizedText>{"Una rassegna per leggere."}</LocalizedText>
          <br />
          <em>
            <LocalizedText>{"Non un verdetto su cosa pensare."}</LocalizedText>
          </em>
        </h2>
        <p>
          <LocalizedText>
            {
              "Mettiamo vicine prospettive che spesso restano lontane: il lavoro e la geopolitica, l’attualità e la teoria, le voci locali e le relazioni globali. La selezione ha un orientamento esplicito. Non pretende di rappresentare tutte le posizioni né di sostituire il confronto con le fonti."
            }
          </LocalizedText>
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
            text: "Puoi scegliere le aperture delle testate, gli ultimi articoli, le classifiche dei più letti pubblicate dalle fonti o la priorità politica e formativa. Le classifiche non sono disponibili per ogni testata e non sono indici SEO. La modalità politica usa segnali di organizzazione collettiva, formazione, competenze e analisi del potere nel titolo e nell’estratto. Titoli ed estratti vengono filtrati per provenienza e classificati con parole chiave. Il punteggio tematico è un’euristica, non una misura di verità, qualità o rilevanza assoluta. Una data mancante o errata può influire sull’ordine.",
          },
          {
            n: "03",
            title: "Cosa puoi leggere qui",
            text: "Ogni scheda offre ciò che il feed rende disponibile, con il link all’articolo originale. Non ospitiamo una copia integrale autorevole. Alcuni editori limitano estratti o anteprime: il sito originale resta il riferimento.",
          },
          {
            n: "04",
            title: "Traduzioni e servizi esterni",
            text: "La lingua di lettura segue il browser ed è modificabile. Interfaccia, citazioni, titoli ed estratti vengono tradotti automaticamente con MyMemory: il testo pubblico viene inviato al servizio, che applica limiti e può commettere errori. Se non disponibile, mostriamo l’originale con un avviso. La traduzione della pagina apre Google Translate. Immagini e anteprime possono comportare richieste ai siti degli editori.",
          },
          {
            n: "05",
            title: "Il tuo taccuino resta tuo",
            text: "I salvati sono memorizzati in localStorage, solo in questo browser. Una cache temporanea delle schede dei feed velocizza le visite successive; la priorità linguistica segue le preferenze del browser ed è modificabile. Con l’accesso ChatGPT, articoli e libri sono sincronizzati in un archivio personale privato sul server. Senza accesso rimangono una copia locale, vulnerabile alla cancellazione dei dati del browser. Non conserviamo una cronologia personale di lettura sul server.",
          },
          {
            n: "06",
            title: "Disponibilità, attribuzione, limiti",
            text: "I feed possono cambiare, non rispondere o essere incompleti. Le cache sono temporanee e ogni aggiornamento è un tentativo di raccolta. Testi e immagini appartengono ai rispettivi titolari: la presenza in rassegna non implica adesione dell’editore al progetto.",
          },
        ].map((item) => (
          <article key={item.n}>
            <span>
              <LocalizedText>{item.n}</LocalizedText>
            </span>
            <h3>
              <LocalizedText>{item.title}</LocalizedText>
            </h3>
            <p>
              <LocalizedText>{item.text}</LocalizedText>
            </p>
          </article>
        ))}
      </div>
      <div className="method-outro">
        <Globe2 size={34} strokeWidth={1} />
        <div>
          <h3>
            <LocalizedText>{"Parti dalle voci."}</LocalizedText>
          </h3>
          <p>
            <LocalizedText>
              {"Scopri chi pubblica, da dove scrive e con quale prospettiva."}
            </LocalizedText>
          </p>
        </div>
        <button className="button button-dark" onClick={onSources}>
          <LocalizedText>{"Esplora le fonti "}</LocalizedText>
          <ArrowRight size={16} />
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
  const readingLanguage = useLocale();
  const [embed, setEmbed] = useState(false);
  return (
    <div className="article-reader">
      <div className="reader-top">
        <span className="eyebrow">
          <LocalizedText>{"LA SCHEDA / INTERNAZIONALE ROSSA"}</LocalizedText>
        </span>
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
          <span>
            <LocalizedText>{publisherFor(article).country ?? "Paese non verificato"}</LocalizedText>
          </span>
          <span>
            <LocalizedText>
              {article.publishedAt
                ? relativeTime(article.publishedAt)
                : "Data non indicata"}
            </LocalizedText>
          </span>
        </div>
        <h2 id="reader-title">
          <LocalizedText priority={2} defer from={publisherFor(article).language}>
            {article.title}
          </LocalizedText>
        </h2>
        <p className="reader-byline">
          {article.author ? `${article.author} · ` : ""}
          <LanguageName code={publisherFor(article).language} />
        </p>
        <p className="reader-excerpt">
          <LocalizedText
            priority={1}
            defer
            from={article.excerpt ? publisherFor(article).language : "it"}
          >
            {article.excerpt ||
              "La fonte non fornisce un estratto. Leggi il testo completo sul sito dell’editore."}
          </LocalizedText>
        </p>
        <div className="reader-actions">
          <a
            href={safeWebUrl(article.link) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-dark"
              >
            <LocalizedText>{"Leggi sulla fonte "}</LocalizedText>
            <ArrowUpRight size={16} />
          </a>
          <button
            className={`button button-outline ${saved ? "is-saved" : ""}`}
            onClick={onSave}
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            <LocalizedText>{saved ? "Salvato" : "Salva lettura"}</LocalizedText>
          </button>
        </div>
        <div className="reader-translation">
          <strong>
            <LocalizedText>{"Leggi e sostieni la fonte"}</LocalizedText>
          </strong>
          <p>
            <LocalizedText>
              {
                "Qui trovi titolo ed estratto tradotti automaticamente. Apri l’originale per il testo completo, il contesto e per sostenere il lavoro della redazione."
              }
            </LocalizedText>
          </p>
          <a
            href={`https://translate.google.com/translate?sl=${encodeURIComponent(publisherFor(article).language)}&tl=${encodeURIComponent(readingLanguage)}&u=${encodeURIComponent(safeWebUrl(article.link) ?? "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
              >
            <LocalizedText>
              {"Apri la pagina con Google Translate "}
            </LocalizedText>
            <ArrowUpRight size={14} />
          </a>
        </div>
        <details className="reader-embed">
          <summary>
            <LocalizedText>{"Anteprima del sito originale "}</LocalizedText>
            <ChevronDown size={16} />
          </summary>
          <p>
            <LocalizedText>
              {
                "Caricando l’anteprima contatti il sito della fonte. Alcuni editori bloccano l’incorporamento: in quel caso usa “Leggi sulla fonte”."
              }
            </LocalizedText>
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
              <LocalizedText>{"Carica anteprima esterna "}</LocalizedText>
              <ExternalLink size={15} />
            </button>
          )}
        </details>
        {related.length ? (
          <section className="reader-related">
            <p className="eyebrow">
              <LocalizedText>{"DALLA STESSA FONTE"}</LocalizedText>
            </p>
            {related.map((a) => (
              <button key={a.id} onClick={() => onSelect(a.id)}>
                <span>
                  <LocalizedText priority={2} from={a.language}>
                    {a.title}
                  </LocalizedText>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </section>
        ) : null}
        <p className="reader-attribution">
          <LocalizedText>
            {"Titolo ed estratto sono attribuiti a "}
          </LocalizedText>
          {article.sourceName}
          <LocalizedText>
            {
              ". La fonte originale rimane il riferimento per contenuto completo, aggiornamenti e correzioni."
            }
          </LocalizedText>
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
