# Biblioteca e lettura online

Il catalogo contiene 74 libri, saggi e raccolte, 635 edizioni linguistiche e 37 lingue. La disponibilità è quella degli archivi esterni; la completezza delle traduzioni può variare. Le tre schede tematiche storiche restano nel catalogo e nei salvataggi, ma non sono conteggiate come libri gratuiti leggibili nel sito.

## Provenienza

- [Indice multilingue Marx ed Engels](https://www.marxists.org/xlang/marx.htm).
- [Indice multilingue Lenin](https://www.marxists.org/xlang/lenin.htm).
- [Rosa Luxemburg, MIA](https://www.marxists.org/archive/luxemburg/).
- [Kropotkin, MIA](https://www.marxists.org/reference/archive/kropotkin-peter/1902/mutual-aid/).
- [Edizioni Anarchismo: Il mutuo appoggio](https://www.edizionianarchismo.net/library/il-mutuo-appoggio) e [La conquista del pane](https://www.edizionianarchismo.net/library/petr-kropotkin-la-conquista-del-pane).
- [Project Gutenberg: The Conquest of Bread](https://www.gutenberg.org/ebooks/23428).
- [William Morris, MIA](https://www.marxists.org/archive/morris/).
- [Free, Fair and Alive, sito degli autori](https://freefairandalive.org/read-it/), con testi anche in [tedesco](https://freefairandalive.org/de/hineinlesen/) e [spagnolo](https://freefairandalive.org/es/leelo/).
- [Anarchistische Bibliothek: Gegenseitige Hilfe](https://de.anarchistlibraries.net/library/peter-kropotkin-gegenseitige-hilfe-in-der-tier-und-menschenwelt).

Le opere provengono da archivi e siti editoriali pubblici. Il catalogo distingue libri, saggi, antologie e raccolte: alcuni testi possono comparire sia come opere singole sia all’interno di un volume, quindi il numero delle voci non equivale al numero di testi indipendenti. Le descrizioni sono redazionali. La provenienza e il collegamento all’edizione originale restano visibili durante la lettura.

La selezione riguarda la storia e il pensiero delle sinistre nel mondo, in periodi e tradizioni differenti: movimento operaio, socialismi, comunismi, anarchismo, anticolonialismo, femminismi, cooperazione e beni comuni. Il catalogo è parziale: la disponibilità di edizioni online non deve essere confusa con la rappresentatività di un autore o di un paese. Le proposte di ampliamento seguono gli stessi criteri per ogni provenienza, senza creare raccolte privilegiate a partire da singole segnalazioni.

Altri indici e documenti utilizzati:

- [Opere scelte di Mao Zedong](https://www.marxists.org/reference/archive/mao/selected-works/index.htm), con indici in [portoghese](https://www.marxists.org/portugues/mao/index.htm) e [italiano](https://www.marxists.org/italiano/reference/mao/index.htm).
- [Gramsci: La città futura](https://www.marxists.org/italiano/gramsci/17/cittafutura.htm).
- [Clara Zetkin: organizzazione delle lavoratrici](https://www.marxists.org/archive/zetkin/1896/10/women.htm).

I collegamenti sono sottoposti a verifiche HTTP e di parsing; una risposta riuscita non certifica la qualità della traduzione, la completezza di tutti i capitoli o la disponibilità futura. Non vengono presentati risultati di negozi, servizi a pagamento o testi inventati come edizioni gratuite leggibili nel sito.

## Lettura e privacy

`/read?book=…&edition=…` carica esclusivamente un’edizione del catalogo tramite `/api/library/read`. Il server richiede l’identità Sites prima di leggere il testo. Le pagine remote sono limitate a 3,5 MB e non eseguono JavaScript; i redirect restano nel dominio configurato. Il testo è restituito in blocchi di stringhe, resi da React senza HTML non sanificato. Gli indici permettono soltanto capitoli HTML nel percorso dell’opera. Un libro pubblicato come pagina unica viene suddiviso in sezioni e pagine di lettura, conservando l’ordine del testo. La cache contiene solo documenti pubblici già scaricati, con limite di circa 8 MB e nessuna promessa I/O condivisa tra invocazioni.

`/api/reading-progress` richiede sempre un account e usa `private, no-store`. La tabella `reading_progress`, aggiunta dalla migrazione `0002_stormy_elektra`, ha chiave composta da proprietario, libro ed edizione. Conserva capitolo, pagina di lettura, posizione nello scorrimento, impronta del testo e data dell’aggiornamento. Gli aggiornamenti sono serializzati nel client e quelli temporali più vecchi non sovrascrivono una posizione più recente. Un errore di salvataggio è visibile e permette di riprovare. Il lettore non usa localStorage per simulare la persistenza del segnalibro. Un nuovo libro letto compare nella raccolta privata, senza riattivare un libro precedentemente rimosso.

Le prove automatiche verificano autenticazione, isolamento di account ed edizioni, ripristino da nuove richieste, richieste non valide o da altre origini, ordinamento degli aggiornamenti, testo inerte, capitoli confinati all’opera e continuità dei salvataggi esistenti. Non sostituiscono una verifica visiva in un browser autenticato.

Il testo e i titoli dei capitoli decodificano l’intero insieme delle entità HTML5 (incluse lettere accentate e riferimenti numerici), una sola volta dopo la rimozione del markup. Le sequenze sconosciute restano visibili; i caratteri decodificati vengono sempre resi come stringhe inerti.

## Vetrina delle conquiste sociali

La biblioteca include una raccolta tematica positiva e documentata, distinta dai 74 libri e saggi. Le 33 schede coprono 20 paesi e i temi lavoro, scuola, salute, casa, diritti, scienza e cooperazione. La selezione iniziale è l’Italia; il menu consente di esplorare ogni paese o tutto il mondo, incrociando un tema. Nessun filtro elimina o modifica il catalogo dei libri.

Dieci dossier comprendono Italia, Comune di Parigi, Cina, Rivoluzione culturale, Francia, sanità britannica, Vienna Rossa, Cuba, URSS e Vietnam: 41 capitoli, cronologie, confronti e 47 riferimenti documentari. Un selettore apre un dossier alla volta, con indice espandibile e una colonna di lettura. I percorsi collegano edizioni reali della biblioteca. Il parametro pubblico `?storia=<id>` apre direttamente un approfondimento.

I grafici presentano il PIL reale cinese dal 1978 al 2024, la povertà in Vietnam nel 2010 e nel 2020 e l’aspettativa di vita dal 1960 al 2024 per Cina, Vietnam, Cuba e mondo. I dati, le unità, le soglie e le fonti sono consultabili nella pagina; le serie annuali includono tutte le osservazioni del periodo. Gli iscritti dichiarati da alcuni partiti sono presentati separatamente con data e fonte: non misurano gli attivisti effettivi o il consenso di una popolazione.

La raccolta non è una storia nazionale esaustiva. Diritti riconosciuti dalle leggi, loro attuazione e risultati osservati sono distinti. Un andamento statistico non dimostra da solo un rapporto causale tra una politica e un risultato.
