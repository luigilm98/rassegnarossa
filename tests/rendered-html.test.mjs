import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the aggregator shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="it">/i);
  assert.match(html, /<title>Rassegna Rossa<\/title>/i);
  assert.match(html, /class="initial-loading"[^>]*role="status"[^>]*aria-busy="true"/);
  assert.match(html, /class="edition-preparing"[^>]*inert=""[^>]*aria-hidden="true"/);
  assert.match(html, /Prepariamo la rassegna/);
  assert.match(html, /Aggregatore socialista globale/);
  assert.match(html, /Tesi su Feuerbach/);
  assert.match(html, /community-emblem/);
  assert.match(html, /rassegna<span class="wordmark-black">rossa<\/span>/);
  assert.match(html, /OSSERVATORIO MONDIALE/);
  const observatory = html.match(/<aside class="world-watch"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(observatory);
  assert.match(observatory, /Paese della testata/);
  assert.doesNotMatch(observatory, /Tutte le aree/);
  assert.doesNotMatch(observatory, /Perché è in evidenza|Come viene calcolato|Freschezza|Segnale|\/100/);
  assert.match(html, /aria-label="Lingua di lettura"/);
  assert.match(html, /aria-label="Lingua delle fonti in analisi"/);
  assert.match(html, /reading-language-control/);
  assert.match(html, /source-language-control source-language-inline/);
  const toolbar = html.slice(html.indexOf('class="filter-toolbar"'), html.indexOf('id="advanced-filters"'));
  assert.match(toolbar, /aria-label="Lingua delle fonti in analisi"/);
  assert.match(html, /aria-label="Ordina le notizie"/);
  assert.match(html, /In evidenza dalle fonti/);
  assert.match(html, /Ultimi articoli/);
  assert.match(html, /Più letti sulle fonti/);
  assert.match(html, /id="advanced-filters"[^>]*hidden/);
  assert.doesNotMatch(html, /dossier-strip|editorial-compass|source-shortcuts|topic-tabs|editorial-hero|hero-art|Entra nella rassegna/);
  assert.ok(html.indexOf('id="letture"') < html.indexOf('class="daily-quotation"'));
  assert.match(html, /<h1 id="page-title">/);
  assert.doesNotMatch(html, /Carica altre fonti|Mostra altre fonti/);
  assert.doesNotMatch(html, /Il mondo, da un’altra/);
  assert.match(html, /Atlante delle fonti/);
  assert.match(html, /Biblioteca/);
  assert.match(html, /Salvati/);
  assert.match(html, /Vai ai contenuti/);
  assert.match(html, /id="letture"/);
  assert.match(html, /aria-label="Cerca articoli"/);
  assert.match(html, /<dialog/);
  assert.doesNotMatch(html, /appgprj_|appgrepo_|@gmail\.com|art_v2_/i);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|SkeletonPreview/i,
  );
});

test("keeps the product detached from the starter preview", async () => {
  const [page, layout, packageJson, catalog, globals] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<AggregatorApp \/>/);
  assert.match(layout, /title:\s*"Rassegna Rossa"/);
  assert.match(layout, /lang="it"/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(catalog, /id:\s*"ottolina"/);
  assert.match(catalog, /id:\s*"ottolina-dazibao"/);
  assert.match(catalog, /id:\s*"google-news-socialismo-it"/);
  assert.match(catalog, /id:\s*`radar-\$\{locale\.id\}-\$\{query\.id\}`/);
  assert.match(catalog, /name:\s*"Russia"/);
  assert.match(catalog, /name:\s*"Cina"/);
  assert.match(globals, /prefers-reduced-motion/);
  assert.match(globals, /focus-visible/);

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});

test("serves the source directory and handles unavailable sources without network", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const response = await worker.fetch(
    new Request("http://localhost/api/sources"),
    env,
    ctx,
  );
  assert.equal(response.status, 200);
  const directory = await response.json();
  assert.ok(directory.sources.length > 0);
  assert.ok(directory.sources.some((s) => s.id === "ottolina"));
  const empty = await worker.fetch(
    new Request("http://localhost/api/articles?sourceIds=does-not-exist"),
    env,
    ctx,
  );
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).articles, []);
});

test("translation validates empty text and preserves same-language content", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const request = (body) =>
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const invalid = await worker.fetch(request({ text: "" }), env, ctx);
  assert.equal(invalid.status, 400);
  const same = await worker.fetch(
    request({ text: "Una lettura", from: "it", to: "it" }),
    env,
    ctx,
  );
  assert.equal(same.status, 200);
  assert.equal((await same.json()).translatedText, "Una lettura");
});

