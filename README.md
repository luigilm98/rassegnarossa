# Rassegna Rossa

Aggregatore di fonti socialiste, comuniste, sindacali e anticoloniali da tutto il mondo. Riunisce feed RSS/Atom, canali radar tematici e una biblioteca di teoria politica in un’interfaccia multilingue.

## Funzioni attuali

- Notizie filtrabili per regione, lingua, fonte, orientamento, tipo e argomento.
- Ricerca, ordinamento, finestra temporale e aggiornamento dei feed.
- Priorità politica e formativa: organizzarsi, studiare, acquisire competenze e capire i rapporti di potere. Criterio automatico spiegabile su ogni scheda, senza clic o trend come segnali.
- Atlante completo per aree, con testate, radar e fonti scoperte distinti e sezioni espandibili.
- Catalogo di 129 testate, canali e risorse, distinto dai 136 radar di ricerca.
- Lingua di lettura e lingua delle fonti in analisi hanno controlli e preferenze distinti. È possibile leggere in italiano analizzando fonti di qualsiasi lingua.
- Tutte le 265 fonti e ricerche partecipano automaticamente: dieci richieste parallele, risposte indipendenti, cache locale e nessun pulsante per caricare altre fonti.
- Traduzione automatica di interfaccia, citazioni, titoli ed estratti nella lingua di lettura; cache locale, concorrenza limitata e avviso se MyMemory non è disponibile.
- Fonti consigliate coerenti con la lingua scelta, comprese le lingue con soli radar.
- Osservatorio delle ultime sei ore: notizie da tutta la rete raccolta e da otto canali regionali aggiuntivi, filtri, attività oraria e collegamenti diretti alle testate, senza punteggi nelle schede.
- Marchio essenziale con libro aperto e stella, senza note musicali; citazioni documentate di Marx, Gramsci, Lenin e Mao, diverse a ogni ricaricamento nella sessione.
- Schede salvate nel browser tramite `localStorage`: titolo, estratto e link ritrovabili anche dopo una nuova visita.
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
| `app/lib/pulse.ts` | Finestra mobile di sei ore, raggruppamento e ranking |
| `app/api/pulse/route.ts` | Raccolta da destinazioni regionali fisse |
| `app/data/quotes.ts` | Citazioni, provenienza e rotazione |
| `app/lib/youtube.ts` | Lettura dei titoli pubblici dalla scheda video dei canali configurati |
| `app/api/sources/route.ts` | Catalogo e filtri disponibili |
| `app/api/articles/route.ts` | Raccolta concorrente, deduplicazione e ordinamento |
| `app/lib/feed.ts` | Scoperta e parsing RSS/Atom, cache e punteggi |
| `app/api/translate/route.ts` | Proxy MyMemory e cache in memoria |
| `worker/index.ts` | Entrata Cloudflare Worker |
| `.openai/hosting.json` | Identità del sito Sites e binding |
| `tests/` | Verifiche automatiche del rendering |
| `.github/workflows/` | Controlli GitHub Actions |

Stack: React, TypeScript, vinext, Vite e Cloudflare Workers. Il progetto conserva le integrazioni del runtime Sites. Gli esempi D1/Drizzle sono inclusi, ma il sito non dichiara database o bucket attivi.

## Documentazione e contributi

- [Architettura e deploy](docs/ARCHITECTURE.md): flusso dei dati, runtime e limiti.
- [Contribuire](CONTRIBUTING.md): sviluppo e verifica delle modifiche.
- [AGENTS.md](AGENTS.md): regole comuni per Codex e altri assistenti.
- [Istruzioni Copilot](.github/copilot-instructions.md): rinvio alla guida comune.

## Pubblicazione e limiti

GitHub contiene i sorgenti e avvia i controlli automatici su `main` e nelle pull request. Il servizio pubblicato è ospitato su Sites: un push su GitHub **non aggiorna automaticamente** quel sito. GitHub Pages non esegue le API server necessarie a feed e traduzioni. Vedere [la procedura di deploy](docs/ARCHITECTURE.md#pubblicazione).

Le cache dei feed sul server sono temporanee, con cache edge quando disponibile e una copia locale delle schede per le visite successive; non esiste sincronizzazione dei preferiti tra dispositivi. Feed, ricerca radar e traduzioni dipendono da servizi esterni, dai loro limiti e dai loro cambiamenti. La suite attuale non copre in modo esaustivo parser, accessibilità, rete o browser. Non sono inclusi credenziali, dati di produzione o dipendenze installate. Questo repository non aggiunge una licenza: verificare i diritti prima di redistribuire codice o contenuti di terzi.

I sorgenti pubblici non includono identificativi di hosting specifici del proprietario.
