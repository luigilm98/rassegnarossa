import assert from "node:assert/strict";
import test from "node:test";
import {
  safeWebUrl,
  restoreSavedArticles,
  mergeArticles,
  filterArticles,
} from "../app/lib/reading.ts";

const article = (changes = {}) => ({
  id: "a",
  sourceId: "source",
  sourceName: "Una fonte",
  sourceHomepage: "https://example.org/",
  region: "Italia",
  country: "Italia",
  language: "it",
  kind: "giornale",
  ideologies: ["socialista"],
  title: "Una vertenza sul lavoro",
  link: "https://example.org/article",
  publishedAt: "2026-01-02T12:00:00Z",
  author: null,
  excerpt: "Una descrizione",
  categories: ["sciopero"],
  topics: ["lavoro"],
  image: null,
  score: 10,
  ...changes,
});
const filters = {
  query: "",
  region: "all",
  language: "all",
  kind: "all",
  ideology: "all",
  topic: "all",
  source: "all",
  days: 7,
  sort: "fresh",
};

test("saved cards survive a storage round trip and malformed storage is tolerated", () => {
  const cards = [article()];
  assert.deepEqual(restoreSavedArticles(JSON.stringify(cards)), cards);
  for (const value of [null, "{broken", "null", "{}", "[null, 3, {}]"])
    assert.deepEqual(restoreSavedArticles(value), []);
  assert.deepEqual(
    restoreSavedArticles(
      JSON.stringify([
        article({ link: "javascript:alert(1)" }),
        article({ topics: [null] }),
      ]),
    ),
    [],
  );
});

test("external links accept only web URLs without embedded credentials", () => {
  assert.equal(
    safeWebUrl("https://example.org/read"),
    "https://example.org/read",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/file",
    "https://user:password@example.org/",
    "/relative",
    null,
    {},
  ])
    assert.equal(safeWebUrl(value), null);
});

test("filters combine topics, geography, source and date without hiding undated items", () => {
  const now = Date.parse("2026-01-03T12:00:00Z");
  const cards = [
    article(),
    article({ id: "b", region: "Asia" }),
    article({ id: "c", topics: ["ecologia"] }),
    article({ id: "d", publishedAt: "2025-01-01T12:00:00Z" }),
    article({ id: "e", publishedAt: null }),
  ];
  assert.deepEqual(
    filterArticles(
      cards,
      {
        ...filters,
        region: "Italia",
        topic: "lavoro",
        query: "SCIOPERO",
        source: "source",
      },
      now,
    ).map((a) => a.id),
    ["a", "e"],
  );
  assert.equal(
    filterArticles(cards, { ...filters, source: "missing" }, now).length,
    0,
  );
  assert.equal(
    filterArticles(cards, { ...filters, days: Infinity }, now).length,
    5,
  );
});

test("refresh merges new records without discarding existing or saved entries", () => {
  const result = mergeArticles(
    [article(), article({ id: "b" })],
    [article({ title: "Titolo aggiornato" })],
  );
  assert.equal(result.length, 2);
  assert.equal(result.find((a) => a.id === "a").title, "Titolo aggiornato");
  assert.equal(result.find((a) => a.id === "b").sourceName, "Una fonte");
});

test('introductory paths point to available works, keep historical saved IDs and cover cooperation and alternatives', async () => {
  const { READING_PATHS, DOSSIERS } = await import('../app/data/editorial.ts');
  const { THEORY_LIBRARY } = await import('../app/data/library.ts');
  const { TOPIC_TAXONOMY } = await import('../app/data/catalog.ts');
  const ids = new Set(THEORY_LIBRARY.map(book => book.id));
  const topics = new Set(TOPIC_TAXONOMY.map(topic => topic.id));
  for (const path of READING_PATHS) for (const id of path.books) assert.ok(ids.has(id), `Missing book ${id}`);
  const recommended = new Set(READING_PATHS.flatMap(path => path.books));
  for (const id of ["manifesto","mutuo-appoggio","cooperazione-lenin","commons-viventi","conquista-pane"]) assert.ok(recommended.has(id));
  for (const id of ["manifesto","capitale","stato-rivoluzione","imperialismo","riforma-rivoluzione","socialismo-utopico-scientifico","gramsciana","comune-parigi","dipendenza","femminismo-marxista"]) assert.ok(ids.has(id));
  assert.ok(THEORY_LIBRARY.filter(book => book.editions?.length).length >= 30);
  assert.ok(new Set(THEORY_LIBRARY.flatMap(book => book.editions?.map(edition => edition.language) ?? [])).size >= 20);
  for (const dossier of DOSSIERS) assert.ok(topics.has(dossier.id), `Missing topic ${dossier.id}`);
});

test("a text-only refresh preserves the recovered photo for the same story while allowing a newer publisher image", () => {
 const known=article({image:"https://example.org/recovered.jpg"});
 const refreshed=mergeArticles([known],[article({title:"Updated title",image:null})]);
 assert.equal(refreshed[0].title,"Updated title");
 assert.equal(refreshed[0].image,known.image);
 assert.equal(mergeArticles(refreshed,[article({image:"https://example.org/new.jpg"})])[0].image,"https://example.org/new.jpg");
 assert.equal(mergeArticles([known],[article({link:"https://example.org/different",image:null})])[0].image,null);
});

test('expanded library exposes Mao and other authors through real, distinct language editions',async()=>{
 const {THEORY_LIBRARY,bookEdition,BOOK_LANGUAGES}=await import('../app/data/library.ts');
 const ids=new Set();
 for(const book of THEORY_LIBRARY){
  assert.ok(!ids.has(book.id),'Duplicate book ID '+book.id);ids.add(book.id);
  const languages=new Set();
  for(const edition of book.editions??[]){
   assert.ok(!languages.has(edition.language),'Duplicate edition '+book.id);languages.add(edition.language);
   assert.ok(BOOK_LANGUAGES[edition.language]);assert.equal(new URL(edition.url).protocol,'https:');
   assert.equal(bookEdition(book.id,edition.language),edition);
  }
 }
 for(const id of ['mao-pratica','mao-contraddizione','mao-organizzarsi','mao-servire-popolo','mao-cooperazione-agricola','mao-opere-1','mao-opere-5','mao-citazioni','gramsci-citta-futura','zetkin-donne-socialismo','capitale-2','capitale-3'])assert.ok(THEORY_LIBRARY.find(book=>book.id===id)?.editions?.length,id);
 assert.equal(bookEdition('mao-pratica','it').language,'it');
 assert.equal(bookEdition('mao-pratica','es').language,'es');
 assert.equal(bookEdition('mao-pratica','pt').language,'pt');
 assert.ok(THEORY_LIBRARY.filter(book=>book.author==='Mao Zedong').length>=25);
});

test('lightweight saved-book IDs remain in sync with the lazily loaded complete catalogue',async()=>{
 const {readFile}=await import('node:fs/promises');
 const ids=JSON.parse(await readFile(new URL('../app/data/book-ids.json',import.meta.url),'utf8'));
 const {THEORY_LIBRARY}=await import('../app/data/library.ts');
 assert.deepEqual(ids,THEORY_LIBRARY.map(book=>book.id));
});
