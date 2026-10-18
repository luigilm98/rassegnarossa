# Biblioteca e lettore

Il catalogo contiene 34 libri e saggi, 455 edizioni linguistiche e 37 lingue. La disponibilità è quella degli archivi esterni; la completezza delle traduzioni può variare. Le tre schede tematiche storiche restano nel catalogo e nei salvataggi, ma non sono conteggiate come libri gratuiti leggibili nel sito.

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