test("known feeds bypass homepage discovery and retain source identity", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(
      '<rss version="2.0"><channel><title>Fixture</title><item><title>Notizia di prova</title><link>https://example.org/prova</link><guid>fixture-one</guid><pubDate>Fri, 16 Oct 2026 15:00:00 GMT</pubDate><description>Un estratto sintetico per il test.</description></item></channel></rss>',
      { headers: { "content-type": "application/rss+xml" } },
    );
  };
  try {
    const env = {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    };
    const ctx = { waitUntil() {}, passThroughOnException() {} };
    for (const [id, feed] of [
      ["ottolina", "https://ottolinatv.it/feed/"],
      [
        "ottolina-dazibao",
        "https://ottolinatv.it/category/la-tv/dazibao/feed/",
      ],
    ]) {
      const response = await worker.fetch(
        new Request(
          `http://localhost/api/articles?sourceIds=${id}&limitPerSource=23`,
        ),
        env,
        ctx,
      );
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.statuses[0].ok, true);
      assert.equal(body.articles[0].sourceId, id);
      assert.equal(body.statuses[0].feedUrl, feed);
    }
    assert.deepEqual(calls, [
      "https://ottolinatv.it/feed/",
      "https://ottolinatv.it/category/la-tv/dazibao/feed/",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unreachable declared feeds stop after known candidates instead of sweeping homepages", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("Unavailable", { status: 503 });
  };
  try {
    const response = await worker.fetch(
      new Request(
        "http://localhost/api/articles?sourceIds=dazibao&limitPerSource=22",
      ),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    const result = await response.json();
    assert.equal(result.statuses[0].ok, false);
    assert.deepEqual(result.articles, []);
    assert.equal(calls.length, 2);
    assert.match(calls[0], /youtube.com\/@dazibao\/videos/);
    assert.match(calls[1], /youtube.com\/feeds\/videos.xml/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("configured YouTube listings provide titles without inventing publication dates", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const originalFetch = globalThis.fetch;
  const listing = {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              selected: true,
              content: {
                richGridRenderer: {
                  contents: [
                    {
                      lockupViewModel: {
                        contentId: "Sample00001",
                        metadata: {
                          lockupMetadataViewModel: {
                            title: { content: "Un video di prova sulla Cina" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(
      `<script>var ytInitialData = ${JSON.stringify(listing)};</script>`,
      { headers: { "content-type": "text/html" } },
    );
  };
  try {
    const response = await worker.fetch(
      new Request(
        "http://localhost/api/articles?sourceIds=dazibao&limitPerSource=21",
      ),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    const result = await response.json();
    assert.equal(result.statuses[0].ok, true);
    assert.equal(result.articles[0].sourceId, "dazibao");
    assert.equal(result.articles[0].publishedAt, null);
    assert.equal(result.articles[0].title, "Un video di prova sulla Cina");
    assert.equal(
      result.articles[0].link,
      "https://www.youtube.com/watch?v=Sample00001",
    );
    assert.deepEqual(calls, ["https://www.youtube.com/@dazibao/videos"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("world observatory limits dates and remote destinations and reports partial failures", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const item = (id, date) =>
      `<item><title>${id}</title><link>https://example.org/${id}</link><guid>${id}</guid>${date ? `<pubDate>${date}</pubDate>` : ""}<source url="https://example.org">Fixture Publisher</source></item>`;
    return new Response(
      `<rss><channel>${item("new", new Date(Date.now() - 60000).toUTCString())}${item("old", new Date(Date.now() - 7 * 3600000).toUTCString())}${item("future", new Date(Date.now() + 3600000).toUTCString())}${item("undated", null)}</channel></rss>`,
    );
  };
  try {
    for (const area of [
      "europe",
      "north",
      "latin",
      "africa",
      "asia",
      "east",
      "mena",
      "pacific",
    ]) {
      const response = await worker.fetch(
        new Request(`http://localhost/api/pulse?area=${area}`),
        env,
        ctx,
      );
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.ok, true);
      assert.equal(data.articles.length, 1);
      assert.equal(data.articles[0].title, "new");
      assert.equal(
        data.articles[0].sourceName,
        area === "pacific" ? "Green Left" : "Fixture Publisher",
      );
    }
    assert.equal(calls.length, 15);
    assert.ok(
      calls
        .filter((url) => url.includes("news.google.com"))
        .every((url) => new URL(url).searchParams.get("q").includes("when:6h")),
    );
    const denied = await worker.fetch(
      new Request("http://localhost/api/pulse?area=https://example.net"),
      env,
      ctx,
    );
    assert.equal(denied.status, 400);
    assert.equal(calls.length, 15);
    const realNow = Date.now;
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    Date.now = () => realNow() + 180_000;
    try {
      const partial = await worker.fetch(
        new Request("http://localhost/api/pulse?area=europe"),
        env,
        ctx,
      );
      const data = await partial.json();
      assert.equal(data.ok, false);
      assert.equal(data.articles[0].title, "new");
      assert.ok(data.error);
      Date.now = () => realNow() + 360_000;
      globalThis.fetch = async (url) =>
        String(url).includes("news.google.com")
          ? new Response("Unavailable", { status: 503 })
          : new Response(
              `<rss><channel><item><title>Direct publisher fallback</title><link>https://example.org/direct</link><pubDate>${new Date(realNow()).toUTCString()}</pubDate></item></channel></rss>`,
            );
      const fallback = await worker.fetch(
        new Request("http://localhost/api/pulse?area=europe"),
        env,
        ctx,
      );
      const recovered = await fallback.json();
      assert.equal(recovered.ok, true);
      assert.ok(recovered.articles.some(article => article.sourceName === "Morning Star"));
      assert.deepEqual(
        recovered.feeds.map((feed) => feed.ok),
        [false, true],
      );
    } finally {
      Date.now = realNow;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("automatic translation rejects malformed input, preserves Unicode and never displays quota errors as translations", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const request = (body) =>
    new Request("http://localhost/api/translate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  for (const body of [
    { text: 5 },
    { text: "ciao", from: "auto", to: "en" },
    { text: "ciao", from: [], to: "en" },
  ])
    assert.equal((await worker.fetch(request(body), env, ctx)).status, 400);
  assert.equal(
    (
      await worker.fetch(
        request({ text: "x".repeat(2201), from: "it", to: "en" }),
        env,
        ctx,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("http://localhost/api/translate", {
          method: "POST",
          body: "{",
        }),
        env,
        ctx,
      )
    ).status,
    400,
  );
  const originalFetch = globalThis.fetch;
  const queries = [];
  const queryLimits = [];
  globalThis.fetch = async (url) => {
    queryLimits.push(String(url).includes("translate.googleapis.com") ? 1600 : 460);
    const q = new URL(url).searchParams.get("q");
    queries.push(q);
    return Response.json({
      responseStatus: 200,
      responseData: { translatedText: "Translated text" },
    });
  };
  try {
    const response = await worker.fetch(
      request({ text: "知识共享".repeat(100), from: "zh", to: "fr" }),
      env,
      ctx,
    );
    assert.equal(response.status, 200);
    assert.ok(queries.length > 1);
    assert.ok(
      queries.every(
        (q, index) => new TextEncoder().encode(q).length <= queryLimits[index] && !q.includes("�"),
      ),
    );
    const before = queries.length;
    await worker.fetch(
      request({ text: "知识共享".repeat(100), from: "zh", to: "fr" }),
      env,
      ctx,
    );
    assert.equal(queries.length, before);
    const sentence = "Workers share knowledge and build a collective library. "
      .repeat(15)
      .trim();
    globalThis.fetch = async (url) =>
      Response.json({
        responseStatus: 200,
        responseData: { translatedText: new URL(url).searchParams.get("q") },
      });
    const chunks = await worker.fetch(
      request({ text: sentence, from: "en", to: "fr" }),
      env,
      ctx,
    );
    assert.equal((await chunks.json()).translatedText, sentence);
    globalThis.fetch = async () =>
      Response.json({
        responseStatus: 429,
        quotaFinished: true,
        responseData: { translatedText: "QUOTA EXCEEDED" },
      });
    const quota = await worker.fetch(
      request({ text: "Fixture quota test", from: "en", to: "es" }),
      env,
      ctx,
    );
    assert.equal(quota.status, 502);
    assert.equal((await quota.json()).translatedText, undefined);
    const identity = await worker.fetch(
      request({ text: "Ancora leggibile", from: "it", to: "it" }),
      env,
      ctx,
    );
    assert.equal(identity.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("publisher homepage collection uses configured destinations, returns real placements, caches successes and reports failures without inventing charts", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(String(url));
    return new Response('<main><article class="featured-stories-tier-1"><h2><a href="/lead">Lead article</a></h2></article><aside><h2>Più letti</h2><a href="/read">Readers choice</a></aside></main>', { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  try {
    for (const id of ["https://unconfigured.example", "does-not-exist", "radar-uk-labor", "ottolina-youtube"]) {
      const response = await worker.fetch(new Request(`http://localhost/api/highlights?sourceId=${encodeURIComponent(id)}`), env, ctx);
      assert.equal(response.status, 400);
    }
    assert.equal(calls.length, 0);
    const request = () => new Request("http://localhost/api/highlights?sourceId=ottolina");
    const response = await worker.fetch(request(), env, ctx);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.highlights.filter(item => item.placement === "popular").length, 1);
    assert.equal(data.highlights[0].link, "https://ottolinatv.it/lead");
    assert.deepEqual(calls, ["https://ottolinatv.it/"]);
    await worker.fetch(request(), env, ctx);
    assert.equal(calls.length, 1);
    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    const failed = await worker.fetch(new Request("http://localhost/api/highlights?sourceId=contropiano"), env, ctx);
    const unavailable = await failed.json();
    assert.equal(unavailable.ok, false);
    assert.deepEqual(unavailable.highlights, []);
    const realNow = Date.now;
    Date.now = () => realNow() + 660_000;
    globalThis.fetch = async () => new Response('<main><h2><a href="/latest">Ordinary latest article</a></h2></main>', { headers: { "content-type": "text/html" } });
    try {
      const fresh = await (await worker.fetch(request(), env, ctx)).json();
      assert.equal(fresh.ok, true);
      assert.equal(fresh.highlights.filter(item => item.placement === "popular").length, 0);
      assert.equal(fresh.highlights[0].placement, "opening");
    } finally { Date.now = realNow; }
  } finally { globalThis.fetch = original; }
});


test("Google translation remains available when the alternate provider is in quota cooldown", async () => {
 const { default: worker } = await import("../dist/server/index.js");
 const original = globalThis.fetch;
 const calls = [];
 globalThis.fetch = async url => {
  calls.push(String(url));
  return Response.json([[["Le lavoratrici organizzano uno sciopero.", "Workers organize a strike."]], null, "en"]);
 };
 try {
  const response = await worker.fetch(new Request("http://localhost/api/translate", {
   method: "POST", headers: { "content-type": "application/json" },
   body: JSON.stringify({ text: "Workers organize a strike.", from: "en", to: "it" }),
  }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.translatedText, "Le lavoratrici organizzano uno sciopero.");
  assert.equal(data.provider, "google-web");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith("https://translate.googleapis.com/"));
 } finally { globalThis.fetch = original; }
});


test("rate-limited Google requests back off while other article translations continue through MyMemory", async () => {
 const { default: worker } = await import("../dist/server/index.js");
 const originalFetch = globalThis.fetch, realNow = Date.now;
 Date.now = () => realNow() + 120_000;
 let googleCalls = 0, alternateCalls = 0;
 globalThis.fetch = async url => {
  if (String(url).includes("translate.googleapis.com")) { googleCalls++; return new Response("Rate limit", { status: 429 }); }
  alternateCalls++; return Response.json({ responseStatus: 200, responseData: { translatedText: "Articolo tradotto" } });
 };
 try {
  for (const text of ["First independent article", "Second independent article"]) {
   const response = await worker.fetch(new Request("http://localhost/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, from: "en", to: "it" }) }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
   assert.equal(response.status, 200);
   assert.equal((await response.json()).translatedText, "Articolo tradotto");
  }
  assert.equal(googleCalls, 1); assert.equal(alternateCalls, 2);
 } finally { globalThis.fetch = originalFetch; Date.now = realNow; }
});

test("valid empty feeds remain available, cold requests own their fetch, completed copies are reused and temporary failures retain articles", async () => {
 const {default:worker}=await import("../dist/server/index.js");
 const env={ASSETS:{fetch:async()=>new Response("Not found",{status:404})}};
 const ctx={waitUntil(){},passThroughOnException(){}};
 const original=globalThis.fetch,realNow=Date.now;
 const get=id=>worker.fetch(new Request(`http://localhost/api/articles?sourceIds=${id}&limitPerSource=19`),env,ctx);
 try {
  globalThis.fetch=async()=>new Response('<rss><channel><title>Empty edition</title></channel></rss>');
  const empty=await(await get("akahata")).json();
  assert.equal(empty.statuses[0].ok,true);assert.deepEqual(empty.articles,[]);
  let calls=0;
  globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return new Response(`<rss><channel><item><title>A retained public article</title><link>https://example.org/retained</link><pubDate>${new Date(realNow()).toUTCString()}</pubDate></item></channel></rss>`)};
  const values=await Promise.all([get("consortium-news"),get("consortium-news")]);
  assert.equal(calls,2);assert.equal((await values[0].json()).articles.length,1);
  assert.equal((await(await get("consortium-news")).json()).articles.length,1);assert.equal(calls,2);
  Date.now=()=>realNow()+660_000;
  globalThis.fetch=async()=>{throw new Error("Network offline")};
  const stale=await(await get("consortium-news")).json();
  assert.equal(stale.statuses[0].ok,false);assert.equal(stale.statuses[0].stale,true);
  assert.equal(stale.articles[0].title,"A retained public article");
 } finally {globalThis.fetch=original;Date.now=realNow;}
});

test("a failed Google edition backs off related searches while native Japanese publisher feeds remain available", async () => {
 const {default:worker}=await import("../dist/server/index.js");
 const env={ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},ctx={waitUntil(){},passThroughOnException(){}};
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response("Provider unavailable",{status:503})};
 try {
  for(const id of ["radar-jp-core","radar-jp-labor"]){
   const response=await worker.fetch(new Request(`http://localhost/api/articles?sourceIds=${id}&limitPerSource=18`),env,ctx);
   assert.equal((await response.json()).statuses[0].ok,false);
  }
  assert.equal(calls,1);
  globalThis.fetch=async()=>new Response('<rdf:RDF><item><title>労働者と平和</title><link>https://www.jcp.or.jp/akahata/article</link><dc:date>2026-10-18T10:00:00+09:00</dc:date></item></rdf:RDF>');
  const direct=await(await worker.fetch(new Request("http://localhost/api/articles?sourceIds=akahata&limitPerSource=18"),env,ctx)).json();
  assert.equal(direct.statuses[0].ok,true);assert.equal(direct.articles[0].country,"Giappone");
  assert.equal(direct.articles[0].language,"ja");
 } finally {globalThis.fetch=original;}
});

test("article cards receive publisher-sized responsive photos and image thumbnails rather than video URLs or lazy placeholders", async () => {
 const {default:worker}=await import("../dist/server/index.js");
 const originalFetch=globalThis.fetch;
 const bodies=[
  '<media:content url="https://images.example/video.mp4" type="video/mp4"/><media:thumbnail url="https://images.example/thumb.jpg" width="480"/>',
  '<description>&lt;img src="https://images.example/full.jpg" srcset="https://images.example/320.jpg 320w, https://images.example/640.jpg 640w, https://images.example/1600.jpg 1600w"&gt;</description>',
  '<media:content url="https://images.example/only-video.mp4" type="video/mp4"/>',
  '<description><![CDATA[<img src="data:image/gif;base64,AAAA" data-src="https://images.example/real.jpg">]]></description>',
  '<enclosure url="https://images.example/photo.jpg" type="image/jpeg"/>',
 ];
 globalThis.fetch=async()=>new Response(`<rss><channel>${bodies.map((body,i)=>`<item><title>Photo fixture ${i}</title><link>https://example.org/photo-${i}</link>${body}</item>`).join("")}</channel></rss>`,{headers:{"content-type":"application/rss+xml"}});
 try {
  const response=await worker.fetch(new Request("http://localhost/api/articles?sourceIds=contropiano&limitPerSource=219"),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
  const payload=await response.json();
  const images=new Map(payload.articles.map(article=>[article.title,article.image]));
  assert.equal(images.get("Photo fixture 0"),"https://images.example/thumb.jpg");
  assert.equal(images.get("Photo fixture 1"),"https://images.example/640.jpg");
  assert.equal(images.get("Photo fixture 2"),null);
  assert.equal(images.get("Photo fixture 3"),"https://images.example/real.jpg");
  assert.equal(images.get("Photo fixture 4"),"https://images.example/photo.jpg");
 } finally {globalThis.fetch=originalFetch;}
});

test('news controls start in one closed banner below a manually scrollable video carousel',async()=>{
 const html=await(await render()).text();
 const banner=html.match(/<details class="reading-controls-banner"[^>]*>/)?.[0];assert.ok(banner);assert.doesNotMatch(banner,/\bopen(?:=|\s|>)/);
 const headerEnd=html.indexOf('</header>'),carousel=html.indexOf('class="video-carousel"'),controls=html.indexOf('class="reading-controls-banner"');
 assert.ok(headerEnd<carousel&&carousel<controls);
 assert.match(html,/class="video-track"[^>]*tabindex="0"/i);assert.match(html,/Esplora i canali/);
 assert.match(html,/POLIVOX/);assert.match(html,/Dazibao/);assert.match(html,/OttolinaTV/);assert.match(html,/PeerTube/);
 assert.doesNotMatch(html,/<iframe[^>]*youtube|autoplay/i);
 const firstControls=html.slice(controls,html.indexOf('class="news-layout"'));
 for(const label of ['Lingua di lettura','Lingua delle fonti in analisi','Ordina le notizie','Ultimo ciclo di raccolta'])assert.match(firstControls,new RegExp(label));
});
