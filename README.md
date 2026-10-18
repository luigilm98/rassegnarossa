# Rassegna Rossa

Aggregatore di fonti socialiste, comuniste, sindacali e anticoloniali da tutto il mondo. Riunisce feed RSS/Atom, canali radar tematici e una biblioteca di teoria politica in un’interfaccia multilingue.

## Funzioni attuali

- Notizie filtrabili per regione, lingua, fonte, orientamento, tipo e argomento.
- Ricerca, ordinamento, finestra temporale e aggiornamento dei feed.
- Priorità politica e formativa: organizzarsi, studiare, acquisire competenze e capire i rapporti di potere. Ordinamento dedicato, senza clic o trend come segnali.
- Atlante completo per aree, con testate, radar e fonti scoperte distinti e sezioni espandibili.
- Catalogo di 130 testate, canali e risorse, distinto dai 136 radar di ricerca.
- Lingua di lettura e lingua delle fonti in analisi hanno controlli sempre visibili e preferenze distinti. È possibile leggere in italiano analizzando fonti di qualsiasi lingua.
- Tutte le 266 fonti e ricerche partecipano automaticamente: sei richieste parallele per le fonti dirette e due per i radar, risposte indipendenti, cache locale e nessun pulsante per caricare altre fonti.
- Traduzione automatica di interfaccia, citazioni, titoli ed estratti nella lingua di lettura; cache locale, concorrenza limitata e Google Translate e MyMemory come servizi alternativi, senza fermare la coda al primo errore.
- Apertura immediata sulla rassegna: testata compatta, citazione a fine pagina e filtri raccolti in un pannello.
- Ordine selezionabile: in evidenza dalle fonti, ultimi articoli, più letti sulle fonti, priorità politica e formativa.
- Le selezioni delle testate provengono dal loro HTML pubblico, separatamente dai feed. Nessun contatore di letture interno. “Più letti” usa soltanto classifiche pubblicate dalle fonti; se mancano, l’interfaccia lo segnala.
- Osservatorio delle ultime sei ore: notizie da tutta la rete raccolta e da otto canali regionali aggiuntivi, filtri, attività oraria e collegamenti diretti alle testate, senza punteggi nelle schede.
- Marchio essenziale con libro aperto e stella, “rassegna” rossa e “rossa” nera, senza note musicali; citazioni documentate di Marx, Gramsci, Lenin e Mao, diverse a ogni ricaricamento nella sessione.
- Raccolta personale di articoli e libri: accesso con ChatGPT e copia privata persistente sul server; importazione dei salvataggi locali esistenti. Senza accesso resta una copia sul dispositivo, indicata come tale.
- Biblioteca con tre itinerari di lettura, ricerca per autore e concetto, e un glossario introduttivo.
- Sei percorsi tematici e una pagina trasparente su metodo, attribuzione e limiti.
- Lettore in una finestra dedicata, con invito a leggere e sostenere l’editore, traduzione automatica e anteprima esterna facoltativa.

Le etichette e i punteggi sono euristiche del catalogo, non verifiche di attendibilità. I contenuti restano attribuiti e collegati agli editori originali.

## Avvio locale

Richiede Node.js **22.13.0 o superiore** e npm. La CI usa Node.js 24.

```sh
npm ci
npm run dev
```

Aprire l'indirizzo mostrato dal server. Per compilare e verificare:

```sh
npm run build
npm test
```

`npm test` compila il progetto e verifica rendering e API senza rete, filtri, fusione degli aggiornamenti e ripristino dei salvataggi. Non verifica la disponibilità di tutti i feed esterni, la qualità delle traduzioni o il comportamento completo nei browser.

## Mappa del repository

