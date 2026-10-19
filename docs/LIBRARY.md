# Biblioteca e lettore

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

Un controllo HTTP delle 455 edizioni iniziali ha confermato 451 risposte HTML accessibili. Quattro collegamenti non HTML sono stati esclusi. Quattro ulteriori edizioni sono state riscontrate nei siti editoriali indicati, portando il catalogo a 455. Una risposta HTTP riuscita non certifica la qualità della traduzione, la completezza del testo o la disponibilità futura. Non vengono inclusi risultati di negozi, copie da servizi a pagamento o testi inventati. Attribuzione e collegamento all’edizione originale restano nel lettore.

## Lettura e privacy

`/read?book=…&edition=…` carica esclusivamente un’edizione del catalogo tramite `/api/library/read`. Il server richiede l’identità Sites prima di leggere il testo. Le pagine remote sono limitate a 3,5 MB e non eseguono JavaScript; i redirect restano nel dominio configurato. Il testo è restituito in blocchi di stringhe, resi da React senza HTML non sanificato. Gli indici permettono soltanto capitoli HTML nel percorso dell’opera. Un libro pubblicato come pagina unica viene suddiviso in sezioni e pagine di lettura, conservando l’ordine del testo. La cache contiene solo documenti pubblici già scaricati, con limite di circa 8 MB e nessuna promessa I/O condivisa tra invocazioni.

`/api/reading-progress` richiede sempre un account e usa `private, no-store`. La tabella `reading_progress`, aggiunta dalla migrazione `0002_stormy_elektra`, ha chiave composta da proprietario, libro ed edizione. Conserva capitolo, pagina di lettura, posizione nello scorrimento, impronta del testo e data dell’aggiornamento. Gli aggiornamenti sono serializzati nel client e quelli temporali più vecchi non sovrascrivono una posizione più recente. Un errore di salvataggio è visibile e permette di riprovare. Il lettore non usa localStorage per simulare la persistenza del segnalibro. Un nuovo libro letto compare nella raccolta privata, senza riattivare un libro precedentemente rimosso.

Le prove automatiche verificano autenticazione, isolamento di account ed edizioni, ripristino da nuove richieste, richieste non valide o da altre origini, ordinamento degli aggiornamenti, testo inerte, capitoli confinati all’opera e continuità dei salvataggi esistenti. Non sostituiscono una verifica visiva in un browser autenticato.

Il testo e i titoli dei capitoli decodificano l’intero insieme delle entità HTML5 (incluse lettere accentate e riferimenti numerici), una sola volta dopo la rimozione del markup. Le sequenze sconosciute restano visibili; i caratteri decodificati vengono sempre resi come stringhe inerti.

## Ampliamento Mao e altre letture

Il catalogo include 26 opere di Mao Zedong: venti saggi, cinque volumi di opere scelte e l’antologia delle citazioni. Le raccolte includono testi che figurano anche come letture singole; non sono 26 libri tutti indipendenti. Fra le edizioni disponibili: inglese, portoghese, spagnolo e, per Sulla pratica, italiano. Sono aggiunti anche il secondo e terzo libro del Capitale, Anti-Dühring, altri saggi di Marx, Engels e Lenin, La città futura di Gramsci e un testo di Clara Zetkin sull’organizzazione delle lavoratrici.

Fonti: [indici delle opere scelte di Mao](https://www.marxists.org/reference/archive/mao/selected-works/index.htm), [Mao in portoghese](https://www.marxists.org/portugues/mao/index.htm), [Mao in italiano](https://www.marxists.org/italiano/reference/mao/index.htm), [La città futura](https://www.marxists.org/italiano/gramsci/17/cittafutura.htm), [Clara Zetkin](https://www.marxists.org/archive/zetkin/1896/10/women.htm). Le descrizioni del catalogo sono redazionali e distinguono saggi, documenti e raccolte.

L’ampliamento aggiunge 40 opere e 180 edizioni: ogni collegamento aggiunto è stato scaricato e verificato come HTML. Un PDF non compatibile è stato escluso; un rinvio HTML senza testo è stato sostituito con la destinazione effettiva. Il parsing dei 180 documenti è stato controllato separatamente. Questo controllo non equivale alla revisione integrale dei testi o di tutti i capitoli collegati.

## Vetrina delle conquiste sociali

La biblioteca include una raccolta tematica positiva e documentata, distinta dai 74 libri e saggi. Le 33 schede coprono 20 paesi e i temi lavoro, scuola, salute, casa, diritti, scienza e cooperazione. La selezione iniziale è l’Italia; il menu consente di esplorare ogni paese o tutto il mondo, incrociando un tema. Nessun filtro elimina o modifica il catalogo dei libri.

Tre approfondimenti collegano fonti sulla Comune di Parigi, la trasformazione cinese e la Rivoluzione culturale a edizioni reali del lettore. La raccolta celebra risultati sociali con attribuzioni circostanziate: non è una storia nazionale esaustiva, né una promessa di copertura di ogni paese. I diritti costituzionali vengono descritti come riconoscimenti giuridici, senza confonderli con la loro piena attuazione.
