# Architettura e pubblicazione

## Componenti e confini

React e TypeScript gestiscono l’interfaccia; vinext e Vite compilano il Worker Cloudflare. `worker/index.ts` instrada le API private prima delle cache pubbliche. `.openai/hosting.json` mantiene il binding D1 `DB`; R2 non è utilizzato.

- `AggregatorApp.tsx`: raccolta delle notizie, filtri, navigazione, ordinamenti e schede.
- `LibraryView.tsx`: biblioteca, percorsi, glossario e libri salvati; scaricato su richiesta.
- `BookReader.tsx`: lettore `/read`, indipendente dalla raccolta delle notizie.
- `Localization.tsx`: lingua di lettura, traduzioni e relativi limiti.
- `WorldWatch.tsx`: osservatorio delle ultime sei ore.
- `CloudBookmarks.ts`: sincronizzazione della raccolta privata e importazione delle copie locali.
- `app/data`: catalogo delle fonti e contenuti editoriali tracciati in Git.

`book-ids.json` è l’indice leggero usato per validare i salvataggi senza scaricare tutte le edizioni. Il test lo confronta con il catalogo completo. I dati di biblioteca e i relativi componenti rimangono in un chunk separato dal caricamento delle notizie.

## Raccolta e consultazione

Il catalogo comprende 130 testate, canali e risorse e 136 ricerche radar. Tutti partecipano automaticamente: sei richieste concorrenti per le fonti dirette e due per i radar, fino a 24 articoli per fonte. Non esistono pagine di fonti da caricare manualmente. L’atlante conserva tutte le voci e separa editori configurati, radar ed editori scoperti; le sezioni chiuse non montano centinaia di componenti.

`/api/articles` ammette al massimo 14 fonti e 2.500 articoli per risposta. I feed dichiarati evitano la scoperta della homepage. Si provano al massimo due indirizzi, con budget finiti; YouTube usa il JSON pubblico della scheda video senza eseguire script o inventare date. Dazibao e OttolinaTV rimangono raggiungibili anche se il feed non risponde.

Il client dà 14 secondi alle fonti dirette e 18 ai radar. Gli errori sono indipendenti. Un RSS valido ma vuoto è disponibile con zero risultati; un errore temporaneo può conservare l’ultima copia riuscita, segnalata come `stale`, senza cambiare le date. Un’edizione Google bloccata attende cinque minuti prima di altre ricerche correlate. La raccolta completa può richiedere minuti: non blocca ricerca, filtri o lettura. Può essere interrotta e riparte ogni dieci minuti a pagina visibile se il ciclo precedente è concluso.

Gli aggiornamenti ravvicinati sono raggruppati. Le schede invariate mantengono gli stessi oggetti e non provocano un nuovo ordinamento o rendering. La ricerca usa un valore differito per mantenere reattiva la digitazione. Una copia locale conserva fino a 1.200 schede per un giorno; può fallire senza cancellare i preferiti.

## Apertura e stabilità

La prima pagina prepara immagini, titoli e font, ma ha un budget assoluto di sei secondi dal montaggio, indipendente dagli arrivi successivi. La prima attesa dei feed termina entro tre secondi. Scaduto il budget viene mostrato ciò che è disponibile; le operazioni continuano nei propri limiti e gli errori dei provider restano visibili. Non viene promessa la disponibilità di ogni foto o traduzione entro quel tempo.

Le schede mantengono riquadro 16:9, tre righe di titolo ed estratto e ordine stabile durante gli aggiornamenti. Filtri, cambio ordinamento e “Aggiorna ordine” applicano la nuova graduatoria. Il titolo completo rimane nella scheda di lettura. La verifica automatica non misura il CLS su ogni dispositivo.

## Cache e isolamento Workers

Le invocazioni server condividono esclusivamente dati già completati, mai Promise, Response o stream ancora in corso. Ogni richiesta a freddo possiede il proprio I/O. Un aggiornamento pubblico in background può essere saltato quando già attivo, senza attendere il lavoro di un altro visitatore. Questo evita errori Workers di stream bloccati e di I/O appartenente a un’altra richiesta.

- Feed: dieci minuti, errori un minuto; limite di 512 elementi e circa 16 MB.
- Scoperta dei feed: un’ora, solo destinazioni del catalogo.
- Homepage: dieci minuti, errori un minuto; 128 elementi e circa 8 MB.
- Normalizzazione dei link: 8.192 elementi e circa 2 MB.
- Byte fotografici: 64 immagini e 8 MB, per dieci minuti.
- Documenti dei libri: 16 elementi e circa 8 MB, per un’ora.

`public_news_cache` in D1 conserva solo risposte pubbliche di notizie, osservatorio e selezioni. Le chiavi sono finite e canoniche: non includono identità o cookie. La cache è fresca per due minuti e utilizzabile con rinnovo in background fino a dieci. Risposte private, errori, `no-store`, cookie e variazioni di autenticazione non vengono archiviate. Le API di segnalibri e la richiesta di traduzione non entrano in questa cache.

## Lingue, ordinamenti e osservatorio

`rassegna-rossa.reading-language` determina traduzione e lingua dell’interfaccia; `rassegna-rossa.source-language` filtra la lingua originale delle fonti. Sono controlli distinti. La vecchia preferenza viene migrata; non vengono usati GPS o servizi IP. La stessa lingua di partenza e di lettura evita entrambi i provider, comprese le varianti regionali normalizzate.

