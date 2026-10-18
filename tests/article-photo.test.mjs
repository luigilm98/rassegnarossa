import test from "node:test";
import assert from "node:assert/strict";
import { publicPhotoUrl, readLimited, articleMetadataImages, fetchPublicPhotoResource } from "../app/lib/article-photo.ts";

test("photo metadata recovery rejects local destinations, credentials and unsafe schemes, including redirects",async()=>{
 for(const value of ["http://127.0.0.1/a","https://[::1]/a","https://localhost/a","https://localhost./a","https://a.internal/a","https://0x7f000001/a","https://user:pass@publisher.org/a","file:///etc/passwd","https://publisher.org:444/a"])
  assert.equal(publicPhotoUrl(value),null,value);
 assert.equal(publicPhotoUrl("http://images.example.org/a.jpg").href,"https://images.example.org/a.jpg");
 let calls=0;
 await assert.rejects(fetchPublicPhotoResource(new URL("https://publisher.example.org/a"),new AbortController().signal,{},async()=>{calls++;return new Response(null,{status:302,headers:{location:"http://127.0.0.1/private"}});}));
 assert.equal(calls,1);
 const urls=articleMetadataImages('<meta content="https://cdn.example.org/photo.jpg?a=1&amp;b=2" property="og:image"><meta name="twitter:image" content="https://cdn.example.org/logo.jpg"><meta property="og:image" content="http://127.0.0.1/secret">',"https://publisher.example.org/article");
 assert.deepEqual(urls,["https://cdn.example.org/photo.jpg?a=1&b=2"]);
});

test("metadata HTML reads can stop at a safe prefix while image downloads reject oversized bodies",async()=>{
 assert.equal((await readLimited(new Response("a".repeat(100)),10,true)).byteLength,10);
 await assert.rejects(readLimited(new Response("a".repeat(100)),10));
 await assert.rejects(readLimited(new Response("small",{headers:{"content-length":"5000000"}}),4000000));
});

test("article API includes its photo and the same-origin endpoint delivers actual image bytes, including article-only metadata and coalesced requests",async()=>{
 const {default:worker}=await import("../dist/server/index.js");
 const originalFetch=globalThis.fetch; const calls=[];
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS0AAAAASUVORK5CYII=","base64");
 globalThis.fetch=async raw=>{
  const url=String(raw);calls.push(url);
  if(url==="https://ilmanifesto.it/feed") return new Response('<rss><channel><item><title>Homepage photo</title><link>https://ilmanifesto.it/fixture-story</link></item><item><title>Article-only photo</title><link>https://ilmanifesto.it/fixture-story-two</link></item></channel></rss>');
  if(url==="https://ilmanifesto.it/") return new Response('<article><a href="/fixture-story"><img src="https://images.example.org/first.png"></a></article>',{headers:{"content-type":"text/html"}});
  if(url==="https://ilmanifesto.it/fixture-story-two") return new Response('<meta property="og:image" content="https://images.example.org/second.png">'+" ".repeat(310000),{headers:{"content-type":"text/html"}});
  if(/^https:\/\/images\.example\.org\/(first|second)\.png$/.test(url)) return new Response(png,{headers:{"content-type":"image/png"}});
  assert.fail(`Unexpected destination: ${url}`);
 };
 const env={ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},ctx={waitUntil(){},passThroughOnException(){}};
 const call=path=>worker.fetch(new Request(`http://localhost${path}`),env,ctx);
 try{
  const result=await(await call("/api/articles?sourceIds=il-manifesto&limitPerSource=24&includeImages=1")).json();
  const first=result.articles.find(article=>article.title==="Homepage photo"),second=result.articles.find(article=>article.title==="Article-only photo");
  assert.equal(first.image,"https://images.example.org/first.png");
  const path=id=>`/api/article-image?sourceId=il-manifesto&articleId=${id}`;
  const direct=await call(path(first.id));
  assert.equal(direct.status,200);assert.equal(direct.headers.get("content-type"),"image/png");
  assert.deepEqual(Buffer.from(await direct.arrayBuffer()),png);
  const [left,right]=await Promise.all([call(path(second.id)),call(path(second.id))]);
  assert.equal(left.status,200);assert.deepEqual(Buffer.from(await left.arrayBuffer()),png);assert.deepEqual(Buffer.from(await right.arrayBuffer()),png);
  assert.equal(calls.filter(url=>url==="https://ilmanifesto.it/fixture-story-two").length,1);
  const before=calls.length;assert.equal((await call(path(first.id))).status,200);assert.equal(calls.length,before);
  assert.equal((await call(path("unknown"))).status,404);
  const legacy=await call(path("legacy-local-card")+"&articleLink="+encodeURIComponent("https://ilmanifesto.it/fixture-story-two"));
  assert.equal(legacy.status,200);assert.deepEqual(Buffer.from(await legacy.arrayBuffer()),png);
  const beforeUnsafe=calls.length;
  for(const link of ["https://evil.example.org/story","https://127.0.0.1/story","https://ilmanifesto.it.evil.example.org/story","https://user:secret@ilmanifesto.it/story","https://ilmanifesto.it/"])
   assert.equal((await call(path("bad-link")+"&articleLink="+encodeURIComponent(link))).status,400);
  assert.equal(calls.length,beforeUnsafe);
  assert.equal((await call(path("bad-link")+"&articleLink=https://ilmanifesto.it/one&articleLink=https://ilmanifesto.it/two")).status,400);
  assert.equal((await call(path(first.id)+"&url=http://127.0.0.1/private")).status,400);
 }finally{globalThis.fetch=originalFetch;}
});
