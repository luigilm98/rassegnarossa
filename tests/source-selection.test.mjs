import assert from "node:assert/strict";
import test from "node:test";
import {
  preferredLanguageFor,
  rankSources,
  nextSourcePage,
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

test("initial collection is bounded and contains Ottolina and both Dazibao sources in Italian", () => {
  const page = nextSourcePage(SOURCE_CATALOG, "it", new Set());
  assert.equal(page.length, 16);
  for (const id of ["ottolina", "dazibao", "ottolina-dazibao"])
    assert.ok(page.some((s) => s.id === id));
  assert.ok(page.every((s) => s.language === "it"));
  const next = nextSourcePage(
    SOURCE_CATALOG,
    "it",
    new Set(page.map((s) => s.id)),
  );
  assert.ok(next.every((s) => !page.some((first) => first.id === s.id)));
  assert.equal(rankSources(SOURCE_CATALOG, "fr")[0].language, "fr");
  assert.ok(SOURCE_CATALOG.filter((s) => s.kind !== "radar").length >= 86);
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
