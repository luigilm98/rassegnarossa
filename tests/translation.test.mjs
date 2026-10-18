import test from "node:test";
import assert from "node:assert/strict";
import {
  translatePublicText,
  translateGoogleText,
  translateAvailableText,
  chunkTranslationText,
} from "../app/lib/translation.ts";

test("public translation fallback uses explicit languages and never browser credentials", async () => {
  const text = "A collective library shares knowledge. ".repeat(20).trim();
  const calls = [];
  const translated = await translatePublicText(
    text,
    "en",
    "fr",
    async (url, options) => {
      calls.push({ url: new URL(url), options });
      return Response.json({
        responseStatus: 200,
        responseData: { translatedText: new URL(url).searchParams.get("q") },
      });
    },
  );
  assert.equal(translated, text);
  assert.ok(calls.length > 1);
  for (const { url, options } of calls) {
    assert.equal(url.origin, "https://api.mymemory.translated.net");
    assert.equal(url.searchParams.get("langpair"), "en|fr");
    assert.equal(options.credentials, "omit");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.mode, "cors");
    assert.ok(
      new TextEncoder().encode(url.searchParams.get("q")).length <= 460,
    );
  }
});

test("translation fallback fails visibly for quotas, empty results, invalid languages and network errors", async () => {
  for (const reply of [
    { responseStatus: 429, responseData: { translatedText: "QUOTA" } },
    {
      responseStatus: 200,
      quotaFinished: true,
      responseData: { translatedText: "QUOTA" },
    },
    { responseStatus: 200 },
    { responseStatus: 200, responseData: { translatedText: "" } },
  ]) {
    await assert.rejects(
      translatePublicText("Knowledge", "en", "it", async () =>
        Response.json(reply),
      ),
    );
  }
  await assert.rejects(
    translatePublicText("Knowledge", "auto", "it", async () => {
      throw new Error("Must not fetch");
    }),
  );
  await assert.rejects(
    translatePublicText("Knowledge", "en", "it", async () => {
      throw new Error("Offline");
    }),
  );
  assert.equal(
    await translatePublicText("Sapere", "it", "it", async () => {
      throw new Error("Must not fetch");
    }),
    "Sapere",
  );
  const chunks = chunkTranslationText("知识🎵".repeat(200));
  assert.ok(
    chunks.every(
      (chunk) =>
        new TextEncoder().encode(chunk).length <= 460 && !chunk.includes("�"),
    ),
  );
});


test("Google translates complete sentence segments with explicit languages, bounded UTF-8 and no browser credentials", async () => {
 const calls = [];
 const text = "知识共享与集体行动。".repeat(100);
 const result = await translateGoogleText(text, "zh", "it", async (url, options) => {
  const params = new URL(url).searchParams;
  calls.push({ params, options });
  return Response.json([[["Condividere il sapere. ", params.get("q")], ["Agire insieme.", ""]], null, "zh"]);
 });
 assert.ok(calls.length > 1);
 assert.ok(result.includes("Condividere il sapere. Agire insieme."));
 for (const {params, options} of calls) {
  assert.equal(params.get("sl"), "zh"); assert.equal(params.get("tl"), "it");
  assert.ok(new TextEncoder().encode(params.get("q")).length <= 1600);
  assert.equal(options.credentials, "omit"); assert.equal(options.referrerPolicy, "no-referrer");
 }
});

test("a rate-limited translation provider falls back to the other provider without returning error pages as translated text", async () => {
 const calls = [];
 const result = await translateAvailableText("Workers defend rights", "en", "it", async url => {
  calls.push(String(url));
  return String(url).includes("translate.googleapis.com")
   ? new Response("Too many requests", { status: 429 })
   : Response.json({ responseStatus: 200, responseData: { translatedText: "I lavoratori difendono i diritti" } });
 });
 assert.equal(result, "I lavoratori difendono i diritti");
 assert.equal(calls.length, 2);
 assert.ok(calls[1].startsWith("https://api.mymemory.translated.net/"));
 for (const value of [[], [null], [[[null]]], {error: "Quota exceeded"}])
  await assert.rejects(translateGoogleText("News", "en", "it", async () => Response.json(value)));
 assert.equal(await translateGoogleText("Notizie", "it", "it", async () => { throw new Error("Must not fetch"); }), "Notizie");
});

test("every catalog language bypasses both providers when source and reading language coincide", async () => {
 const { SOURCE_CATALOG } = await import("../app/data/catalog.ts");
 const languages = new Set(SOURCE_CATALOG.map(source => source.language));
 const noNetwork = async () => { assert.fail("same-language text must never reach a translation provider"); };
 const original = "Titolo originale — 你好 — Привет";
 for (const language of languages) {
  for (const translate of [translateGoogleText, translatePublicText, translateAvailableText]) {
   assert.equal(await translate(original, language, language, noNetwork), original, language);
  }
 }
 for (const [from, to] of [["it-IT", "it"], ["EN_us", "en"], ["pt-BR", "pt-PT"], ["fr-CA", "fr"], ["es-419", "es"], ["zh-Hans", "zh-CN"], ["zh-Hant", "zh-TW"]]) {
  for (const translate of [translateGoogleText, translatePublicText, translateAvailableText]) {
   assert.equal(await translate(original, from, to, noNetwork), original, `${from}/${to}`);
  }
 }
});
