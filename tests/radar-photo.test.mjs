import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source=(await readFile(new URL('../app/lib/radar-link.ts',import.meta.url),'utf8')).replace('"./article-photo"',JSON.stringify(new URL('../app/lib/article-photo.ts',import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {resolveRadarLink,resolvePublisherHeadline}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test("radar recovery decodes legacy links without a request and confines modern decoded destinations to the publisher observed in the feed",async()=>{
 const publisher='https://publisher.example.org/';const target=publisher+'story';
 const old='https://news.google.com/rss/articles/'+Buffer.from('\x08\x13\x22'+String.fromCharCode(target.length)+target+'\xd2\x01\x00','latin1').toString('base64url');
 assert.equal(await resolveRadarLink(old,publisher,new AbortController().signal,async()=>{throw Error('Not needed');}),target);
 const opaque='https://news.google.com/rss/articles/opaque-current-fixture';let calls=0;
 const fetcher=async(url,options)=>{calls++;if(url.includes('/rss/articles/'))return new Response('<div data-n-a-sg="signature" data-n-a-ts="1792000000"></div>');
  assert.match(options.headers['content-type'],/application\/x-www-form-urlencoded/);
  return new Response(")]}'\n\n"+JSON.stringify([["wrb.fr","Fbv4je",JSON.stringify(["garturlres",target])]]));};
 assert.equal(await resolveRadarLink(opaque,publisher,new AbortController().signal,fetcher),target);assert.equal(calls,2);
 const evil=async url=>url.includes('/rss/articles/')?new Response('<div data-n-a-sg="s" data-n-a-ts="1792000000"></div>'):new Response(")]}'\n\n"+JSON.stringify([["wrb.fr","Fbv4je",JSON.stringify(["garturlres","https://127.0.0.1/private"])]]));
 assert.equal(await resolveRadarLink('https://news.google.com/rss/articles/opaque-other-fixture',publisher,new AbortController().signal,evil),null);
 assert.equal(await resolveRadarLink('https://other.example.org/story',publisher,new AbortController().signal,fetcher),null);
});

test("consent pages, quotas and unsupported Google links fail without inventing a photo or bypassing the block",async()=>{
 for(const response of [new Response('Consent required'),new Response(null,{status:302,headers:{location:'https://www.google.com/sorry/'}}),new Response(null,{status:429})]){
  let calls=0;assert.equal(await resolveRadarLink('https://news.google.com/rss/articles/test-blocked-fixture','https://publisher.example.org/',new AbortController().signal,async()=>{calls++;return response;}),null);assert.equal(calls,1);
 }
});

 test("a headline recovery uses only an exact match on the observed publisher and rejects lookalike external hosts",async()=>{
 const title="Pudong Trade Union Night School: Lighting up skills";
 const html=`<a href="https://publisher.example.org.evil.example/story">${title}</a><a href="/unrelated">Other news</a><a href="/real-story">${title}</a>`;
 assert.equal(await resolvePublisherHeadline(title,"https://publisher.example.org/",new AbortController().signal,async()=>new Response(html,{headers:{"content-type":"text/html"}})),"https://publisher.example.org/real-story");
 });

test("a radar card retains its configured feed provenance and delivers its publisher photo through the same endpoint",async()=>{
 const {DatabaseSync}=await import('node:sqlite');const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(await readFile(new URL('../drizzle/0001_unknown_loa.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const statement=sqlite.prepare(sql);return{bind(...values){return{first:async()=>statement.get(...values)??null,run:async()=>statement.run(...values)}}}}};
 const {createArticlePhotoStore}=await import('../app/lib/public-news-store.ts');
 const target='https://publisher.example.org/real-story';
 const link='https://news.google.com/rss/articles/'+Buffer.from('\x08\x13\x22'+String.fromCharCode(target.length)+target+'\xd2\x01\x00','latin1').toString('base64url');
 const article={id:'radar-photo-fixture',sourceId:'radar:abcdef',feedSourceId:'radar-cn-labor',sourceHomepage:'https://publisher.example.org/',title:'A cooperative headline from the observed publisher',link,image:null};
 await createArticlePhotoStore(db,new Set(['radar-cn-labor'])).remember('radar-cn-labor',[article]);
 assert.equal((await createArticlePhotoStore(db,new Set(['radar-cn-labor'])).find('radar:abcdef',article.id)).title,article.title);
 const original=globalThis.fetch;let requests=0;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS0AAAAASUVORK5CYII=','base64');
 globalThis.fetch=async raw=>{requests++;const url=String(raw);
  if(url==='https://publisher.example.org/')return new Response('<html></html>',{headers:{'content-type':'text/html'}});
  if(url===target)return new Response('<meta property="og:image" content="https://images.example.org/radar.png">',{headers:{'content-type':'text/html'}});
  if(url==='https://images.example.org/radar.png')return new Response(png,{headers:{'content-type':'image/png'}});
  throw Error('Unexpected destination '+url);
 };
 try{
  const {default:worker}=await import('../dist/server/index.js');
  const call=(sourceId,id=article.id,articleLink=link)=>worker.fetch(new Request('https://news.example/api/article-image?'+new URLSearchParams({sourceId,articleId:id,articleLink})),{DB:db,ASSETS:{fetch:async()=>new Response(null,{status:404})}},{waitUntil(){},passThroughOnException(){}});
  const result=await call('radar-cn-labor');assert.equal(result.status,200);assert.deepEqual(Buffer.from(await result.arrayBuffer()),png);
  const old=await call('radar:abcdef');assert.equal(old.status,200);
  const count=requests;
  assert.equal((await call('radar-cn-labor',article.id,'https://unverified.example.org/story')).status,400);
  assert.equal((await call('radar:unknown','invented-id','https://unverified.example.org/story')).status,404);
  assert.equal(requests,count);
 }finally{globalThis.fetch=original;sqlite.close();}
});

test("the publisher RSS can recover an exact older headline without relying on Google",async()=>{
 const title='A cooperative society beyond a capitalist economy';const calls=[];
 const result=await resolvePublisherHeadline(title,'https://publisher.example.org/',new AbortController().signal,async url=>{calls.push(url);
  if(url==='https://publisher.example.org/')return new Response('<link rel="alternate" type="application/rss+xml" href="/feed">',{headers:{'content-type':'text/html'}});
  if(url==='https://publisher.example.org/feed')return new Response(`<rss><channel><item><title><![CDATA[${title}]]></title><link>https://publisher.example.org/older-story</link></item></channel></rss>`);
  throw Error('Unexpected destination');});
 assert.equal(result,'https://publisher.example.org/older-story');assert.equal(calls.length,2);
});
