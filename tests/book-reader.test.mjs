import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { readerText, parseReaderPage, readerChapters, paginateBook, sectionReaderBook, decodeBookHtml } from "../app/lib/book-text.ts";
import { readerDestination } from "../app/lib/book-navigation.ts";

test("reader navigation crosses chapter boundaries in both directions without skipping preceding pages",()=>{
 assert.deepEqual(readerDestination(1,0,4,3,-1),{chapter:0,page:-1});
 assert.deepEqual(readerDestination(1,3,4,3,1),{chapter:2,page:0});
 assert.deepEqual(readerDestination(1,2,4,3,-1),{chapter:1,page:1});
 assert.equal(readerDestination(0,0,4,3,-1),null);
 assert.equal(readerDestination(2,3,4,3,1),null);
});

test("book text decodes complete HTML entities in Italian and other editions without activating encoded markup",()=>{
 const blocks=parseReaderPage('<h1>Prefazione all&rsquo;edizione tedesca</h1><p>La Lega incaric&ograve; i sottoscritti. Cos&igrave; nacque il Manifesto, che part&igrave; per Londra. &Egrave; gi&agrave; qui.</p>');
 assert.equal(blocks[1].text,'La Lega incaricò i sottoscritti. Così nacque il Manifesto, che partì per Londra. È già qui.');
 assert.equal(readerText('&OElig;uvre &Auml;nderung &Scaron; &lstrok; &Alpha; &NotEqualTilde; &frac12;'),'Œuvre Änderung Š ł Α ≂̸ ½');
 assert.equal(readerText('&#242; &#x1F91D; &#0; &#xD800;'),'ò 🤝 � �');
 assert.equal(readerText('&lt;img src=x onerror=alert(1)&gt; &amp;ograve; &unknown;'),'<img src=x onerror=alert(1)> &ograve; &unknown;');
 assert.equal(readerText('&constructor; &toString;'),'&constructor; &toString;');
 const toc=readerChapters('<a href="one.htm">Cooperazione &amp; libert&agrave;</a>','https://www.marxists.org/test/index.htm');
 assert.equal(toc[0].title,'Cooperazione & libertà');
});

