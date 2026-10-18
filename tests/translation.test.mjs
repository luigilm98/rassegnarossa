import test from "node:test";
import assert from "node:assert/strict";
import {
  translatePublicText,
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
