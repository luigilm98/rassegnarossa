"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";

import { usePagePreparation } from "./InitialLoadBoundary";
import { translateAvailableText, normalizeLanguage } from "@/app/lib/translation";
import { createAvailabilityCircuit } from "@/app/lib/availability-circuit";
import { createTranslationQueue } from "@/app/lib/translation-queue";

let useDirectUntil = 0;
const translationHealth = createAvailabilityCircuit();
const failedKeys = new Set<string>();
const Locale = createContext("it");
export function useLocale() {
  return useContext(Locale);
}
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
let failed = false;
let retryVersion = 0;
let hydrated = false;
let currentReadingLanguage = "it";
const EN: Record<string, string> = {
  "La rassegna": "News",
  "Atlante delle fonti": "Source atlas",
  Biblioteca: "Library",
  Salvati: "Saved",
  "Il progetto": "About",
  "Vai ai contenuti": "Skip to content",
  "Lingua di lettura": "Reading language",
  "Tutte le lingue": "All languages",
  "Tutte le fonti": "All sources",
  "Aggiorna notizie": "Refresh news",
  Aggiornamento: "Updating",
  "Entra nella rassegna": "Explore the news",
  "Esplora la biblioteca": "Explore the library",
  "Osservatorio mondiale": "World watch",
  "Ultime 6 ore": "Last 6 hours",
  "Segnali dal mondo": "Signals from around the world",
  "Tutte le aree": "All regions",
  "Tutti gli argomenti": "All topics",
  Rilevanza: "Relevance",
  "Più recenti": "Newest first",
  Aggiorna: "Refresh",
  "Leggi e sostieni la fonte": "Read and support the publisher",
  "Leggi sulla fonte": "Read at the source",
  "Apri la fonte originale": "Open the original source",
  "Salva lettura": "Save for later",
  Salvato: "Saved",
  "Traduzione automatica": "Automatic translation",
  "Data non indicata": "Date not provided",
  "Nessuna notizia in questa finestra.": "No news in this time window.",
  "Fonti consultate": "Feeds checked",
  "Testate rappresentate": "Publishers represented",
  "Copertura parziale": "Partial coverage",
  "Come viene calcolato?": "How is this calculated?",
  "Lavoro e sindacati": "Labor and unions",
  "Imperialismo e guerra": "Imperialism and war",
  Italia: "Italy",
  Europa: "Europe",
  "Nord America": "North America",
  "America Latina": "Latin America",
  Africa: "Africa",
  Asia: "Asia",
  Oceania: "Oceania",
  Mondo: "World",
  Italiano: "Italian",
  Inglese: "English",
  Spagnolo: "Spanish",
  Francese: "French",
  Tedesco: "German",
  Portoghese: "Portuguese",
  Cinese: "Chinese",
  Russo: "Russian",
};
function emit() {
  listeners.forEach((listener) => listener());
}
function keyFor(text: string, from: string, to: string) {
  return `${from}|${to}|${text}`;
}
function hydrateCache() {
  if (hydrated || typeof localStorage === "undefined") return;
  hydrated = true;
  try {
    const data = JSON.parse(
      localStorage.getItem("rassegna-rossa.translations") ?? "null",
    );
    if (
      data?.savedAt > Date.now() - 86_400_000 &&
      Array.isArray(data.entries)
    ) {
      for (const entry of data.entries.slice(-800))
        if (
          Array.isArray(entry) &&
          entry.every((value) => typeof value === "string") &&
          entry.length === 2
        )
          memory.set(entry[0], entry[1]);
    }
  } catch {
    /* Translation caching is optional. */
  }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        "rassegna-rossa.translations",
        JSON.stringify({
          savedAt: Date.now(),
          entries: [...memory].slice(-800),
        }),
      );
    } catch {
      /* Storage may be unavailable. */
    }
  }, 600);
}
const translationQueue = createTranslationQueue(async (task) => {
  const pair = `${task.from}:${task.to}`;
  try {
    if (translationHealth.blocked(pair)) throw new Error("Translation providers temporarily unavailable");
    let value: string;
    try {
      if (Date.now() < useDirectUntil) throw new Error("Use public CORS endpoint");
      const response = await fetch("/api/translate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: task.text, from: task.from, to: task.to }),
        signal: AbortSignal.timeout(14000),
      });
      const data = await response.json();
      if (!response.ok || typeof data.translatedText !== "string" || !data.translatedText.trim()) throw new Error("Server translation unavailable");
      value = data.translatedText;
    } catch {
      useDirectUntil = Date.now() + 60_000;
      value = await translateAvailableText(task.text, task.from, task.to);
    }
    translationHealth.success(pair);
    if (memory.size >= 800) memory.delete(memory.keys().next().value!);
    memory.set(task.key, value);
    failedKeys.delete(task.key);
    failed = failedKeys.size > 0;
    emit(); persist();
    return value;
  } catch (error) {
    translationHealth.failure(pair);
    if (task.to === currentReadingLanguage) {
      failedKeys.add(task.key); failed = true; emit();
    }
    throw error;
  }
});
function translate(text: string, from: string, to: string, priority = 0) {
  from = normalizeLanguage(from);
  to = normalizeLanguage(to);
  if (from === to) return Promise.resolve(text);
  hydrateCache();
  const key = keyFor(text, from, to);
  if (memory.has(key)) return Promise.resolve(memory.get(key)!);
  if (failedKeys.has(key)) return Promise.resolve(null);
  return translationQueue.enqueue({ key, text, from, to, priority });
}
export function LocalizationProvider({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  useEffect(() => {
    currentReadingLanguage = normalizeLanguage(language);
    translationQueue.keepTarget(currentReadingLanguage);
    failedKeys.clear();
    failed = false;
    emit();
    document.documentElement.lang = language;
    document.documentElement.dir = ["ar", "fa"].includes(language)
      ? "rtl"
      : "ltr";
  }, [language]);
  return <Locale.Provider value={language}>{children}</Locale.Provider>;
}
/** Each text node stays owned by React; no DOM rewriting or third-party scripts. */
export function LocalizedText({
  children,
  from: originalLanguage = "it",
  priority = 0,
  defer = false,
}: {
  children?: ReactNode;
  from?: string;
  priority?: number;
  defer?: boolean;
}) {
  const { preparing, begin } = usePagePreparation();
  const to = normalizeLanguage(useLocale());
  const from = normalizeLanguage(originalLanguage);
  const anchor = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!defer);
  useEffect(() => {
    if (
      !defer ||
      !anchor.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [defer]);
  const text = typeof children === "string" ? children : "";
  const builtin = from === "it" && to === "en" ? EN[text.trim()] : undefined;
  const [result, setResult] = useState<{ key: string; value: string } | null>(
    null,
  );
  const key = keyFor(text, from, to);
  const retry = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => retryVersion,
    () => 0,
  );
  useEffect(() => {
    let live = true;
    if (
      ((preparing && priority > 0) || visible) &&
      text.trim() &&
      /\p{L}/u.test(text) &&
      from !== to &&
      !builtin &&
      text.length <= 2200
    ) {
      const finish = preparing && priority > 0 ? begin() : () => {};
      void translate(text, from, to, priority).then((value) => {
        if (live && value !== null) setResult({ key, value });
      }).finally(finish);
      return () => { live = false; finish(); };
    }
    return () => {
      live = false;
    };
  }, [text, from, to, key, builtin, visible, priority, retry, preparing, begin]);
  const translated = builtin ?? (result?.key === key ? result.value : null);
  const output =
    !text || from === to || translated === null
      ? children
      : `${text.match(/^\s*/)?.[0] ?? ""}${translated.trim()}${text.match(/\s*$/)?.[0] ?? ""}`;
  return defer ? (
    <span ref={anchor} lang={translated ? to : from}>
      {output}
    </span>
  ) : (
    <>{output}</>
  );
}
export function TranslationNotice() {
  const language = useLocale();
  const unavailable = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => failed,
    () => false,
  );
  const fallback: Record<string, string> = {
    it: "Traduzione non disponibile per alcuni testi: viene mostrato l’originale.",
    en: "Some translations are unavailable; original text is shown.",
    es: "Algunas traducciones no están disponibles; se muestra el original.",
    fr: "Certaines traductions sont indisponibles ; le texte original est affiché.",
    de: "Einige Übersetzungen sind nicht verfügbar; der Originaltext wird angezeigt.",
    pt: "Algumas traduções estão indisponíveis; o original é exibido.",
    ru: "Некоторые переводы недоступны; показан оригинал.",
    zh: "部分翻译暂不可用，显示原文。",
  };
  return (
    <p className="translation-notice" role="status">
      {unavailable ? (
        (fallback[language] ?? fallback.en)
      ) : (
        <LocalizedText>
          Traduzione automatica nella lingua di lettura. Apri e sostieni la fonte per il testo completo.
        </LocalizedText>
      )}
      {unavailable ? (
        <button
          className="text-link"
          onClick={() => {
            failedKeys.clear();
            translationHealth.clear();
            failed = false;
            useDirectUntil = 0;
            retryVersion++;
            emit();
          }}
        >
          <LocalizedText>Riprova traduzioni</LocalizedText>
        </button>
      ) : null}
    </p>
  );
}

export function LanguageName({ code }: { code: string }) {
  const locale = useLocale();
  try {
    return (
      <>
        {new Intl.DisplayNames([locale], { type: "language" }).of(code) ??
          code.toUpperCase()}
      </>
    );
  } catch {
    return <>{code.toUpperCase()}</>;
  }
}
export function LocalizedInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const locale = useLocale();
  const [translated, setTranslated] = useState({
    locale: "it",
    placeholder: props.placeholder,
    label: props["aria-label"],
  });
  useEffect(() => {
    let live = true;
    void Promise.all([
      props.placeholder ? translate(props.placeholder, "it", locale) : null,
      props["aria-label"] ? translate(props["aria-label"], "it", locale) : null,
    ]).then(([placeholder, label]) => {
      if (live)
        setTranslated({
          locale,
          placeholder: placeholder ?? props.placeholder,
          label: label ?? props["aria-label"],
        });
    });
    return () => {
      live = false;
    };
  }, [locale, props.placeholder, props["aria-label"]]);
  return (
    <input
      {...props}
      placeholder={
        translated.locale === locale
          ? translated.placeholder
          : props.placeholder
      }
      aria-label={
        translated.locale === locale ? translated.label : props["aria-label"]
      }
    />
  );
}
