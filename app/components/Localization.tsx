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

const Locale = createContext("it");
export function useLocale() {
  return useContext(Locale);
}
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
let failed = false;
let retryVersion = 0;
let hydrated = false;
let active = 0;
const pending: {
  key: string;
  text: string;
  from: string;
  to: string;
  priority: number;
  done: (value: string | null) => void;
}[] = [];
const requests = new Map<string, Promise<string | null>>();
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
function drain() {
  while (active < 3 && pending.length) {
    const task = pending.shift()!;
    if (failed) {
      requests.delete(task.key);
      task.done(null);
      continue;
    }
    active++;
    void (async () => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: task.text,
            from: task.from,
            to: task.to,
          }),
          signal: AbortSignal.timeout(14000),
        });
        const data = await response.json();
        if (!response.ok || typeof data.translatedText !== "string")
          throw new Error("Translation unavailable");
        if (memory.size >= 800) memory.delete(memory.keys().next().value!);
        memory.set(task.key, data.translatedText);
        persist();
        task.done(data.translatedText);
      } catch {
        failed = true;
        emit();
        requests.delete(task.key);
        task.done(null);
      } finally {
        requests.delete(task.key);
        active--;
        drain();
      }
    })();
  }
}
function translate(text: string, from: string, to: string, priority = 0) {
  if (from === to) return Promise.resolve(text);
  hydrateCache();
  const key = keyFor(text, from, to);
  if (memory.has(key)) return Promise.resolve(memory.get(key)!);
  if (requests.has(key)) return requests.get(key)!;
  const promise = new Promise<string | null>((done) => {
    pending.push({ key, text, from, to, priority, done });
    pending.sort((a, b) => b.priority - a.priority);
  });
  requests.set(key, promise);
  drain();
  return promise;
}
export function LocalizationProvider({
  language,
  children,
}: {
  language: string;
  children: ReactNode;
}) {
  useEffect(() => {
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
  from = "it",
  priority = 0,
  defer = false,
}: {
  children?: ReactNode;
  from?: string;
  priority?: number;
  defer?: boolean;
}) {
  const to = useLocale();
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
      visible &&
      text.trim() &&
      /\p{L}/u.test(text) &&
      from !== to &&
      !builtin &&
      text.length <= 2200
    ) {
      void translate(text, from, to, priority).then((value) => {
        if (live && value !== null) setResult({ key, value });
      });
    }
    return () => {
      live = false;
    };
  }, [text, from, to, key, builtin, visible, priority, retry]);
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
          Interfaccia, titoli ed estratti vengono tradotti automaticamente con
          MyMemory. Le traduzioni possono contenere errori. Apri e sostieni la
          fonte per il testo completo.
        </LocalizedText>
      )}
      {unavailable ? (
        <button
          className="text-link"
          onClick={() => {
            failed = false;
            requests.clear();
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
