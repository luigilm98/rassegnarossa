# Architettura e pubblicazione

## Flusso attuale

Il catalogo è disponibile già nella pagina. Il client raccoglie le notizie tramite `/api/articles`, con richieste indipendenti per ciascuna fonte. Il server seleziona le fonti dal catalogo, scopre i feed RSS/Atom, analizza gli elementi, attribuisce argomenti e punteggi euristici, deduplica per link e ordina i risultati. L'interfaccia applica ricerca e filtri e conserva gli articoli salvati in `localStorage`.

`/api/articles` limita ogni richiesta a 14 fonti, usa concorrenza 6 e restituisce al massimo 2.500 articoli. Il client parte da 16 canali, con sei richieste indipendenti concorrenti e fino a 24 articoli per fonte. La raccolta aggiuntiva è esplicita, a pagine di 16. Ogni richiesta client ha un timeout di 10 secondi e un’operazione di raccolta termina entro 25 secondi, conservando le risposte parziali. Le cache dei feed durano 10 minuti, quelle di scoperta un’ora; gli errori per un minuto. I feed dichiarati vengono contattati direttamente, senza aprire prima la homepage. La lettura è limitata a due indirizzi conosciuti e a un budget di otto secondi per fonte. Le risposte riuscite possono usare la cache edge per due minuti; la disponibilità dipende dal runtime.

`POST /api/translate` inoltra il testo a MyMemory, limita l'input a 2.200 caratteri e suddivide le richieste in blocchi. La cache dura 24 ore in memoria. La lingua sorgente deve essere esplicita: `auto` è rifiutato per evitare di scambiare un testo per inglese. Gli input non validi sono rifiutati e le risposte di quota del provider non diventano mai traduzioni. I blocchi rispettano i byte UTF-8, i confini delle parole quando possibile e i caratteri Unicode. La cache server contiene al massimo 2.048 traduzioni; gli errori di quota attivano una pausa di un minuto. I collegamenti alla traduzione di pagine aprono Google Translate.

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

Il lettore usa un dialog nativo con chiusura da tastiera e ritorno del focus. Il testo completo si apre presso la fonte. Gli iframe esterni richiedono un’azione esplicita. Le traduzioni di testo sono automatiche nella lingua di lettura: testi pubblici dell’interfaccia, citazioni, titoli ed estratti vengono inviati a MyMemory; non viene inviata la raccolta dei preferiti né una cronologia di lettura. Le immagini delle schede sono caricate dai relativi URL senza referrer; non tutte le fonti le forniscono.

`rassegna-rossa.saved` mantiene gli ID storici e `rassegna-rossa.saved-articles` conserva le schede. Il ripristino valida i dati e accetta solo link HTTP(S) senza credenziali incorporate. Vecchi ID diventano schede persistenti quando il relativo articolo viene ritrovato nel feed. Non è un archivio integrale degli articoli e non esiste sincronizzazione tra dispositivi.

Percorsi e glossario sono contenuti introduttivi redatti nel progetto; le copertine tipografiche sono decorative. I link della biblioteca distinguono testi integrali e portali di approfondimento. Non sono aggiunte notizie dimostrative ai feed reali.


## Lingua, fonti visibili e cache del browser

La lingua preferita deriva da `navigator.languages` o dalla scelta manuale in `rassegna-rossa.language`: la priorità non usa GPS né servizi di geolocalizzazione IP. Influisce sull’ordine di testate e titoli e sulle fonti consigliate senza nascondere altre lingue. Determina anche la lingua di lettura dell’interfaccia e delle schede; con “Tutte le lingue” rimane la lingua del browser per la lettura. Il filtro lingua rimane un controllo distinto. Il periodo iniziale è di 30 giorni; aprendo una fonte vengono mostrati tutti gli articoli recuperati, anche quelli più vecchi.

`rassegna-rossa.feed-cache` conserva fino a 300 schede. Una copia di meno di dieci minuti viene riutilizzata senza avviare automaticamente un’altra raccolta. Fino a un giorno può essere mostrata durante un aggiornamento; la data di recupero è visibile. La cache non è una cronologia delle aperture degli articoli e può essere eliminata dai dati del browser.