La coda browser traduce tre testi alla volta, deduplica e dà precedenza ai titoli; gli estratti e le schede lontane dallo schermo non occupano tutta la preparazione iniziale. Le schede della biblioteca traducono quando sono vicine al viewport. Le etichette inglesi principali sono integrate. La cache locale conserva 800 traduzioni per 24 ore. Il server prova Google Translate e poi MyMemory, con input massimo di 2.200 caratteri, blocchi UTF-8 e pause dopo quote. Il client può provare gli endpoint pubblici senza credenziali o referrer. Errori e quote non diventano testi tradotti; l’originale e il comando per riprovare restano disponibili.

Gli ordinamenti sono: evidenza delle fonti, ultimi articoli, più letti pubblicati dalle fonti e priorità politica/formativa. `/api/highlights` consulta solo homepage configurate, con tre richieste client parallele, dieci secondi di timeout client, 4,5 secondi server e 1,2 MB di HTML. La coda riparte all’arrivo di nuove fonti o al completamento dei lavori; non interroga il DOM o la rete ogni secondo. I risultati sono raggruppati e un errore conserva i metadati precedenti.

Il parser riconosce sezioni pubbliche di evidenza e classifiche; i primi titoli nel corpo sono un segnale euristico di apertura. Nessun conteggio di letture interno o indice SEO inventato. “Più letti” usa classifiche esplicite incrociate con i feed; se mancano, lo segnala e ripiega sull’ordine cronologico. Le date e i periodi delle classifiche dipendono dagli editori.

L’osservatorio raccoglie otto canali regionali e le notizie della rete in una finestra di sei ore. Le schede mostrano titolo tradotto, nome della testata e paese dell’editore, non macroregioni. Per editori sconosciuti compare “Paese non verificato”. Le etichette e i punteggi sono euristici, non verifiche di verità.

## Immagini e contenuti esterni

Il browser usa otto download diretti e quattro recuperi fotografici. Mostra la prima immagine decodificata; dopo 1,2 secondi una foto lenta corre in parallelo al recupero same-origin. Il proxy ha un limite numerico di 12 operazioni: se pieno risponde subito con 503 e Retry-After. Non contiene code di resolver tra invocazioni.

`/api/article-image` verifica fonte e articolo. L’archivio pubblico conserva fino a 160 riferimenti per fonte per sette giorni, separati dai dati personali. Un dominio regionale diverso dalla homepage è autorizzato solo dal riferimento esatto già osservato dal server. URL inventati, destinazioni locali, IP letterali, credenziali e porte non standard restano rifiutati; i redirect vengono verificati. Sono ammessi raster fino a 4 MB, senza cookie del visitatore.

I radar conservano la provenienza del feed. Il recupero può risolvere collegamenti pubblici Google o corrispondenze esatte del titolo nella homepage/RSS dell’editore osservato. Blocchi, consenso, quote e assenza di foto terminano il tentativo; non si assegnano copertine generiche. L’anteprima esterna degli articoli è facoltativa e avvisa che contatterà l’editore. Nessuno script dei feed viene eseguito nell’interfaccia.

## Raccolta personale e libri

L’identità arriva dagli header attendibili Sites, mai da un ID inviato dal client. `/api/bookmarks`, `/api/reading-progress` e `/api/library/read` richiedono accesso e usano `private, no-store`. D1 conserva `bookmarks` e `reading_progress`, separati per proprietario. Le copie locali non sostituiscono l’archivio dell’account. Importazione, rimozioni, outbox, cambio account e ripresa della lettura sono verificati con fixture isolate, senza leggere dati privati di produzione.

Le migrazioni già applicate sono immutabili. Il lettore sceglie edizioni reali del catalogo, scarica HTML con limiti e redirect confinati e restituisce stringhe React inerti. Decodifica le entità HTML5 senza reinserire markup. Capitolo, pagina e scorrimento persistono per account ed edizione; gli aggiornamenti più vecchi non sostituiscono i più recenti. Per catalogo, fonti, diritti e limiti vedere [LIBRARY.md](LIBRARY.md).

## Verifica

`npm test` compila e verifica rendering, API, ordinamenti, immagini, cache, traduzioni e persistenza con risposte controllate. Include l’isolamento delle richieste a freddo e un controllo del grafo del bundle: il catalogo completo dei libri deve restare fuori dall’avvio delle notizie. `npm run typecheck` verifica TypeScript. Entrambi vengono eseguiti in GitHub Actions su `main` e nelle pull request.

Le prove automatiche non sostituiscono test visivi in un browser autenticato, non garantiscono la disponibilità dei provider e non misurano il caricamento su ogni telefono. Le prove di rete reali e i benchmark locali vanno distinti dai tempi percepiti dall’utente.

## Pubblicazione

GitHub e Sites hanno cicli distinti. Il repository pubblico omette gli identificativi di hosting e le credenziali; il checkout privato mantiene il `project_id` del sito. Con il plugin Sites: aprire il repository corretto, verificare/buildare, sincronizzare i sorgenti, salvare e pubblicare la versione, conservando identità e pubblico. Verificare lo stato terminale del deploy.

Un push GitHub non pubblica Sites. Non copiare credenziali Sites nei workflow. GitHub Pages non esegue le API Worker. Un hosting alternativo richiede runtime, binding e verifiche compatibili. Per rollback del codice usare un revert; per il sito ripubblicare una versione Sites verificata. Un revert GitHub da solo non cambia la produzione.
