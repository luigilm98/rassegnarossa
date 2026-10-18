import test from "node:test";
import assert from "node:assert/strict";
import { rankPulse, SIX_HOURS_MS } from "../app/lib/pulse.ts";
import { recommendedSources } from "../app/lib/source-selection.ts";
import { SOURCE_CATALOG } from "../app/data/catalog.ts";
import { QUOTATIONS, nextQuotation } from "../app/data/quotes.ts";
const now = Date.parse("2026-10-18T12:00:00Z");
const card = (
  id,
  age,
  title = "Workers announce major strike across national rail network",
  publisher = id,
) => ({
  id,
  title,
  sourceName: publisher,
  sourceId: publisher,
  language: "en",
  link: `https://example.org/${id}`,
  publishedAt: age === null ? null : new Date(now - age).toISOString(),
  topics: [],
  region: "Europa",
});

test("recommendations follow every language including scarce-language radar fallbacks", () => {
  for (const language of new Set(
    SOURCE_CATALOG.map((source) => source.language),
  )) {
    const recommendations = recommendedSources(SOURCE_CATALOG, language);
    assert.ok(
      recommendations.length > 0 && recommendations.length <= 3,
      language,
    );
    assert.ok(
      recommendations.every((source) => source.language === language),
      language,
    );
  }
  assert.deepEqual(
    recommendedSources(SOURCE_CATALOG, "it").map((source) => source.id),
    ["ottolina", "dazibao", "ottolina-dazibao"],
  );
  assert.deepEqual(recommendedSources(SOURCE_CATALOG, "unknown"), []);
});

test("six-hour observatory excludes old, undated, invalid and future items including at boundaries", () => {
  const cards = [
    card("recent", 1000),
    card(
      "boundary",
      SIX_HOURS_MS,
      "Completely different headline for the time window",
    ),
    card("old", SIX_HOURS_MS + 1),
    card("future", -1),
    card("unknown", null),
    { ...card("invalid", 0), publishedAt: "invalid" },
  ];
  assert.deepEqual(
    rankPulse(cards, now).map((story) => story.article.id),
    ["recent", "boundary"],
  );
  assert.deepEqual(rankPulse([], now), []);
});

test("ranking counts distinct publishers, groups near-identical titles and deduplicates links", () => {
  const first = card("one", 1800000);
  const second = card(
    "two",
    1800000,
    "Workers announce major strike across national rail network today",
  );
  const independent = card(
    "fresh",
    60000,
    "New climate agreement announced after lengthy international negotiations",
  );
  const ranked = rankPulse(
    [first, second, { ...first, id: "duplicate" }, independent],
    now,
  );
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].coverage.length, 2);
  assert.equal(ranked[0].breadth, 15);
  assert.ok(ranked[0].score > ranked[1].score);
  assert.equal(
    rankPulse([first, { ...second, sourceName: first.sourceName }], now)[0]
      .breadth,
    0,
  );
  assert.equal(
    rankPulse([first, { ...second, language: "fr" }], now).length,
    2,
  );
});

test("a reload selects a different sourced quotation and handles invalid saved indices", () => {
  for (let previous = 0; previous < QUOTATIONS.length; previous++)
    for (const random of [0, 0.2, 0.5, 0.9, 1]) {
      const next = nextQuotation(previous, random);
      assert.notEqual(next, previous);
      assert.ok(QUOTATIONS[next].url.startsWith("https://www.marxists.org/"));
    }
  assert.ok(QUOTATIONS[nextQuotation(-999)]);
});


test("the complete network supplements a sparse regional collection without duplicates or stale stories", () => {
  const regional = [card("regional", 60000, "International negotiations reopen after emergency summit")];
  const network = Array.from({ length: 15 }, (_, index) => ({
    ...card(`network-${index}`, (index + 1) * 120000, `報道${index}`),
    language: index % 2 ? "it" : "zh",
  }));
  const stories = rankPulse([...network, ...regional, ...regional,
    card("stale", SIX_HOURS_MS + 1), card("undated", null)], now);
  assert.equal(stories.length, 16);
  assert.equal(stories.filter(story => story.article.id === "regional").length, 1);
  assert.ok(stories.some(story => story.article.language === "zh"));
  assert.equal(rankPulse(network, now).length, 15, "regional outages preserve network stories");
  assert.equal(rankPulse([...network, ...regional], now + SIX_HOURS_MS).length, 0,
    "stories expire as the six-hour window advances");
});

test("indexed clustering preserves representative-only comparisons, first matching group, language and four-word minimum", () => {
 const input = [
  card("a", 1000, "alpha bravo charlie delta echo foxtrot"),
  card("b", 2000, "alpha bravo charlie delta golf hotel"),
  card("both", 3000, "alpha bravo charlie delta echo golf"),
  {...card("french", 4000, "alpha bravo charlie delta echo foxtrot"),language:"fr"},
  card("short-a", 5000, "tiny short title"),
  card("short-b", 6000, "tiny short title"),
 ];
 const grouped = rankPulse(input, now);
 assert.deepEqual(grouped.find(story=>story.article.id==="a").coverage.map(article=>article.id),["a","both"]);
 assert.deepEqual(grouped.find(story=>story.article.id==="b").coverage.map(article=>article.id),["b"]);
 assert.equal(grouped.length,5);
 const representative = [
  card("first",1000,"alpha bravo charlie delta echo"),
  card("second",2000,"alpha bravo charlie delta foxtrot"),
  card("third",3000,"alpha bravo charlie foxtrot golf"),
 ];
 assert.deepEqual(rankPulse(representative,now).map(story=>story.coverage.map(article=>article.id)),[["first","second"],["third"]]);
});