OttolinaTV, Dazibao e la rubrica Dazibao di OttolinaTV sono raggiungibili direttamente dalla rassegna, anche senza articoli recuperati. I canali YouTube configurati possono leggere i titoli dalla sezione pubblica dei video: il parser usa JSON senza eseguire script, accetta solo il tab selezionato ed evita di inventare date esatte da etichette relative. Se il formato cambia o il sito blocca la richiesta, rimane il link alla fonte originale.

Fonti aggiunte in questa revisione: Dazibao (`youtube.com/@dazibao`), Pagine Esteri (`pagineesteri.it/feed/`), Radio Onda d’Urto (`radiondadurto.org/feed/`) e Radio Onda Rossa (feed completo pubblicato nella pagina “Segui”). Verificare periodicamente questi indirizzi: un controllo riuscito non garantisce disponibilità futura.


## Traduzione automatica e osservatorio delle sei ore

`LocalizedText` mantiene il testo sotto il controllo di React, senza riscrivere il DOM e senza caricare script di traduzione esterni. La coda usa tre richieste concorrenti, deduplica i testi e dà precedenza ai titoli; le schede vengono tradotte quando entrano vicino alla zona visibile. Le etichette inglesi più comuni sono già disponibili e i nomi delle lingue usano `Intl.DisplayNames`. `rassegna-rossa.translations` conserva fino a 800 traduzioni per 24 ore; non sincronizza dati con un account. Al primo guasto la coda si ferma, mostra l’originale con avviso e consente un nuovo tentativo esplicito. I nomi degli editori e degli autori rimangono attribuzioni originali. La qualità e la disponibilità delle traduzioni dipendono dal servizio esterno. Si traducono solo titolo ed estratto disponibili nel feed; il testo completo resta presso l’editore.

L’osservatorio usa `/api/pulse?area=<chiave>` con otto chiavi fisse: sette edizioni radar (Regno Unito, Stati Uniti, Brasile, Sud Africa, India, Cina ed Egitto) e Green Left per l’Oceania. Non accetta destinazioni arbitrarie. I radar combinano lavoro, conflitti e relazioni internazionali nella finestra `when:6h`. Le aree indicano l’edizione consultata: non sono una localizzazione verificata degli eventi. Il client raccoglie tre aree in parallelo, con timeout individuale di dieci secondi e limite globale di 28 secondi. L’osservatorio non dipende dai filtri né dal caricamento della rassegna. Aggiorna la finestra ogni minuto e ripete la raccolta ogni cinque minuti a pagina visibile; la cache feed dedicata dura due minuti. I feed dell’osservatorio hanno un margine di 8,5 secondi per richiesta e nove secondi complessivi: i controlli dal vivo hanno mostrato risposte intorno a 6–7 secondi. Gli altri feed mantengono il budget precedente. Errori e conteggio dei canali disponibili rimangono visibili.

Sono esclusi articoli senza data valida, futuri o anteriori a sei ore. Il ranking elimina link duplicati e raggruppa titoli molto simili nella medesima lingua: almeno quattro termini condivisi e sovrapposizione del 72%. Non riconosce in modo affidabile tutte le notizie sullo stesso evento, soprattutto in lingue diverse. Il segnale somma freschezza (0–50) e presenza su più testate distinte (15 punti per testata aggiuntiva, fino a 50). Il campione e il punteggio non rappresentano tutte le notizie del mondo né una verifica della loro importanza o verità. I filtri per periodo, area e argomento restringono i risultati. Le fonti originali sono sempre raggiungibili.

Le quattro citazioni rimandano al testo in Marxists Internet Archive; le traduzioni redazionali italiane sono dichiarate. Un indice nella sessione evita di ripetere la medesima citazione al ricaricamento successivo. Se lo storage di sessione non è disponibile, la scelta casuale può ripetersi.
