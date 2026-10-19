# Contribuire / Contribute · Internazionale Rossa

[Italiano](#italiano) · [English](#english) · [Español](#español) · [Français](#français) · [Deutsch](#deutsch) · [Português](#português)

**All languages are welcome. No coding experience is required to propose a change.** A free GitHub account is needed to submit an issue or pull request. Public contributions can display your GitHub username; do not include private information in text or screenshots.

## Italiano

### Proporre, senza programmare

1. Apri la scheda **Issues** del repository e premi **New issue**.
2. Scegli **Idea / Page change**, **Content / Source / Translation** oppure **Bug report**.
3. Scrivi nella tua lingua: quale pagina riguarda, che cosa cambieresti e perché. Per una correzione storica o una nuova fonte aggiungi i riferimenti verificabili. Invia con **Submit new issue**.

Non devi preparare codice, installare nulla o trovare il file giusto. Puoi suggerire anche il testo esatto che vorresti leggere. Le risposte nello stesso thread permettono di chiarire e migliorare la proposta.

### Modificare un testo dal browser

Apri il file, premi la **matita (Edit this file)** e modifica il testo. Se GitHub lo richiede, crea una tua copia con **Fork this repository**. Premi **Propose changes**, poi **Create pull request**. Spiega la modifica nel modello che compare: il progetto originale cambia solo dopo la revisione e l’integrazione della proposta. Se non trovi il file, apri un’issue indicando la pagina.

Per il codice leggi la [guida tecnica](#technical-contributions). Per capire cosa succede dopo l’invio, leggi [come valutiamo le proposte](docs/COMMUNITY.md).

## English

### Suggest a change without coding

1. Open the repository’s **Issues** tab and select **New issue**.
2. Choose **Idea / Page change**, **Content / Source / Translation**, or **Bug report**.
3. Write in your preferred language. Tell us which page is involved, what should change and why. Include verifiable references for factual corrections and new sources. Select **Submit new issue**.

You do not need to install anything or locate the right source file. You can propose the exact wording you would like to see. Continue the conversation in the same issue.

### Edit a text in your browser

Open the file and select the **pencil (Edit this file)**. If prompted, choose **Fork this repository** to make your own copy. Edit, select **Propose changes**, then **Create pull request**. Fill in the supplied template. The original project changes after review and merge. If you cannot find the file, describe the page in an issue instead.

See [technical contributions](#technical-contributions) and [how proposals are reviewed](docs/COMMUNITY.md).

## Español

1. Abre **Issues → New issue** en este repositorio.
2. Elige una idea o cambio de página, contenido/fuente/traducción, o un error.
3. Escribe en tu idioma: página, cambio propuesto y motivo. Añade referencias verificables para correcciones y fuentes. Pulsa **Submit new issue**.

No necesitas programar ni instalar nada. Puedes proponer directamente un texto. Para editarlo, abre el archivo y pulsa el **lápiz (Edit this file)**; acepta crear un **fork** si GitHub lo solicita. Usa **Propose changes → Create pull request** y completa el formulario. La propuesta se revisa antes de integrarse. Si no encuentras el archivo, abre una issue con el nombre de la página.

## Français

1. Dans ce dépôt, ouvre **Issues → New issue**.
2. Choisis une idée ou modification de page, un contenu/source/traduction, ou un problème.
3. Écris dans ta langue : page concernée, modification souhaitée et raison. Ajoute des références vérifiables pour les corrections et les sources. Clique sur **Submit new issue**.

Aucune programmation ni installation n’est nécessaire. Tu peux proposer le texte souhaité. Pour modifier un fichier, utilise le **crayon (Edit this file)** et crée un **fork** si GitHub le demande. Choisis **Propose changes → Create pull request**, puis remplis le modèle. La proposition sera examinée avant intégration. Si tu ne trouves pas le fichier, décris la page dans une issue.

## Deutsch

1. Öffne in diesem Repository **Issues → New issue**.
2. Wähle eine Idee/Seitenänderung, Inhalt/Quelle/Übersetzung oder eine Fehlermeldung.
3. Schreibe in deiner Sprache: betroffene Seite, gewünschte Änderung und Begründung. Füge überprüfbare Belege für sachliche Korrekturen und Quellen hinzu. Klicke auf **Submit new issue**.

Du musst weder programmieren noch etwas installieren. Du kannst einen konkreten Text vorschlagen. Zum Bearbeiten eines Textes öffne die Datei und wähle den **Stift (Edit this file)**. Erstelle einen **Fork**, falls GitHub dich dazu auffordert. Wähle **Propose changes → Create pull request** und fülle die Vorlage aus. Änderungen werden vor der Übernahme geprüft. Findest du die Datei nicht, beschreibe die Seite in einem Issue.

## Português

1. Neste repositório, abre **Issues → New issue**.
2. Escolhe uma ideia/alteração de página, conteúdo/fonte/tradução ou um erro.
3. Escreve no teu idioma: página, alteração pretendida e motivo. Acrescenta referências verificáveis para correções e fontes. Seleciona **Submit new issue**.

Não precisas de programar nem instalar nada. Podes sugerir o texto exato. Para editar, abre o ficheiro e seleciona o **lápis (Edit this file)**. Cria um **fork** se o GitHub pedir. Usa **Propose changes → Create pull request** e preenche o modelo. A proposta é revista antes de ser integrada. Se não encontrares o ficheiro, descreve a página numa issue.

## Where to edit / Dove intervenire

| Change / Modifica | File or directory |
| --- | --- |
| News sources / Fonti delle notizie | `app/data/catalog.ts` |
| Video channels / Canali video | `app/data/video-channels.json` |
| Books and editions / Libri ed edizioni | `app/data/open-books.json`, `app/data/library-resources.json` |
| Historical chapters and references / Dossier e documenti | `app/data/history-dossiers.json` |
| Dossier titles / Titoli dei dossier | `app/data/history-index.json` — keep IDs consistent with the full dossiers |
| Social achievements atlas / Atlante delle conquiste | `app/data/social-achievements.ts` |
| Page layout / Impaginazione | `app/components/`, `app/globals.css` |
| Translation behavior / Traduzioni | `app/components/Localization.tsx`, `app/lib/translation.ts` |
| Project documentation / Documentazione | `README.md`, `docs/` |

A proposal may simply name a page: knowing these files is optional. Source articles remain attributed and linked to their publishers. Propose original summaries, licensed material or links; do not paste complete copyrighted books or articles.

## Technical contributions

Read [AGENTS.md](AGENTS.md), [README.md](README.md) and the relevant section of [ARCHITECTURE.md](docs/ARCHITECTURE.md). Start from a concrete problem and keep each change focused. An issue is helpful for large changes but is not mandatory for small fixes.

1. Fork the repository and create a short branch from `main`.
2. Run `npm ci`, then `npm run dev` for local development. Node.js 22.13+ is required; CI uses Node.js 24.
3. Preserve source IDs, book IDs, personal collections and existing storage keys. The product is now Internazionale Rossa; legacy `rassegna-rossa.*` keys remain for compatibility.
4. For code or structured catalogue changes, run `npm test` and `npm run typecheck`. Add meaningful regression coverage for changed behavior. Check small screens and keyboard access when changing the UI; state any verification you could not perform. Documentation-only changes do not require building the application.
5. Open a pull request using the template. Explain the result and validation. If dependency inputs change, update the lockfile too.

Keep credentials, `.env`, caches, personal collections, local paths and build outputs out of commits. Use synthetic fixtures for private data. Do not add a new dependency or hosting service without explaining the need. Existing database migrations are immutable.

GitHub checks code; it does not deploy the Site automatically. Publication is handled separately after review. Contributors do not need production credentials.
