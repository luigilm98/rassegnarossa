# Architettura e pubblicazione

## Flusso attuale

Il catalogo è disponibile già nella pagina. Il client raccoglie le notizie tramite `/api/articles`, con richieste indipendenti per ciascuna fonte. Il server seleziona le fonti dal catalogo, scopre i feed RSS/Atom, analizza gli elementi, attribuisce argomenti e punteggi euristici, deduplica per link e ordina i risultati. L'interfaccia applica ricerca e filtri e conserva gli articoli salvati in `localStorage`.

`/api/articles` limita ogni richiesta a 14 fonti, usa concorrenza 6 e restituisce al massimo 2.500 articoli. Il client parte da 16 canali, con sei richieste indipendenti concorrenti e fino a 24 articoli per fonte. La raccolta aggiuntiva è esplicita, a pagine di 16. Ogni richiesta client ha un timeout di 10 secondi e un’operazione di raccolta termina entro 25 secondi, conservando le risposte parziali. Le cache dei feed durano 10 minuti, quelle di scoperta un’ora; gli errori per un minuto. I feed dichiarati vengono contattati direttamente, senza aprire prima la homepage. La lettura è limitata a due indirizzi conosciuti e a un budget di otto secondi per fonte. Le risposte riuscite possono usare la cache edge per due minuti; la disponibilità dipende dal runtime.

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

`npm test` compila il Worker e verifica la homepage, le API senza dipendenze di rete, filtri, fusione degli articoli, validazione degli URL e recupero dei salvati. GitHub Actions esegue lo stesso comando su push a `main` e nelle pull request, senza credenziali di produzione. Non effettua prove complete dei feed né test browser.

## Pubblicazione

Il repository GitHub e il sito Sites hanno cicli di pubblicazione distinti. Gli identificativi del progetto e l’indirizzo associato al proprietario sono omessi dal repository pubblico. Nel checkout privato usato per pubblicare, la configurazione Sites deve contenere il `project_id` corretto. Non committare quel valore nel repository pubblico.

Per aggiornare quel sito, usare il plugin Sites: aprire il repository sorgente del medesimo progetto, trasferire le modifiche GitHub desiderate, eseguire le verifiche/build previste, sincronizzare i sorgenti e salvare/pubblicare la versione tramite il flusso Sites. Conservare identità e modalità di accesso e verificare l'esito del deploy. Il solo push GitHub non avvia questa procedura.

Non è configurato un deploy automatico da GitHub a Sites. Non copiare credenziali temporanee Sites nei workflow. GitHub Pages serve file statici e non può eseguire le API di questa applicazione. L'eventuale migrazione a un altro hosting richiede un runtime compatibile con il Worker, una configurazione dedicata, credenziali appropriate e verifiche di API e asset; non basta caricare `dist/client`.

Per il rollback del codice usare un commit di revert. Per il sito ripubblicare una versione Sites verificata; un revert su GitHub da solo non modifica la produzione.


## Organizzazione editoriale e lettura

La rassegna, l’atlante delle fonti, la biblioteca, il taccuino e la pagina sul metodo sono viste distinte. Il catalogo è disponibile subito nel client; i feed arrivano progressivamente e l’aggiornamento può essere interrotto. Un fallimento non riavvia automaticamente l’intera raccolta. I filtri sono locali, con controlli avanzati espandibili e caricamento progressivo delle schede per evitare liste enormi nel DOM.

Il lettore usa un dialog nativo con chiusura da tastiera e ritorno del focus. Il testo completo si apre presso la fonte. Il caricamento di iframe esterni e le traduzioni richiedono un’azione esplicita. Le immagini delle schede sono caricate dai relativi URL senza referrer; non tutte le fonti le forniscono.

`rassegna-rossa.saved` mantiene gli ID storici e `rassegna-rossa.saved-articles` conserva le schede. Il ripristino valida i dati e accetta solo link HTTP(S) senza credenziali incorporate. Vecchi ID diventano schede persistenti quando il relativo articolo viene ritrovato nel feed. Non è un archivio integrale degli articoli e non esiste sincronizzazione tra dispositivi.

Percorsi e glossario sono contenuti introduttivi redatti nel progetto; le copertine tipografiche sono decorative. I link della biblioteca distinguono testi integrali e portali di approfondimento. Non sono aggiunte notizie dimostrative ai feed reali.


## Lingua, fonti visibili e cache del browser

La lingua preferita deriva da `navigator.languages` o dalla scelta manuale in `rassegna-rossa.language`: la priorità non usa GPS né servizi di geolocalizzazione IP. Influisce sull’ordine di testate e titoli senza nascondere altre lingue. Il filtro lingua rimane un controllo distinto. Il periodo iniziale è di 30 giorni; aprendo una fonte vengono mostrati tutti gli articoli recuperati, anche quelli più vecchi.

`rassegna-rossa.feed-cache` conserva fino a 300 schede. Una copia di meno di dieci minuti viene riutilizzata senza avviare automaticamente un’altra raccolta. Fino a un giorno può essere mostrata durante un aggiornamento; la data di recupero è visibile. La cache non è una cronologia delle aperture degli articoli e può essere eliminata dai dati del browser.

OttolinaTV, Dazibao e la rubrica Dazibao di OttolinaTV sono raggiungibili direttamente dalla rassegna, anche senza articoli recuperati. I canali YouTube configurati possono leggere i titoli dalla sezione pubblica dei video: il parser usa JSON senza eseguire script, accetta solo il tab selezionato ed evita di inventare date esatte da etichette relative. Se il formato cambia o il sito blocca la richiesta, rimane il link alla fonte originale.

Fonti aggiunte in questa revisione: Dazibao (`youtube.com/@dazibao`), Pagine Esteri (`pagineesteri.it/feed/`), Radio Onda d’Urto (`radiondadurto.org/feed/`) e Radio Onda Rossa (feed completo pubblicato nella pagina “Segui”). Verificare periodicamente questi indirizzi: un controllo riuscito non garantisce disponibilità futura.
