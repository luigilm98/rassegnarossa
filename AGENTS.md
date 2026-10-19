# Guida alla manutenzione

Valide per l’intero repository. Convenzioni comuni: semplicità, comprensione del sistema, verifiche integrate, reversibilità e comunicazione precisa.

## Prima di modificare

Leggere `README.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md` e il codice pertinente. Controllare branch, head e modifiche locali. Definire risultato atteso, flusso dei dati interessato, invarianti e verifiche. Non ampliare il prodotto per inerzia.

## Principi

1. Saper evitare lavoro inutile: riusare o semplificare prima di aggiungere framework, dipendenze e documenti.
2. Possedere un modello spiegabile: browser → API → fonti esterne; cache dei soli dati pubblici; raccolte private persistenti in D1 per account.
3. Ispezionare contratti e funzioni interessate, con attenzione maggiore a URL remoti, parsing, HTML, credenziali e persistenza.
4. Preferire verifiche integrate del comportamento a test che ripetono l'implementazione. Nei nuovi comportamenti coprire successo, input errato, risposta vuota e rete indisponibile quando pertinenti.
5. Rendere esplicite le scelte difficili da invertire: identificatori delle fonti, chiavi localStorage, contratti API e hosting. Descrivere compatibilità e rollback.
6. Fermare l'espansione quando emergono regressioni o basi fragili; correggere la causa con il cambiamento minimo.
7. Aggiornare la documentazione del runtime reale e riportare solo test e deploy effettivamente osservati.

## Coerenza editoriale e del prodotto

- Interpretare esempi di autori, paesi o funzionalità alla luce dell’obiettivo generale: verificare le lacune dell’intero catalogo e del flusso interessato, senza restringere automaticamente il lavoro all’esempio.
- Integrare i contenuti nella tassonomia e nell’interfaccia esistenti. Creare una sezione autonoma solo quando serve a un compito distinto del lettore, non per ogni intervento di manutenzione.
- Descrivere lo stato corrente del progetto nei documenti. Aggiornare i paragrafi pertinenti; eliminare duplicazioni, resoconti conversazionali ed elenchi di aggiunte presentati come funzionalità separate. La cronologia tecnica resta in Git.
- Mantenere criteri uniformi per opere, autori, lingue, paesi e periodi. Segnalare i limiti di copertura; non presentare il catalogo come completo.
- Usare italiano naturale e termini adatti al pubblico: “lettura online” per la funzione, “lettore” per una persona o, nei dettagli tecnici, per il componente software.

## Invarianti del progetto

- Conservare attribuzioni, URL originali e trasparenza degli errori delle fonti.
- Le classificazioni e i punteggi sono euristici: non dichiararli verifiche politiche o di verità.
- Non accettare URL arbitrari del visitatore come nuove destinazioni del proxy senza analizzare SSRF, protocolli e redirect.
- Trattare testo e markup dei feed come input non attendibile. Non introdurre rendering HTML non sanificato.
- Non inviare preferiti o altri dati personali a servizi esterni come effetto collaterale di una modifica ordinaria.
- Non committare token, cookie, file `.env`, dati personali, cache o output compilati.
- Preservare l’integrazione vinext/Sites. Gli identificativi di hosting del proprietario appartengono solo al checkout privato di pubblicazione; la configurazione pubblica mantiene esclusivamente i binding generici.
- GitHub Actions verifica il codice; non equivale a un deploy Sites o a una verifica dei feed dal vivo.

## Verifica e consegna

Eseguire `npm test` e le verifiche pertinenti alla modifica. Per UI valutare tastiera, schermi piccoli, caricamento e fallimenti. Dichiarare eventuali blocchi o verifiche non eseguite. Prima di pubblicazioni o operazioni distruttive accertare che rientrino nella richiesta del maintainer; non riscrivere cronologia o dati per risolvere conflitti ordinari.

Riportare cosa è cambiato e perché, verifiche e risultati, limiti residui e riferimenti a commit/PR/deploy. Non inventare un esito positivo e non confondere specifiche future con funzionalità implementate.