| Percorso | Responsabilità |
| --- | --- |
| `app/components/AggregatorApp.tsx` | Interfaccia, filtri, aggiornamenti, traduzioni e salvataggi locali |
| `app/data/catalog.ts` | Fonti, tassonomia e canali radar |
| `app/data/library.ts` | Biblioteca di teoria |
| `app/data/editorial.ts` | Percorsi tematici, itinerari e glossario |
| `app/lib/reading.ts` | Filtri, fusione degli articoli, URL e ripristino dei salvati |
| `app/lib/collection.ts` | Raccolta automatica completa, ordine equilibrato, timeout e cancellazione |
| `app/lib/editorial-ranking.ts` | Segnali politici e formativi, deduplicazione e diversità editoriale |
| `app/lib/source-selection.ts` | Preferenze linguistiche indipendenti e fonti consigliate |
| `app/components/Localization.tsx` | Traduzioni React, coda, cache e scelta della lingua |
| `app/components/WorldWatch.tsx` | Osservatorio mondiale indipendente e relativi controlli |
| `app/lib/source-highlights.ts` | Selezioni e classifiche pubbliche delle testate, riconciliazione con i feed |
| `app/api/highlights/route.ts` | Lettura limitata delle pagine di fonti configurate, cache e fallimenti indipendenti |
| `app/lib/publisher.ts` | Paese e lingua della testata, distinti dall’edizione radar |
| `app/lib/bookmarks.ts` | Archivio privato per account, validazione e rimozioni persistenti |
| `app/components/CloudBookmarks.ts` | Accesso, importazione locale e sincronizzazione dei salvataggi |
| `app/lib/stable-news.ts` | Ordine stabile delle schede durante la raccolta |
| `app/lib/pulse.ts` | Finestra mobile di sei ore, raggruppamento e ranking |
| `app/api/pulse/route.ts` | Raccolta da destinazioni regionali fisse |
| `app/data/quotes.ts` | Citazioni, provenienza e rotazione |
| `app/lib/youtube.ts` | Lettura dei titoli pubblici dalla scheda video dei canali configurati |
| `app/api/sources/route.ts` | Catalogo e filtri disponibili |
| `app/api/articles/route.ts` | Raccolta concorrente, deduplicazione e ordinamento |
| `app/lib/feed.ts` | Scoperta e parsing RSS/Atom, cache e punteggi |
| `app/api/translate/route.ts` | Traduzione con servizi alternativi e cache in memoria |
| `app/lib/translation-queue.ts` | Coda indipendente per testo, priorità e cambio della lingua di lettura |
| `worker/index.ts` | Entrata Cloudflare Worker |
| `.openai/hosting.json` | Identità del sito Sites e binding |
| `tests/` | Verifiche automatiche del rendering |
| `.github/workflows/` | Controlli GitHub Actions |

Stack: React, TypeScript, vinext, Vite e Cloudflare Workers. Il progetto conserva le integrazioni del runtime Sites. D1 conserva le raccolte personali private; R2 non è utilizzato.

## Documentazione e contributi

- [Architettura e deploy](docs/ARCHITECTURE.md): flusso dei dati, runtime e limiti.
- [Contribuire](CONTRIBUTING.md): sviluppo e verifica delle modifiche.
- [AGENTS.md](AGENTS.md): regole comuni per Codex e altri assistenti.
- [Istruzioni Copilot](.github/copilot-instructions.md): rinvio alla guida comune.

## Pubblicazione e limiti

GitHub contiene i sorgenti e avvia i controlli automatici su `main` e nelle pull request. Il servizio pubblicato è ospitato su Sites: un push su GitHub **non aggiorna automaticamente** quel sito. GitHub Pages non esegue le API server necessarie a feed e traduzioni. Vedere [la procedura di deploy](docs/ARCHITECTURE.md#pubblicazione).

Le cache dei feed rimangono temporanee; le raccolte personali degli utenti autenticati sono persistenti in D1 e separate per account. L’accesso è necessario per recuperarle dopo la cancellazione completa dei dati del browser. Feed, ricerca radar e traduzioni dipendono da servizi esterni, dai loro limiti e dai loro cambiamenti. La suite attuale non copre in modo esaustivo parser, accessibilità, rete o browser. Non sono inclusi credenziali, dati di produzione o dipendenze installate. Questo repository non aggiunge una licenza: verificare i diritti prima di redistribuire codice o contenuti di terzi.

I sorgenti pubblici non includono identificativi di hosting specifici del proprietario.
