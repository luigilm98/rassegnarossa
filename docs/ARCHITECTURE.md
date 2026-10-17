# Architettura e pubblicazione

## Flusso attuale

La pagina React richiede il catalogo a `/api/sources` e aggiorna le notizie in gruppi di fonti tramite `/api/articles`. Il server seleziona le fonti dal catalogo, scopre i feed RSS/Atom, analizza gli elementi, attribuisce argomenti e punteggi euristici, deduplica per link e ordina i risultati. L'interfaccia applica ricerca e filtri e conserva gli articoli salvati in `localStorage`.

`/api/articles` limita ogni richiesta a 14 fonti, usa concorrenza 6 e restituisce al massimo 2.500 articoli. Il client usa gruppi da 10 fonti. Le cache dei feed durano 10 minuti, quelle di scoperta un'ora; gli errori dei feed sono memorizzati per un intervallo inferiore. Tutto resta nella memoria dell'istanza, senza garanzia di persistenza.

`POST /api/translate` inoltra il testo a MyMemory, limita l'input a 2.200 caratteri e suddivide le richieste in blocchi. La cache dura 24 ore in memoria. Quando la lingua sorgente è `auto`, l'implementazione usa `en` per MyMemory: non è rilevamento automatico affidabile. I collegamenti alla traduzione di pagine aprono Google Translate.

## Confini e dipendenze

- UI: React/TypeScript in `app/components`, stile in `app/globals.css`.
- API e rendering: vinext su Cloudflare Workers, compilati con Vite.
- Dati editoriali: catalogo e biblioteca tracciati in Git.
- Preferiti: browser locale, nessun account o database applicativo per sincronizzarli.
- Fonti esterne: homepage, RSS/Atom, ricerca radar, MyMemory e traduzione delle pagine.
- `db/`, Drizzle ed esempi D1 sono predisposizioni dello starter. `.openai/hosting.json` dichiara `d1` e `r2` nulli.
- Gli helper di autenticazione inclusi sono infrastruttura; non implicano account o autorizzazioni implementati per i preferiti.

Una fonte irraggiungibile non dimostra assenza di notizie. Parsing XML, ranking e classificazioni restano euristici. Il programma non archivia una copia autorevole degli articoli.

## Verifica

`npm test` compila il Worker e importa il risultato in un test Node per verificare la risposta HTML della homepage e alcuni contratti di prodotto. GitHub Actions esegue lo stesso comando su push a `main` e nelle pull request, senza credenziali di produzione. Non effettua prove complete dei feed né test browser.

## Pubblicazione

Il repository GitHub e il sito Sites hanno cicli di pubblicazione distinti. Gli identificativi del progetto e l’indirizzo associato al proprietario sono omessi dal repository pubblico. Nel checkout privato usato per pubblicare, la configurazione Sites deve contenere il `project_id` corretto. Non committare quel valore nel repository pubblico.

Per aggiornare quel sito, usare il plugin Sites: aprire il repository sorgente del medesimo progetto, trasferire le modifiche GitHub desiderate, eseguire le verifiche/build previste, sincronizzare i sorgenti e salvare/pubblicare la versione tramite il flusso Sites. Conservare identità e modalità di accesso e verificare l'esito del deploy. Il solo push GitHub non avvia questa procedura.

Non è configurato un deploy automatico da GitHub a Sites. Non copiare credenziali temporanee Sites nei workflow. GitHub Pages serve file statici e non può eseguire le API di questa applicazione. L'eventuale migrazione a un altro hosting richiede un runtime compatibile con il Worker, una configurazione dedicata, credenziali appropriate e verifiche di API e asset; non basta caricare `dist/client`.

Per il rollback del codice usare un commit di revert. Per il sito ripubblicare una versione Sites verificata; un revert su GitHub da solo non modifica la produzione.
