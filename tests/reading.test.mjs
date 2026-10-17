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

test('reading paths point to existing works and preserve all library entries', async () => {
  const { READING_PATHS, DOSSIERS } = await import('../app/data/editorial.ts');
  const { THEORY_LIBRARY } = await import('../app/data/library.ts');
  const { TOPIC_TAXONOMY } = await import('../app/data/catalog.ts');
  const ids = new Set(THEORY_LIBRARY.map(book => book.id));
  const topics = new Set(TOPIC_TAXONOMY.map(topic => topic.id));
  for (const path of READING_PATHS) for (const id of path.books) assert.ok(ids.has(id), `Missing book ${id}`);
  assert.deepEqual(new Set(READING_PATHS.flatMap(path => path.books)), ids);
  for (const dossier of DOSSIERS) assert.ok(topics.has(dossier.id), `Missing topic ${dossier.id}`);
});
