import test from "node:test";
import assert from "node:assert/strict";
import { SOURCE_CATALOG } from "../app/data/catalog.ts";
import { createPublisherResolver } from "../app/lib/publisher.ts";
const resolve = createPublisherResolver(SOURCE_CATALOG);
const radar = { sourceId: "radar:unknown", sourceHomepage: "https://www.humanite.fr/", country: "Regno Unito", language: "en", kind: "radar" };

test("a French publisher found in an English radar edition keeps the publisher's actual country and language", () => {
 assert.deepEqual(resolve(radar), { country: "Francia", language: "fr" });
 assert.deepEqual(resolve({ ...radar, sourceHomepage: "https://humanite.fr/societe" }), { country: "Francia", language: "fr" });
});

test("unknown radar publishers do not inherit an edition's country or infer nationality from a URL domain", () => {
 assert.deepEqual(resolve({ ...radar, sourceHomepage: "https://unlisted.example.tv/" }), { country: null, language: "en" });
 assert.equal(resolve({ ...radar, sourceHomepage: "https://humanite.fr.unlisted.example/" }).country, null);
});

test("direct feeds, pulse backups and old saved direct sources preserve their publisher metadata", () => {
 assert.deepEqual(resolve({ ...radar, sourceId: "pulse-direct-morning-star", sourceHomepage: "", kind: "giornale" }), { country: "Regno Unito", language: "en" });
 assert.deepEqual(resolve({ ...radar, sourceId: "old-removed-source", sourceHomepage: "https://unlisted.example/", kind: "giornale", country: "Italia", language: "it" }), { country: "Italia", language: "it" });
});

test("native articles keep their original language even when the publisher domain has another catalog language", () => {
 for (const language of new Set(SOURCE_CATALOG.map(source => source.language))) {
  assert.equal(resolve({ ...radar, sourceId: "multilingual-feed", kind: "giornale", language }).language, language);
 }
 // The source's catalog language must not override explicit per-item metadata either.
 assert.equal(resolve({ ...radar, sourceId: "pulse-direct-morning-star", kind: "giornale", language: "it" }).language, "it");
});
