import { collectionOrder } from "../app/lib/collection.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  preferredLanguageFor,
  rankSources,
  resolveLanguageChoices,
} from "../app/lib/source-selection.ts";
import { SOURCE_CATALOG } from "../app/data/catalog.ts";
import { filterArticles, restoreNewsSnapshot } from "../app/lib/reading.ts";

const article = (id, language, publishedAt) => ({
  id,
  language,
  publishedAt,
  sourceId: "source",
  sourceName: "Fonte",
  sourceHomepage: "https://example.org/",
  country: "Italia",
  region: "Italia",
  kind: "giornale",
  ideologies: [],
  title: "Titolo",
  link: "https://example.org/" + id,
  excerpt: "Estratto",
  topics: [],
  categories: [],
  score: 1,
  image: null,
  author: null,
});
const filters = {
  query: "",
  region: "all",
  language: "all",
  kind: "all",
  ideology: "all",
  topic: "all",
  source: "all",
  days: Infinity,
  sort: "fresh",
};

test("browser language variants choose a supported language without geolocation", () => {
  assert.equal(preferredLanguageFor(["it-CH", "en-US"], ["it", "en"]), "it");
  assert.equal(
    preferredLanguageFor(["fr-CA", "en-US"], ["it", "en", "fr"]),
    "fr",
  );
  assert.equal(preferredLanguageFor(["xx-ZZ", "es-MX"], ["es", "en"]), "es");
  assert.equal(preferredLanguageFor(["xx-ZZ"], ["it", "en"]), "en");
});

test("headlines in the preferred language lead without hiding other languages", () => {
  const cards = [
    article("en", "en", "2026-10-16"),
    article("it", "it", "2026-10-07"),
  ];
  assert.deepEqual(
    filterArticles(cards, { ...filters, preferredLanguage: "it" }).map(
      (a) => a.id,
    ),
    ["it", "en"],
  );
  assert.deepEqual(
    filterArticles(cards, { ...filters, preferredLanguage: "all" }).map(
      (a) => a.id,
    ),
    ["en", "it"],
  );
  assert.deepEqual(
    filterArticles(cards, {
      ...filters,
      preferredLanguage: "it",
      language: "en",
    }).map((a) => a.id),
    ["en"],
  );
});

test("the automatic collection includes the entire unique catalogue and balances early responses", () => {
  const order = collectionOrder(SOURCE_CATALOG, "it");
  assert.equal(order.length, SOURCE_CATALOG.length);
  assert.equal(
    new Set(order.map((source) => source.id)).size,
    SOURCE_CATALOG.length,
  );
  for (const id of ["ottolina", "dazibao", "ottolina-dazibao"])
    assert.ok(order.slice(0, 6).some((source) => source.id === id));
  assert.ok(
    new Set(order.slice(0, 32).map((source) => source.region)).size >= 6,
  );
  assert.ok(
    new Set(order.slice(0, 40).map((source) => source.language)).size >= 6,
  );
  assert.ok(
    SOURCE_CATALOG.filter((source) => source.kind !== "radar").length >= 129,
  );
  assert.equal(rankSources(SOURCE_CATALOG, "fr")[0].language, "fr");
});

test("reading language never selects or resets the language of sources", () => {
  const available = ["it", "en", "fr"];
  assert.deepEqual(
    resolveLanguageChoices(
      { reading: "it", sources: "fr", legacy: null },
      available,
    ),
    { reading: "it", sources: "fr" },
  );
  assert.deepEqual(
    resolveLanguageChoices(
      { reading: "en", sources: "fr", legacy: "it" },
      available,
    ),
    { reading: "en", sources: "fr" },
  );
  assert.deepEqual(
    resolveLanguageChoices(
      { reading: null, sources: null, legacy: "fr" },
      available,
    ),
    { reading: "fr", sources: "all" },
  );
  assert.deepEqual(
    resolveLanguageChoices(
      { reading: "auto", sources: "all", legacy: "it" },
      available,
    ),
    { reading: "auto", sources: "all" },
  );
  assert.deepEqual(
    resolveLanguageChoices(
      { reading: "invalid", sources: "invalid", legacy: null },
      available,
    ),
    { reading: "auto", sources: "all" },
  );
});

test("news snapshots distinguish reusable, stale and expired data", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  const pack = (age) =>
    JSON.stringify({
      updatedAt: now - age,
      articles: [article("one", "it", "2026-10-16")],
    });
  assert.equal(restoreNewsSnapshot(pack(60_000), now).fresh, true);
  assert.equal(restoreNewsSnapshot(pack(3_600_000), now).fresh, false);
  assert.equal(restoreNewsSnapshot(pack(86_400_001), now), null);
  assert.equal(restoreNewsSnapshot("broken", now), null);
  assert.equal(
    restoreNewsSnapshot(
      JSON.stringify({
        updatedAt: now,
        articles: [{ id: "unsafe", link: "javascript:alert(1)" }],
      }),
      now,
    ),
    null,
  );
});
