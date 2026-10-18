# Architettura e pubblicazione

## Flusso attuale

Il catalogo è disponibile già nella pagina. Il client raccoglie le notizie tramite `/api/articles`, con richieste indipendenti per ciascuna fonte. Il server seleziona le fonti dal catalogo, scopre i feed RSS/Atom, analizza gli elementi, attribuisce argomenti e punteggi euristici, deduplica per link e ordina i risultati. L'interfaccia applica ricerca e filtri e conserva gli articoli salvati in `localStorage`.

`/api/articles` limita ogni richiesta a 14 fonti, usa concorrenza 6 e restituisce al massimo 2.500 articoli. Il client include automaticamente tutto il catalogo in una coda finita: dieci richieste indipendenti concorrenti, una fonte per richiesta e fino a 24 articoli per fonte. La preferenza del browser può anticipare sei fonti; il resto alterna aree e lingue, senza escludere alcuna fonte. Ogni richiesta ha un limite di dieci secondi e un guasto non blocca la coda. Il ciclo completo può richiedere alcuni minuti se molte fonti sono lente; la pagina mostra le prime risposte senza aspettare la fine e il suo stato iniziale di attesa termina entro otto secondi. La copertura è leggibile in un riepilogo espandibile. Filtri e lettura restano disponibili. Il visitatore può interrompere il ciclo. Un nuovo ciclo parte ogni dieci minuti a pagina visibile, se quello precedente è concluso. Non esiste più il caricamento manuale di pagine di fonti; aprire una singola testata non interrompe il ciclo completo.

Le cache dei feed durano 10 minuti, quelle di scoperta un’ora; gli errori per un minuto. I feed dichiarati vengono contattati direttamente, senza aprire prima la homepage. La lettura è limitata a due indirizzi conosciuti e a un budget di otto secondi per fonte, salvo il margine dedicato all’osservatorio delle sei ore. Le risposte riuscite possono usare la cache edge per due minuti; la disponibilità dipende dal runtime.

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

La lingua di lettura segue il browser oppure `rassegna-rossa.reading-language`. Determina esclusivamente la traduzione e le impostazioni locali della pagina. La lingua originale delle fonti in analisi è un controllo distinto, salvato in `rassegna-rossa.source-language`, con valore iniziale “tutte”. Restringe la vista senza cambiare la traduzione e senza interrompere la raccolta dell’intero catalogo. La vecchia chiave `rassegna-rossa.language` viene migrata soltanto come preferenza di lettura. Non vengono usati GPS o servizi IP. Il periodo iniziale è di 30 giorni; aprendo una fonte vengono mostrati tutti gli articoli recuperati.

`rassegna-rossa.feed-cache` conserva fino a 1.200 schede scelte nell’ordine editoriale. La copia locale compare immediatamente, ma non sostituisce la raccolta automatica delle altre fonti. Il ripristino accetta copie fino a un giorno; salvare la cache può fallire per limiti di spazio senza cancellare i preferiti. Non è una cronologia delle aperture personali.

OttolinaTV, Dazibao e la rubrica Dazibao di OttolinaTV sono raggiungibili direttamente dalla rassegna, anche senza articoli recuperati. I canali YouTube configurati possono leggere i titoli dalla sezione pubblica dei video: il parser usa JSON senza eseguire script, accetta solo il tab selezionato ed evita di inventare date esatte da etichette relative. Se il formato cambia o il sito blocca la richiesta, rimane il link alla fonte originale.

Fonti aggiunte in questa revisione: Dazibao (`youtube.com/@dazibao`), Pagine Esteri (`pagineesteri.it/feed/`), Radio Onda d’Urto (`radiondadurto.org/feed/`) e Radio Onda Rossa (feed completo pubblicato nella pagina “Segui”). Verificare periodicamente questi indirizzi: un controllo riuscito non garantisce disponibilità futura.


## Traduzione automatica e osservatorio delle sei ore

