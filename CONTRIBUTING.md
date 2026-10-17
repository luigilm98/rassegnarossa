# Contribuire a Rassegna Rossa

Leggere README, AGENTS e la sezione pertinente di `docs/ARCHITECTURE.md`. Partire dal comportamento osservato e descrivere il problema prima di aggiungere codice.

1. Creare un branch breve da `main` per le modifiche successive all'importazione.
2. Preferire cambiamenti piccoli, leggibili e reversibili; conservare gli identificatori delle fonti e i salvataggi locali esistenti.
3. Usare `npm ci` e `npm run dev` per lo sviluppo. Se cambiano le dipendenze, aggiornare anche `package-lock.json`.
4. Eseguire `npm test` prima della pull request. Per modifiche al comportamento aggiungere verifiche significative di successo e di errore usando fixture sintetiche e risposte di rete controllate.
5. Descrivere nella PR problema, comportamento risultante, controlli eseguiti, limiti e conseguenze sul deploy.

Per cambiamenti alla UI controllare anche tastiera, schermi piccoli, stati vuoti e fallimenti di rete. I test automatici attuali non sostituiscono queste verifiche.

Non includere credenziali, cache, preferiti personali, `.env`, `node_modules`, output compilati o risposte integrali di editori. Conservare attribuzione e link delle fonti; non presentare classificazioni automatiche come fatti verificati. Non introdurre dipendenze o servizi di hosting senza una necessità concreta.

Il deploy Sites è separato dal push GitHub: seguire la procedura documentata e verificare il risultato effettivo.
