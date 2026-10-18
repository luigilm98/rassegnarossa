"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, RefreshCcw } from "lucide-react";
import { rankPulse } from "@/app/lib/pulse";
import {
  restoreSavedArticles,
  mergeArticles,
  safeWebUrl,
  type ReadingArticle,
} from "@/app/lib/reading";
import { SOURCE_CATALOG, TOPIC_TAXONOMY } from "@/app/data/catalog";
import { LocalizedText as T, useLocale } from "./Localization";
import { createPublisherResolver } from "@/app/lib/publisher";
const publisherFor = createPublisherResolver(SOURCE_CATALOG);
const AREAS = [
  "europe",
  "north",
  "latin",
  "africa",
  "asia",
  "east",
  "mena",
  "pacific",
];
export function WorldWatch({ networkArticles }: { networkArticles: ReadingArticle[] }) {
  const locale = useLocale();
  const [articles, setArticles] = useState<ReadingArticle[]>([]);
  const [country, setCountry] = useState("all");
  const [topic, setTopic] = useState("all");
  const [hours, setHours] = useState(6);
  const [sort, setSort] = useState("signal");
  const [busy, setBusy] = useState(false);
  const [coverage, setCoverage] = useState({ done: 0, ok: 0 });
  const [now, setNow] = useState(Date.now());
  const [updatedAt, setUpdatedAt] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0);
  const refresh = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const current = ++run.current;
    setBusy(true);
    setCoverage({ done: 0, ok: 0 });
    setNow(Date.now());
    let cursor = 0;
    const worker = async () => {
      while (cursor < AREAS.length && !controller.signal.aborted) {
        const area = AREAS[cursor++];
        let ok = false;
        try {
          const response = await fetch(`/api/pulse?area=${area}`, {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(12000),
            ]),
          });
          const data = await response.json();
          if (!response.ok) throw new Error("Collection unavailable");
          const cards = restoreSavedArticles(JSON.stringify(data.articles));
          if (!data.ok && !cards.length) throw new Error("Collection unavailable");
          if (current === run.current)
            setArticles((previous) =>
              mergeArticles(previous, cards).filter(
                (article) =>
                  article.publishedAt &&
                  Date.parse(article.publishedAt) >= Date.now() - 21_600_000,
              ),
            );
          ok = Boolean(data.ok);
        } catch {
          /* One failed area never blocks the other results. */
        }
        if (current === run.current)
          setCoverage((previous) => ({
            done: previous.done + 1,
            ok: previous.ok + Number(ok),
          }));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (current === run.current) {
      setBusy(false);
      setUpdatedAt(Date.now());
      setNow(Date.now());
    }
  };
  useEffect(() => {
    void refresh();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 300_000);
    return () => {
      abort.current?.abort();
      run.current++;
      clearInterval(tick);
      clearInterval(refreshTimer);
    };
    // Collection is independent of the language and the main news filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const allStories = useMemo(
    () => rankPulse([...networkArticles, ...articles], now),
    [networkArticles, articles, now],
  );
  const countries = [...new Set(allStories.flatMap(story => story.coverage.map(article => publisherFor(article).country ?? "Paese non verificato")))].sort();
  const stories = allStories.flatMap(story => {
    const eligible = story.coverage.filter(article =>
      (country === "all" || (publisherFor(article).country ?? "Paese non verificato") === country) &&
      (topic === "all" || article.topics.includes(topic)) &&
      Date.parse(article.publishedAt!) >= now - hours * 3_600_000);
    return eligible.length ? [{ ...story, article: eligible[0] }] : [];
  });
  if (sort === "fresh")
    stories.sort(
      (a, b) =>
        Date.parse(b.article.publishedAt!) - Date.parse(a.article.publishedAt!),
    );
  const time = (value: number) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  return (
    <aside
      className="world-watch"
      data-initial-pending={busy || !updatedAt ? "true" : undefined}
      aria-label="Osservatorio mondiale delle ultime sei ore"
    >
      <div className="watch-heading">
        <p className="eyebrow">
          <span className="live-dot" /> <T>OSSERVATORIO MONDIALE</T>
        </p>
        <strong>
          06<span>h</span>
        </strong>
      </div>
      <h3>
        <T>Segnali dal mondo</T>
      </h3>
      <p className="watch-deck">
        <T>
          Le ultime sei ore dalla rete di fonti e dalle raccolte internazionali.
          Apri i titoli per leggere direttamente dalle testate.
        </T>
      </p>
      <div className="watch-stats">
        <div>
          <strong>{allStories.length}</strong>
          <T>notizie recenti</T>
        </div>
        <div>
          <strong>
            {
              new Set(
                allStories.flatMap((story) =>
                  story.coverage.map((article) => article.sourceName),
                ),
              ).size
            }
          </strong>
          <T>testate rappresentate</T>
        </div>
      </div>
      <details className="watch-filters">
        <summary><T>Filtra l’osservatorio</T></summary>
      <div className="watch-controls">
        <label>
          <T>Paese della testata</T>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="all">
              <T>Tutti i paesi</T>
            </option>
            {countries.map((value) => (
              <option key={value} value={value}>
                <T>{value}</T>
              </option>
            ))}
          </select>
        </label>
        <label>
          <T>Argomento</T>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            <option value="all">
              <T>Tutti gli argomenti</T>
            </option>
            {TOPIC_TAXONOMY.map((item) => (
              <option key={item.id} value={item.id}>
                <T>{item.label}</T>
              </option>
            ))}
          </select>
        </label>
        <label>
          <T>Periodo</T>
          <select
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          >
            {[1, 3, 6].map((value) => (
              <option key={value} value={value}>
                {value} h
              </option>
            ))}
          </select>
        </label>
        <label>
          <T>Ordina</T>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="signal">
              <T>Rilevanza</T>
            </option>
            <option value="fresh">
              <T>Più recenti</T>
            </option>
          </select>
        </label>
      </div>
      </details>
      <div className="watch-status" role="status">
        <span>
          {busy ? (
            <>
              <T>Raccolte aggiornate</T> {coverage.done}/{AREAS.length}
            </>
          ) : (
            <>
              <T>Raccolte disponibili</T> {coverage.ok}/{AREAS.length}
            </>
          )}
        </span>
        <button
          disabled={busy}
          onClick={() => void refresh()}
          aria-label="Aggiorna osservatorio"
        >
          <RefreshCcw size={14} />
        </button>
      </div>
      <ol className="watch-stories">
        {stories.slice(0, 12).map((story) => (
          <li key={story.article.id}>
            <div className="watch-story-meta">
              <time dateTime={story.article.publishedAt!}>
                {time(Date.parse(story.article.publishedAt!))}
              </time>
            </div>
            <a
              className="watch-title"
              href={safeWebUrl(story.article.link) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <T priority={3} from={publisherFor(story.article).language}>
                {story.article.title}
              </T>
              <ArrowUpRight size={14} />
            </a>
            <p className="watch-publisher">
              <span>{story.article.sourceName}</span>
              <span className="watch-country"><T>{publisherFor(story.article).country ?? "Paese non verificato"}</T></span>
            </p>
          </li>
        ))}
      </ol>
      {!stories.length ? (
        <p className="watch-empty">
          <T>
            {busy
              ? "Le aree rispondono separatamente. Le prime notizie compariranno qui."
              : "Nessuna notizia in questa finestra."}
          </T>
        </p>
      ) : null}
      <p className="watch-footnote">
        <T>Finestra mobile</T> {time(now - 21_600_000)}–{time(now)}.{" "}
        {updatedAt ? (
          <>
            <T>Ultimo tentativo</T> {time(updatedAt)}.
          </>
        ) : null}{" "}
        <T>
          Aggiornamento ogni cinque minuti a pagina visibile. Apri e sostieni le
          fonti originali.
        </T>
      </p>
    </aside>
  );
}