`LocalizedText` mantiene il testo sotto il controllo di React, senza riscrivere il DOM e senza caricare script di traduzione esterni. La coda usa tre richieste concorrenti, deduplica i testi e dà precedenza ai titoli; le schede vengono tradotte quando entrano vicino alla zona visibile. Le etichette inglesi più comuni sono già disponibili e i nomi delle lingue usano `Intl.DisplayNames`. `rassegna-rossa.translations` conserva fino a 800 traduzioni per 24 ore; non sincronizza dati con un account. Se il proxy del sito fallisce, il client tenta l’API pubblica CORS di MyMemory direttamente dal browser, senza credenziali né referrer, con un budget di 12 secondi. Questo evita di dipendere esclusivamente dalla quota dell’IP condiviso del server. Se fallisce anche il collegamento diretto, la coda si ferma, mostra l’originale con avviso e consente un nuovo tentativo esplicito. I nomi degli editori e degli autori rimangono attribuzioni originali. La qualità e la disponibilità delle traduzioni dipendono dal servizio esterno. Si traducono solo titolo ed estratto disponibili nel feed; il testo completo resta presso l’editore.

L’osservatorio usa `/api/pulse?area=<chiave>` con otto chiavi fisse: sette edizioni radar (Regno Unito, Stati Uniti, Brasile, Sud Africa, India, Cina ed Egitto) e Green Left per l’Oceania. Sette testate dirette affiancano i radar: Morning Star, Truthout, Prensa Latina, ROAPE, Viet Nam News, China Daily e Peoples Dispatch. Le due richieste di ciascuna area procedono in parallelo: il fallimento del radar non elimina le notizie della testata. Non accetta destinazioni arbitrarie. I radar combinano lavoro, conflitti e relazioni internazionali nella finestra `when:6h`. Le aree indicano l’edizione consultata: non sono una localizzazione verificata degli eventi. Il client raccoglie tre aree in parallelo, con timeout individuale di dodici secondi, senza interrompere le ultime aree con un timeout globale più corto della coda. Alle risposte regionali aggiunge progressivamente tutti gli articoli della raccolta principale, prima dei filtri di lingua, fonte o argomento. La raccolta regionale rimane autonoma: un suo errore non elimina le notizie già disponibili dalla rete completa. Mostra fino a dodici notizie, senza punteggi o spiegazioni dei criteri nelle schede. Aggiorna la finestra ogni minuto e ripete la raccolta ogni cinque minuti a pagina visibile; la cache feed dedicata dura due minuti. I feed dell’osservatorio hanno un margine di 8,5 secondi per richiesta e nove secondi complessivi: i controlli dal vivo hanno mostrato risposte intorno a 6–7 secondi. Gli altri feed mantengono il budget precedente. Errori e conteggio dei canali disponibili rimangono visibili.

Sono esclusi articoli senza data valida, futuri o anteriori a sei ore. Il ranking elimina link duplicati e raggruppa titoli molto simili nella medesima lingua: almeno quattro termini condivisi e sovrapposizione del 72%. Non riconosce in modo affidabile tutte le notizie sullo stesso evento, soprattutto in lingue diverse. Il segnale somma freschezza (0–50) e presenza su più testate distinte (15 punti per testata aggiuntiva, fino a 50). Il campione e il punteggio non rappresentano tutte le notizie del mondo né una verifica della loro importanza o verità. I filtri per periodo, area e argomento restringono i risultati. Le fonti originali sono sempre raggiungibili.

Le quattro citazioni rimandano al testo in Marxists Internet Archive; le traduzioni redazionali italiane sono dichiarate. Un indice nella sessione evita di ripetere la medesima citazione al ricaricamento successivo. Se lo storage di sessione non è disponibile, la scelta casuale può ripetersi.


## Priorità politica e formativa

La modalità politica e formativa della colonna principale usa `rankEditorial`, indipendente dalla graduatoria cronologica dell’osservatorio. Quattro assi pubblici cercano segnali nel titolo, nell’estratto e nelle categorie effettive del feed: organizzazione collettiva; formazione e teoria; competenze, alfabetizzazione critica e strumenti; analisi dei rapporti di potere. Quest’ultimo asse richiede anche un indicatore di analisi o approfondimento: menzionare la destra o un partito non è sufficiente.

Ogni termine riconosciuto nel titolo pesa due unità, nel resto una. Il contributo per asse è limitato a tre unità; competenze e strumenti valgono nove punti per unità, gli altri assi sette. Il contributo sostanziale è limitato a 90; la freschezza aggiunge fino a dieci punti nella prima settimana. I materiali con segnali editoriali precedono quelli di sola cronaca; in ciascun insieme l’apertura alterna le testate, fino a due articoli per editore quando sono disponibili abbastanza alternative. Tutti gli altri articoli distinti rimangono accessibili. Non entrano nel calcolo clic, popolarità, profili personali o una presunta certificazione di verità. La lingua preferita rompe soltanto le parità di punteggio. I filtri per asse sono espliciti e l’ordinamento cronologico rimane selezionabile.

