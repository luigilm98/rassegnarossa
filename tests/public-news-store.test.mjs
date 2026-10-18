import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createPublicNewsStore } from "../app/lib/public-news-store.ts";
import { publicDataKey, publicDataResponse } from "../app/lib/public-data-cache.ts";

async function setup() {
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(await readFile(new URL("../drizzle/0001_unknown_loa.sql",import.meta.url),"utf8"));
 const db={prepare(sql){const statement=sqlite.prepare(sql);return {bind(...values){return {first:async()=>statement.get(...values)??null,run:async()=>statement.run(...values)};}};}};
 return {sqlite,db};
}
const request=()=>new Request("https://news.example/api/articles?sourceIds=contropiano&limitPerSource=24");

test("public news survives process/store recreation without another publisher request and expired rows are not served",async()=>{
 const {sqlite,db}=await setup();let now=1000,calls=0;
 try {
  const options={clock:()=>now,waitUntil:()=>{},load:async()=>{calls++;return Response.json({articles:[{title:"Public news"}],generatedAt:"original"},{headers:{"cache-control":"public, max-age=120"}});}};
  await publicDataResponse(request(),{...options,cache:createPublicNewsStore(db,new Set(["contropiano"]),()=>now)});
  const cached=await publicDataResponse(request(),{...options,cache:createPublicNewsStore(db,new Set(["contropiano"]),()=>now)});
  assert.equal(calls,1);assert.equal(cached.headers.get("x-rassegna-cache"),"hit");
  assert.equal((await cached.json()).generatedAt,"original");
  now+=600001;
  assert.equal(await createPublicNewsStore(db,new Set(["contropiano"]),()=>now).match(publicDataKey(request())),undefined);
 }finally{sqlite.close();}
});

test("persistent cache has finite catalogue keys, refuses account/unknown/combined queries and bounds payload size",async()=>{
 const {sqlite,db}=await setup();const store=createPublicNewsStore(db,new Set(["contropiano"]));
 try {
  for(const path of ["/api/bookmarks","/api/articles?sourceIds=unknown&limitPerSource=24","/api/articles?sourceIds=contropiano,unknown&limitPerSource=24","/api/articles?sourceIds=contropiano&limitPerSource=25","/api/articles?sourceIds=contropiano&limitPerSource=24&random=extra","/api/pulse?area=unknown"])
   await store.put(new Request(`https://news.example${path}`),Response.json({value:"ignored"}));
  await store.put(publicDataKey(request()),new Response("x".repeat(512001)));
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM public_news_cache").get().count,0);
  await store.put(publicDataKey(request()),Response.json({value:"accepted"}));
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM public_news_cache").get().count,1);
  assert.equal(createPublicNewsStore(undefined,new Set()),undefined);
 }finally{sqlite.close();}
});

test("deployed Worker routes public feed reads through the persistent cache without involving account data",async()=>{
 const {sqlite,db}=await setup();const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('<rss><channel><item><title>Shared public headline</title><link>https://example.org/public-one</link><description>Public feed excerpt</description></item></channel></rss>',{headers:{"content-type":"application/rss+xml"}});};
 try{
  const {default:worker}=await import("../dist/server/index.js");
  const env={DB:db,ASSETS:{fetch:async()=>new Response("Not found",{status:404})}};
  const ctx={waitUntil(){},passThroughOnException(){}};
  const first=await worker.fetch(request(),env,ctx);
  assert.equal(first.status,200);
  assert.equal((await first.json()).articles[0].title,"Shared public headline");
  const second=await worker.fetch(request(),env,ctx);
  assert.equal(second.headers.get("x-rassegna-cache"),"hit");
  assert.equal((await second.json()).articles[0].title,"Shared public headline");
  assert.equal(calls,1);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM public_news_cache").get().count,1);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
