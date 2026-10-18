import test from "node:test";
import assert from "node:assert/strict";
import {
  editorialAssessment,
  rankEditorial,
} from "../app/lib/editorial-ranking.ts";
const now = Date.parse("2026-10-18T12:00:00Z");
const article = (id, title, age = 1000, publisher = id, excerpt = "") => ({
  id,
  title,
  excerpt,
  sourceName: publisher,
  sourceId: publisher,
  language: "en",
  link: `https://example.org/${id}`,
  publishedAt: new Date(now - age).toISOString(),
  categories: [],
  topics: [],
  score: 999,
});

test("political learning and usable tools outrank a newer electoral trend without using popularity", () => {
  const trend = article(
    "trend",
    "Latest election poll changes after televised debate",
  );
  const guide = article(
    "guide",
    "A practical guide: how to build a tenant union and collective bargaining",
    6 * 864e5,
  );
  const ordered = rankEditorial([trend, guide], "en", now);
  assert.equal(ordered[0].id, "guide");
  assert.ok(editorialAssessment(guide, now).axes.includes("strumenti"));
  assert.equal(editorialAssessment(trend, now).axes.length, 0);
  assert.deepEqual(
    rankEditorial([{ ...trend, score: 100000 }, guide], "en", now).map(
      (a) => a.id,
    ),
    ["guide", "trend"],
  );
});

test("mentioning a right-wing party or a trend alone is not treated as an analysis of power", () => {
  assert.equal(
    editorialAssessment(
      article("one", "Far right wins a seat after election night"),
      now,
    ).axes.includes("potere"),
    false,
  );
  assert.ok(
    editorialAssessment(
      article(
        "two",
        "Analysis: how far-right propaganda reshapes austerity politics",
      ),
      now,
    ).axes.includes("potere"),
  );
  assert.ok(
    editorialAssessment(
      {
        ...article(
          "three",
          "Guida alla sicurezza digitale e al pensiero critico",
        ),
        language: "it",
      },
      now,
    ).axes.includes("strumenti"),
  );
});

test("publisher diversity preserves every item and never promotes generic news above useful material", () => {
  const guides = Array.from({ length: 8 }, (_, index) =>
    article(
      `guide-${index}`,
      `How to organize a union: practical guide ${index}`,
      1000,
      "Publisher",
    ),
  );
  const trends = Array.from({ length: 15 }, (_, index) =>
    article(
      `news-${index}`,
      `Daily headline number ${index}`,
      1000,
      `Other ${index}`,
    ),
  );
  const ranked = rankEditorial([...trends, ...guides], "en", now);
  assert.equal(ranked.length, 23);
  assert.ok(ranked.slice(0, 8).every((item) => item.id.startsWith("guide")));
  const diverse = rankEditorial(
    [
      ...guides,
      ...Array.from({ length: 25 }, (_, i) =>
        article(
          `other-guide-${i}`,
          `Guide to critical thinking ${i}`,
          1000,
          `Source ${i}`,
        ),
      ),
    ],
    "en",
    now,
  );
  assert.ok(
    diverse.slice(0, 24).filter((item) => item.sourceName === "Publisher")
      .length <= 2,
  );
  assert.equal(diverse.length, 33);
});

test("deduplication strips tracking without conflating different articles or dated editions", () => {
  const one = article("one", "A guide to collective action");
  const duplicate = {
    ...one,
    id: "duplicate",
    link: one.link + "?utm_source=rss#top",
  };
  const next = {
    ...one,
    id: "next",
    link: "https://example.org/next",
    publishedAt: new Date(now - 864e5).toISOString(),
  };
  const ranked = rankEditorial([one, duplicate, next], "en", now);
  assert.equal(ranked.length, 2);
  assert.equal(new Set(ranked.map((a) => a.id)).size, 2);
});
