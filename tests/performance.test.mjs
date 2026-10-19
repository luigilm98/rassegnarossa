import test from "node:test";
import assert from "node:assert/strict";
import { createBatchedSink } from "../app/lib/batched-sink.ts";
import { createAvailabilityCircuit } from "../app/lib/availability-circuit.ts";
import { publicDataKey, publicDataResponse } from "../app/lib/public-data-cache.ts";

test("a full catalogue burst publishes the first result immediately and merges every remaining update without loss", () => {
 const updates = [];
 const sink = createBatchedSink(batch => updates.push(batch), 1000);
 for (let i=0;i<266;i++) sink.push(i);
 assert.deepEqual(updates, [[0]]);
 sink.flush();
 assert.equal(updates.length, 2);
 assert.deepEqual(updates.flat(), Array.from({length:266}, (_,i)=>i));
 sink.push(999); sink.clear(); sink.flush();
 assert.equal(updates.length, 2);
});

test("isolated translation failures do not block work, repeated complete failures pause only that pair and recovery resets it", () => {
 let now = 1;
 const health = createAvailabilityCircuit(3, 30000, () => now);
 health.failure("en:it"); assert.equal(health.blocked("en:it"), false);
 health.success("en:it");
 health.failure("en:it"); health.failure("en:it");
 assert.equal(health.blocked("en:it"), false);
 health.failure("en:it");
 assert.equal(health.blocked("en:it"), true);
 assert.equal(health.blocked("fr:it"), false);
 health.failure("en:it"); // A skipped task does not extend the cooldown.
 now += 30001;
 assert.equal(health.blocked("en:it"), false);
 health.success("en:it"); health.failure("en:it");
 assert.equal(health.blocked("en:it"), false);
 health.clear(); assert.equal(health.blocked("en:it"), false);
});

const news = () => Response.json({articles:[{title:"Real feed headline"}],generatedAt:"original"}, {headers:{"cache-control":"public, max-age=120"}});
const fakeCache = () => {
 const values = new Map();
 return { match: async key => values.get(key.url)?.clone(), put: async (key,response) => {values.set(key.url,response.clone());} };
};
const request = (path="/api/articles?sourceIds=b,a&limitPerSource=24") => new Request(`https://news.example${path}`);

test("public cache canonicalizes requests and never accepts account endpoints, POSTs or unknown/duplicate query parameters", () => {
 assert.equal(publicDataKey(request()).url, publicDataKey(request("/api/articles?limitPerSource=24&sourceIds=a,b,a")).url);
 assert.equal(publicDataKey(request("/api/bookmarks")), null);
 assert.equal(publicDataKey(request("/api/articles?userId=someone")), null);
 assert.equal(publicDataKey(request("/api/articles?sourceIds=a&sourceIds=b")), null);
 assert.equal(publicDataKey(new Request("https://news.example/api/translate", {method:"POST",body:"private"})), null);
});

test("fresh news returns without fetching, stale news returns while one background refresh runs and original dates remain intact", async () => {
 const cache = fakeCache(); let now=1000, calls=0; const tasks=[];
 let finish;
 const options={cache,clock:()=>now,waitUntil:p=>tasks.push(p),load:async()=>{calls++;return news();}};
 await publicDataResponse(request(), options);
 assert.equal(calls,1);
 const fresh=await publicDataResponse(request(), options);
 assert.equal(fresh.headers.get("x-rassegna-cache"),"hit"); assert.equal(calls,1);
 now += 120001;
 options.load=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const stale1=await publicDataResponse(request(), options);
 const stale2=await publicDataResponse(request(), options);
 assert.equal(stale1.headers.get("x-rassegna-cache"),"stale");
 assert.equal(stale2.headers.get("x-rassegna-cache"),"stale");
 assert.equal((await stale1.json()).generatedAt,"original");
 assert.equal(calls,2);
 finish(news()); await Promise.all(tasks);
 assert.equal((await publicDataResponse(request(), options)).headers.get("x-rassegna-cache"),"hit");
});

test("public cache failures fall back to the endpoint; private, failed and no-store responses never get stored", async () => {
 let writes=0;
 const cache={match:async()=>{throw new Error("Cache unavailable");},put:async()=>{writes++;}};
 const pending=[];
 for(const response of [Response.json({error:"Offline"},{status:503}), Response.json({items:[]},{headers:{"cache-control":"private, no-store"}}),Response.json({data:"cookie"},{headers:{"cache-control":"public, max-age=120","set-cookie":"session=example"}})]) {
  const actual=await publicDataResponse(request(),{cache,waitUntil:p=>pending.push(p),load:async()=>response});
  assert.equal(actual.status,response.status);
 }
 assert.equal(writes,0);
 const response=await publicDataResponse(request(),{cache:{match:async()=>undefined,put:async()=>{throw new Error("Disk full");}},waitUntil:()=>{},load:async()=>news()});
 assert.equal(response.status,200);
});