Il criterio è lessicale e può riconoscere male utilità, contesto, ironia e qualità; non equivale a leggere integralmente un articolo. I dettagli della classificazione sono documentati qui, senza riquadri aggiuntivi su ogni scheda. La deduplicazione elimina link equivalenti con parametri di tracciamento e titoli della medesima testata con la stessa data; non unifica edizioni con date differenti.

## Estensione del catalogo

Sono aggiunte 43 destinazioni RSS/Atom verificate il 18 ottobre 2026, per un totale di 129 testate, canali e risorse e 136 radar. Le nuove voci comprendono analisi, organizzazione, critica dei media, diritti digitali e ricerca; non sono tutte testate comuniste. Per evitare attribuzioni politiche non documentate, le loro etichette ideologiche rimangono vuote. New Frame è esplicitamente un archivio; il feed di Organizing Upgrade rimanda a Convergence, che viene nominato correttamente. La disponibilità osservata durante il controllo non garantisce accessibilità futura o da ogni rete.

L’atlante raccoglie tutte le voci in sezioni per area, separando radar ed editori da essi scoperti. Le sezioni si aprono senza scaricare nuove fonti; le righe chiuse non montano centinaia di componenti e richieste di traduzione. Non sono previsti pulsanti “carica altre fonti”.


## Prima pagina e ordinamenti delle testate

La home parte dalla rassegna, senza una copertina introduttiva: marchio e navigazione compatti, lingua di lettura, ricerca e ordinamento. La citazione rotante rimane a fine pagina. Un pannello “Filtri” raccoglie lingua originale delle fonti (distinta dalla lingua di lettura), area, periodo da sei ore a tutte le date, fonte, argomento, approfondimento, tipo e orientamento. Anche i controlli dell’osservatorio sono richiudibili. Le schede conservano titolo/estratto, apertura della fonte e segnalibro, senza spiegazioni di ranking ripetute.

L’ordine iniziale “In evidenza dalle fonti” consulta `/api/highlights?sourceId=<id>`: solo destinazioni del catalogo, nessun URL arbitrario del visitatore. Il client attiva al massimo tre richieste parallele, solo per editori che hanno già fornito articoli; esclude radar e YouTube e deduplica le homepage. Le prime risposte RSS non aspettano questa coda. Ogni richiesta client dura al massimo sei secondi; lato server quattro secondi e mezzo, con lettura limitata a 1,2 MB. La cache delle selezioni dura dieci minuti, quella degli errori un minuto. Una nuova consultazione avviene ogni dieci minuti a pagina visibile. Nessuna dipendenza o risorsa persistente è aggiunta.

Il parser non esegue script: esclude navigazione, piè di pagina, moduli e contenuti nascosti. Riconosce contenitori e intestazioni pubbliche di notizie in evidenza e classifiche di lettura in più lingue. In mancanza di una sezione esplicita, i primi cinque collegamenti a titoli nel corpo della pagina sono un segnale euristico di apertura; non equivalgono alla posizione visiva effettiva su ogni schermo. I collegamenti vengono incrociati con articoli realmente raccolti dai feed, normalizzando solo varianti www, slash finale e parametri di tracciamento. Non si inventano titoli, date, letture o indici SEO. La priorità politica e formativa ordina gli articoli senza segnale di apertura, e rimane selezionabile autonomamente; “Ultimi articoli” usa le date dei feed.

“Più letti sulle fonti” riconosce esclusivamente sezioni esplicite come “Più letti”, “Most read” o plugin di classifiche, non semplici trend o l’ordine cronologico del feed. Mostra i corrispondenti articoli disponibili rispettando il rango nella classifica di ciascuna testata: non confronta numeri assoluti di lettori fra editori diversi. Se nessun articolo filtrato ha una classifica disponibile, segnala il limite e mostra l’ordine cronologico. Il periodo di ogni classifica dipende dalla fonte; non viene dichiarata arbitrariamente una finestra comune. Pagine caricate soltanto via JavaScript, paywall, anti-bot, markup cambiato o articoli fuori dal feed possono impedire il riconoscimento. Il sito non raccoglie un conteggio interno di aperture, identificativi dei lettori o cronologie per questa funzione.