async function setup(){
 const sqlite=new DatabaseSync(":memory:");
 for(const file of ["0000_careful_mole_man.sql","0001_unknown_loa.sql","0002_stormy_elektra.sql"])sqlite.exec(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
 const db={prepare(sql){const s=sqlite.prepare(sql);const bound=v=>({bind:(...next)=>bound(next),all:async()=>({results:s.all(...v)}),first:async()=>s.get(...v)??null,run:async()=>s.run(...v)});return bound([]);},async batch(statements){sqlite.exec("BEGIN");try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec("COMMIT");return out;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
 const {default:worker}=await import("../dist/server/index.js");
 const call=(path,user="alice",body,headers={})=>worker.fetch(new Request(`https://news.example${path}`,{method:body===undefined?"GET":"POST",headers:{...(user?{"oai-authenticated-user-id":user}:{}),...(body===undefined?{}:{"content-type":"application/json",origin:"https://news.example"}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:db,ASSETS:{fetch:async()=>new Response(null,{status:404})}},{waitUntil(){},passThroughOnException(){}});
 return{sqlite,call};
}
const point={bookId:"manifesto",edition:"it",chapter:1,page:3,scroll:4200,revision:"a".repeat(64)};

test("reader text is inert, paginated without omissions and its chapter list cannot escape the selected edition",()=>{
 const blocks=parseReaderPage('<!DOCTYPE html><html><head><title>Hidden</title></head><nav>Navigation</nav><script>alert(1)</script><h1>Cooperare</h1><p>Un <em>mondo</em> &amp; una comunità.</p><p>&lt;script&gt;inert&lt;/script&gt;</p><footer>Footer</footer></html>');
 assert.deepEqual(blocks,[{type:"h2",text:"Cooperare"},{type:"p",text:"Un mondo & una comunità."},{type:"p",text:"<script>inert</script>"}]);
 const pages=paginateBook([{type:"p",text:"parola ".repeat(2000).trim()}],3200);
 assert.ok(pages.length>3);assert.equal(pages.flat().map(b=>b.text).join(" "),"parola ".repeat(2000).trim());
 const chapters=readerChapters('<title>Book</title><a href="one.htm">Uno</a><a href="two.htm">Due</a><a href="../outside.htm">No</a><a href="https://127.0.0.1/a.htm">No</a><a href="one.htm#note">Duplicato</a>','https://www.marxists.org/test/book/index.htm');
 assert.deepEqual(chapters.map(c=>c.title),["Uno","Due"]);
 const toc=readerChapters('<title>Sommaire</title><a href="part-a.htm">I</a><a href="part-b.htm">II</a><a href="part-c.htm">III</a>','https://www.marxists.org/test/book/written-toc-name.htm');
 assert.equal(toc.length,3);
 const full=[{type:"p",text:"Preambolo"},...["Uno","Due","Tre"].flatMap(text=>[{type:"h2",text},{type:"p",text:"Un paragrafo completo. ".repeat(400)}])];
 assert.deepEqual(sectionReaderBook(full).flat(),full);assert.equal(sectionReaderBook(full).length,4);
});

test("reading progress requires login, restores in a fresh client, separates accounts and keeps editions independent",async()=>{
 const {sqlite,call}=await setup();try{
  assert.equal((await call('/api/reading-progress',null)).status,401);
  assert.equal((await call('/api/library/read?bookId=manifesto&edition=it',null)).status,401);
  const scope=(await(await call('/api/reading-progress','alice')).json()).scope;
  assert.equal((await call('/api/reading-progress','alice',{...point,scope})).status,200);
  assert.equal((await call('/api/reading-progress','bob',{...point,scope})).status,409);
  assert.equal((await call('/api/reading-progress','bob',{...point,page:8})).status,200);
  const a=await(await call('/api/reading-progress?bookId=manifesto&edition=it')).json();
  const b=await(await call('/api/reading-progress?bookId=manifesto&edition=it','bob')).json();
  assert.equal(a.items[0].page,3);assert.equal(a.items[0].scroll,4200);assert.equal(b.items[0].page,8);
  assert.equal((await(await call('/api/reading-progress?bookId=manifesto&edition=en')).json()).items.length,0);
  assert.equal((await call('/api/reading-progress')).headers.get('cache-control'),'private, no-store');
  const saved=await(await call('/api/bookmarks')).json();assert.ok(saved.items.some(item=>item.kind==='book'&&item.key==='manifesto'));
 }finally{sqlite.close();}
});

test("invalid and cross-site progress cannot mutate the private archive; older pending updates cannot replace a newer position",async()=>{
 const {sqlite,call}=await setup();try{
  for(const p of [{...point,bookId:'unknown'},{...point,edition:'unknown'},{...point,page:-1},{...point,scroll:10001},{...point,chapter:300},{...point,revision:'bad'}])assert.equal((await call('/api/reading-progress','alice',p)).status,400);
  assert.equal((await call('/api/reading-progress','alice',point,{origin:'https://evil.example'})).status,403);
  const stamp=Date.now()-1000;
  await call('/api/reading-progress','alice',{...point,page:8,clientAt:stamp});
  await call('/api/reading-progress','alice',{...point,page:1,clientAt:stamp-1000});
  assert.equal((await(await call('/api/reading-progress')).json()).items[0].page,8);
 }finally{sqlite.close();}
});

test("authenticated native reader loads a real edition chapter as text, rejects arbitrary URLs and reports missing chapters",async()=>{
 const {sqlite,call}=await setup(),original=globalThis.fetch;let fetches=0;
 globalThis.fetch=async raw=>{fetches++;const url=String(raw);if(url.endsWith('/1848/manifesto/index.htm'))return new Response('<title>Manifesto</title><a href="one.htm">Capitolo uno</a>',{headers:{'content-type':'text/html;charset=utf-8'}});
 if(url.endsWith('/1848/manifesto/one.htm'))return new Response('<h1>Manifesto</h1><p>Cos&igrave; il testo part&igrave;: incaric&ograve; la comunit&agrave;.</p><script>not executable</script>',{headers:{'content-type':'text/html'}});
 throw Error('Unexpected URL '+url);
 };
 try{
  const r=await call('/api/library/read?bookId=manifesto&edition=it&chapter=0');assert.equal(r.status,200);const j=await r.json();
  assert.equal(j.pages[0][1].text,'Così il testo partì: incaricò la comunità.');assert.equal(j.revision.length,64);assert.equal(j.language,'it');
  const before=fetches;
  assert.equal((await call('/api/library/read?bookId=manifesto&edition=it&url=https://127.0.0.1/')).status,400);
  assert.equal((await call('/api/library/read?bookId=unknown&edition=it')).status,400);
  assert.equal(fetches,before);
  assert.equal((await call('/api/library/read?bookId=manifesto&edition=it&chapter=99')).status,400);
 }finally{globalThis.fetch=original;sqlite.close();}
});

 test("legacy European encodings preserve accents while valid UTF-8 and explicit charset declarations remain intact",()=>{
 const legacy=new Uint8Array([...Buffer.from("<p>mat"),0xe9,...Buffer.from("rialisme</p>")]);
 assert.equal(decodeBookHtml(legacy,"text/html","fr"),"<p>matérialisme</p>");
 assert.equal(decodeBookHtml(new TextEncoder().encode("solidarité · współpraca · 合作"),"text/html","fr"),"solidarité · współpraca · 合作");
 const declared=new Uint8Array([...Buffer.from('<meta charset="windows-1252"><p>caf'),0xe9,...Buffer.from('</p>')]);
 assert.match(decodeBookHtml(declared,"text/html; charset=utf-8","en"),/café/);
 });