test("expired public data requires a new fetch and a failed stale refresh preserves the last good cache", async () => {
 const cache=fakeCache(); let now=1000, calls=0;const tasks=[];
 const options={cache,clock:()=>now,waitUntil:p=>tasks.push(p),load:async()=>{calls++;return news();}};
 await publicDataResponse(request(),options);
 now+=120001;
 options.load=async()=>{calls++;return Response.json({error:"Offline"},{status:503,headers:{"cache-control":"no-store"}});};
 const stale=await publicDataResponse(request(),options);
 assert.equal((await stale.json()).generatedAt,"original");
 await Promise.all(tasks);
 now+=600001;
 const expired=await publicDataResponse(request(),options);
 assert.equal(expired.status,503);
 assert.equal(expired.headers.has("x-rassegna-cache"),false);
 assert.equal(calls,3);
});

test("cold public requests own their I/O: a stalled caller cannot hold another caller's response", {timeout:1000}, async()=>{
 const cache=fakeCache();let release;let calls=0;
 const first=publicDataResponse(request('/api/articles?sourceIds=isolated-request&limitPerSource=24'),{cache,waitUntil(){},load:()=>{calls++;return new Promise(resolve=>{release=resolve;});}});
 await new Promise(resolve=>setImmediate(resolve));
 const second=await publicDataResponse(request('/api/articles?sourceIds=isolated-request&limitPerSource=24'),{cache,waitUntil(){},load:async()=>{calls++;return news();}});
 assert.equal(second.status,200);assert.equal(calls,2);
 release(news());assert.equal((await first).status,200);
});

test("unchanged network snapshots retain article identities and avoid repeating image enrichment",async()=>{
 const {mergeArticles}=await import('../app/lib/reading.ts');
 const {applySourceImages}=await import('../app/lib/source-highlights.ts');
 const card={id:'one',title:'Cooperazione',link:'https://example.org/story',publishedAt:null,score:1,image:null,categories:['lavoro'],topics:['cooperazione']};
 const first=mergeArticles([],[card]);
 assert.equal(mergeArticles(first,JSON.parse(JSON.stringify([card]))),first);
 assert.equal(applySourceImages(first,[]),first);
 assert.equal(applySourceImages(first,[{link:'https://other.example/story',image:'https://other.example/photo.jpg'}]),first);
 const changed=mergeArticles(first,[{...card,title:'Aggiornato'}]);assert.notEqual(changed,first);assert.equal(changed[0].title,'Aggiornato');
 const pictured=applySourceImages(first,[{link:card.link,image:'https://example.org/photo.jpg'}]);assert.notEqual(pictured,first);assert.equal(pictured[0].image,'https://example.org/photo.jpg');
});

test("completed server caches enforce both byte and entry budgets without retaining oversized values",async()=>{
 const {createBoundedCache}=await import('../app/lib/bounded-cache.ts');
 const cache=createBoundedCache(2,6,value=>value.length);
 cache.set('one','aaa');cache.set('two','bb');cache.set('three','cc');
 assert.equal(cache.get('one'),undefined);assert.equal(cache.get('two'),'bb');
 cache.set('two','dddd');assert.equal(cache.get('two'),'dddd');assert.equal(cache.get('three'),'cc');
 cache.set('large','too large');assert.equal(cache.get('large'),undefined);
 cache.set('new','ee');assert.equal(cache.get('three'),undefined);assert.equal(cache.get('two'),'dddd');
});

test("the news startup dependency graph leaves the complete book catalogue in an on-demand chunk", async()=>{
 const {readFile}=await import('node:fs/promises');
 const manifest=JSON.parse(await readFile(new URL('../dist/client/.vite/manifest.json',import.meta.url),'utf8'));
 const visited=new Set();
 function visit(key){if(visited.has(key))return;visited.add(key);for(const imported of manifest[key]?.imports??[])visit(imported);}
 visit('app/components/AggregatorApp.tsx');
 const startup=await Promise.all([...visited].filter(key=>manifest[key]?.file).map(key=>readFile(new URL('../dist/client/'+manifest[key].file,import.meta.url),'utf8')));
 assert.ok(startup.every(code=>!code.includes('selected-works/volume-5/mswv5_58.htm')),'The full library must not download with news');
 assert.ok(manifest['app/components/AggregatorApp.tsx'].dynamicImports.includes('app/components/LibraryView.tsx'));
});
