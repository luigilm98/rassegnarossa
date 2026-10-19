"use client";
import { lazy, Suspense, useState } from "react";
import { ArrowUpRight, BookOpen, Bookmark, BookmarkCheck, Search, X } from "lucide-react";
import { THEORY_LIBRARY, BOOK_LANGUAGES } from "@/app/data/library";
import { READING_PATHS, GLOSSARY } from "@/app/data/editorial";
import { LocalizedText, LocalizedInput, useLocale } from "./Localization";
const ALL = "all";
const SocialAchievements = lazy(() => import('./SocialAchievements'));
const availableLanguages = [...new Set(THEORY_LIBRARY.flatMap(book => book.editions?.map(edition => edition.language) ?? []))].sort((a,b) => (BOOK_LANGUAGES[a] ?? a).localeCompare(BOOK_LANGUAGES[b] ?? b));
export function LibraryView({
  query,
  setQuery,
  savedBooks,
  onToggleBook,
}: {
  query: string;
  setQuery: (s: string) => void;
  savedBooks: Set<string>;
  onToggleBook: (id: string) => void;
}) {
  const readingLanguage = useLocale();
  const [bookLanguage, setBookLanguage] = useState("all");
  const [showAchievements, setShowAchievements] = useState(false);
  const readingLink = (book: typeof THEORY_LIBRARY[number]) => {
    const preferred = bookLanguage === "all" ? readingLanguage : bookLanguage;
    const edition = book.editions?.find(item => item.language === preferred) ?? book.editions?.find(item => item.language === "en") ?? book.editions?.[0];
    return edition ? `/read?${new URLSearchParams({ book: book.id, edition: edition.language })}` : book.links[0]?.url;
  };
  const [path, setPath] = useState("all");
  const active = READING_PATHS.find((p) => p.id === path);
  const books = THEORY_LIBRARY.filter(
    (book) =>
      Boolean(book.editions?.length) &&
      (bookLanguage === "all" || book.editions?.some(edition => edition.language === bookLanguage)) &&
      (!active || active.books.includes(book.id)) &&
      `${book.title} ${book.author} ${book.summary} ${book.tags.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="library-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <LocalizedText>
              {"NON SERVE LEGGERE TUTTO. SERVE INIZIARE."}
            </LocalizedText>
          </p>
          <h2>
            <LocalizedText>{"Leggere, cooperare, cambiare."}</LocalizedText>
          </h2>
        </div>
        <BookOpen size={24} strokeWidth={1.3} />
      </div>
      <section className="achievements-showcase">
        <button className="achievements-entry" aria-expanded={showAchievements} aria-controls="social-showcase-content" onClick={() => setShowAchievements(open => !open)}>
          <span className="achievements-entry-mark" aria-hidden="true">✦</span>
          <span><span className="eyebrow"><LocalizedText>LA MEMORIA CHE COSTRUISCE IL FUTURO</LocalizedText></span><strong><LocalizedText>Le conquiste del socialismo</LocalizedText></strong><small><LocalizedText>Lavoro, scuola, salute e dignità · dall’Italia al mondo</LocalizedText></small></span>
          <span className="achievements-entry-action"><LocalizedText>{showAchievements ? 'Chiudi la vetrina' : 'Esplora la vetrina'}</LocalizedText><ArrowUpRight size={19}/></span>
        </button>
        <div id="social-showcase-content" hidden={!showAchievements}>{showAchievements && <Suspense fallback={<p className="notice" role="status"><LocalizedText>Apertura della raccolta…</LocalizedText></p>}><SocialAchievements/></Suspense>}</div>
      </section>
      <div className="reading-paths">
        {READING_PATHS.map((p, i) => (
          <button
            className={`reading-path ${path === p.id ? "active" : ""}`}
            key={p.id}
            onClick={() => setPath(path === p.id ? ALL : p.id)}
            aria-pressed={path === p.id}
          >
            <span className="path-number">
              <LocalizedText>{"0"}</LocalizedText>
              <LocalizedText>{i + 1}</LocalizedText>
            </span>
            <span className="eyebrow">
              <LocalizedText>{p.subtitle}</LocalizedText>
            </span>
            <h3>
              <LocalizedText>{p.title}</LocalizedText>
            </h3>
            <p>
              <LocalizedText>{p.description}</LocalizedText>
            </p>
            <span className="path-link">
              <LocalizedText>{p.books.length}</LocalizedText>
              <LocalizedText>{" letture "}</LocalizedText>
              <ArrowUpRight size={17} />
            </span>
          </button>
        ))}
      </div>
      <div className="library-toolbar">
        <div>
          <p className="eyebrow">
            <LocalizedText>{"TESTI E ORIZZONTI"}</LocalizedText>
          </p>
          <h2>
            <LocalizedText>
              {active?.title ?? "La biblioteca aperta"}
            </LocalizedText>
          </h2>
        </div>
        <label className="search-box">
          <Search size={17} />
          <LocalizedInput
            aria-label="Cerca nella biblioteca"
            placeholder="Un autore, un testo, un concetto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {active ? (
          <button className="text-link" onClick={() => setPath(ALL)}>
            <LocalizedText>{"Tutti i testi "}</LocalizedText>
            <X size={15} />
          </button>
        ) : null}
      </div>
      <div className="library-language-bar">
        <label><LocalizedText>Lingua delle edizioni</LocalizedText><select value={bookLanguage} onChange={event => setBookLanguage(event.target.value)} aria-label="Lingua delle edizioni dei libri"><option value="all">Tutte le lingue</option>{availableLanguages.map(code => <option key={code} value={code}>{BOOK_LANGUAGES[code] ?? code}</option>)}</select></label>
        <p><strong>{books.length}</strong> <LocalizedText>libri e saggi gratuiti</LocalizedText> · {availableLanguages.length} <LocalizedText>lingue disponibili</LocalizedText></p>
        <small><LocalizedText>Accedi per leggere nel sito e ritrovare la tua ultima pagina su ogni dispositivo.</LocalizedText></small>
      </div>
      <div className="book-grid">
        {books.map((book, index) => (
          <article className="book-card" key={book.id}>
            <a href={readingLink(book)}
              className={`book-cover book-tone-${index % 4}`}
              aria-label={`Leggi ${book.title}`}
            >
              <span>
                <LocalizedText defer>
                  {"LA BIBLIOTECA / RASSEGNA ROSSA"}
                </LocalizedText>
              </span>
              <strong>
                <LocalizedText defer>{book.title}</LocalizedText>
              </strong>
              <em>{book.author}</em>
              <span className="cover-year">
                <LocalizedText defer>{book.period}</LocalizedText>
              </span>
            </a>
            <div className="book-info">
              <p className="eyebrow">
                <LocalizedText defer>{book.lane}</LocalizedText>
              </p>
              <h3><a href={readingLink(book)}><LocalizedText defer>{book.title}</LocalizedText></a></h3>
              <p className="book-author">
                {book.author}
                <LocalizedText defer>{" · "}</LocalizedText>
                <LocalizedText defer>{book.period}</LocalizedText>
              </p>
              <p>
                <LocalizedText defer>{book.summary}</LocalizedText>
              </p>
              <button className={`text-link book-save ${savedBooks.has(book.id) ? "is-saved" : ""}`} onClick={() => onToggleBook(book.id)} aria-pressed={savedBooks.has(book.id)}>
                {savedBooks.has(book.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}<LocalizedText defer>{savedBooks.has(book.id) ? "Libro salvato" : "Salva libro"}</LocalizedText>
              </button>
              <a className="book-read-link" href={readingLink(book)}><BookOpen size={17}/><LocalizedText defer>Leggi online</LocalizedText><ArrowUpRight size={17}/></a>
              <p className="book-edition-count">{book.editions?.length} <LocalizedText defer>edizioni linguistiche</LocalizedText> · <LocalizedText defer>{book.level === "base" ? "Per iniziare" : book.level === "avanzato" ? "Approfondimento" : "Lettura intermedia"}</LocalizedText></p>
              <div className="book-links">
                {book.links.map((link) => (
                  <a
                    href={link.url}
                    key={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LocalizedText defer>{link.label}</LocalizedText>
                    <ArrowUpRight size={15} />
                  </a>
                ))}
              </div>
              <small>
                <LocalizedText defer>
                  {["dipendenza", "femminismo-marxista"].includes(book.id)
                    ? "Percorso tematico: i link portano a riviste e archivi di approfondimento."
                    : book.id === "gramsciana"
                      ? "Il link porta alla Fondazione Gramsci, non al testo integrale dei Quaderni."
                      : "Testo disponibile presso l’archivio esterno indicato."}
                </LocalizedText>
              </small>
            </div>
          </article>
        ))}
      </div>
      {!books.length ? (
        <div className="notice">
          <LocalizedText>
            {
              "Nessun testo trovato. Prova un altro autore o cancella la ricerca."
            }
          </LocalizedText>
        </div>
      ) : null}
      <details className="library-resources"><summary><LocalizedText>Archivi e percorsi di approfondimento</LocalizedText></summary>{THEORY_LIBRARY.filter(book => !book.editions?.length).map(book => <p key={book.id}><strong>{book.title}</strong> — {book.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗ </a>)}</p>)}</details>
      <section className="glossary">
        <div>
          <p className="eyebrow">
            <LocalizedText>{"LE PAROLE PER ORIENTARSI"}</LocalizedText>
          </p>
          <h2>
            <LocalizedText>{"Un piccolo lessico,"}</LocalizedText>
            <br />
            <em>
              <LocalizedText>{"una porta d’ingresso."}</LocalizedText>
            </em>
          </h2>
          <p>
            <LocalizedText>
              {
                "Definizioni introduttive, non esaustive. I concetti assumono significati diversi nelle diverse tradizioni: i testi sono il luogo per approfondirli."
              }
            </LocalizedText>
          </p>
        </div>
        <div>
          {GLOSSARY.map((g) => (
            <details key={g.term}>
              <summary>
                <LocalizedText>{g.term}</LocalizedText>
                <span>
                  <LocalizedText>{"+"}</LocalizedText>
                </span>
              </summary>
              <p>
                <LocalizedText>{g.definition}</LocalizedText>
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}


export function SavedBooks({ savedBooks, query, onToggleBook }: {
  savedBooks: Set<string>; query: string; onToggleBook: (id: string) => void;
}) {
  const language = useLocale();
  const selectedBooks = THEORY_LIBRARY.filter(book => savedBooks.has(book.id) &&
    `${book.title} ${book.author}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="saved-books" aria-label="Libri salvati">
    <h3><LocalizedText>Libri salvati</LocalizedText></h3>
    {selectedBooks.map(book => {
      const edition = book.editions?.find(item => item.language === language) ?? book.editions?.find(item => item.language === "en") ?? book.editions?.[0];
      const href = edition ? `/read?${new URLSearchParams({ book: book.id, edition: edition.language })}` : book.links[0].url;
      return <article key={book.id}>
        <div>
          <strong><LocalizedText>{book.title}</LocalizedText></strong>
          <p>{book.author}</p>
          <a href={href}><LocalizedText>Apri il testo</LocalizedText><ArrowUpRight size={14} /></a>
        </div>
        <button className="save-button is-saved" onClick={() => onToggleBook(book.id)} aria-label={`Rimuovi libro dai salvati: ${book.title}`}><BookmarkCheck size={18} /></button>
      </article>;
    })}
  </section>;
}
