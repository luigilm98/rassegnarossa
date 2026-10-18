import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const article = { id: "saved-one", sourceId: "test", sourceName: "Test publisher", sourceHomepage: "https://example.org/", region: "Europa", country: "Italia", language: "it", kind: "giornale", ideologies: [], title: "Una scheda da conservare", link: "https://example.org/article", publishedAt: "2026-10-18T10:00:00Z", author: null, excerpt: "Un estratto pubblico.", categories: [], topics: [], image: null, score: 1 };
async function setup() {
 const sqlite = new DatabaseSync(":memory:");
 sqlite.exec(await readFile(new URL("../drizzle/0000_careful_mole_man.sql", import.meta.url), "utf8"));
 const db = { prepare(sql) { const statement = sqlite.prepare(sql); const bound = values => ({ bind: (...next) => bound(next), all: async () => ({ results: statement.all(...values) }), run: async () => statement.run(...values) }); return bound([]); }, async batch(statements) { sqlite.exec("BEGIN"); try { const values = []; for (const statement of statements) values.push(await statement.run()); sqlite.exec("COMMIT"); return values; } catch(error) { sqlite.exec("ROLLBACK"); throw error; } } };
 const { default: worker } = await import("../dist/server/index.js");
 const call = (user, changes, extraHeaders = {}, offset = 0) => worker.fetch(new Request(`https://example.test/api/bookmarks?offset=${offset}`, {
  method: changes === undefined ? "GET" : "POST", headers: { ...(user ? { "oai-authenticated-user-id": user } : {}), ...(changes === undefined ? {} : { "content-type": "application/json", origin: "https://example.test" }), ...extraHeaders },
  ...(changes === undefined ? {} : { body: JSON.stringify({ changes, userId: "another-user" }) }),
 }), { DB: db, ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
 return { call, sqlite, close: () => sqlite.close() };
}

test("private cloud collections require hosted identity and isolate accounts, including identical article IDs", async () => {
 const {call,close} = await setup();
 try {
  assert.equal((await call(null)).status, 401);
  assert.equal((await call(null, [{kind:"article",key:article.id,article,deleted:false}])).status, 401);
  assert.equal((await call("alice", [{kind:"article",key:article.id,article,deleted:false},{kind:"book",key:"manifesto",deleted:false}])).status, 200);
  assert.equal((await call("bob", [{kind:"article",key:article.id,article:{...article,title:"La raccolta di Bob"},deleted:false}])).status, 200);
  const alice = await (await call("alice")).json(), bob = await (await call("bob")).json();
  assert.equal(alice.items.length, 2); assert.equal(bob.items.length, 1);
  assert.equal(alice.items.find(item=>item.kind==="article").article.title, article.title);
  assert.equal(bob.items[0].article.title, "La raccolta di Bob");
  assert.notEqual(alice.scope,bob.scope);
  assert.equal(alice.scope.length,64);
  assert.equal((await call("alice")).headers.get("cache-control"), "private, no-store");
 } finally { close(); }
});

test("a fresh browser can restore saved metadata, and removal tombstones prevent old device copies from resurrecting it", async () => {
 const {call,close} = await setup();
 try {
  await call("alice", [{kind:"article",key:article.id,article,deleted:false}]);
  const restored = await (await call("alice")).json();
  assert.equal(restored.items[0].article.link, article.link);
  await call("alice", [{kind:"article",key:article.id,deleted:true}]);
  const deleted = await (await call("alice")).json();
  assert.equal(deleted.items[0].deleted,true);
  assert.equal(deleted.items[0].article,undefined);
  assert.equal((await (await call("bob")).json()).items.length,0);
 } finally { close(); }
});

test("cloud mutations reject cross-origin requests, unknown books and invalid article snapshots atomically", async () => {
 const {call,close} = await setup();
 try {
  assert.equal((await call("alice",[{kind:"book",key:"manifesto",deleted:false}],{origin:"https://outside.test"})).status,403);
  assert.equal((await call("alice",[{kind:"book",key:"unknown",deleted:false}])).status,400);
  assert.equal((await call("alice",[{kind:"book",key:"manifesto",deleted:false},{kind:"article",key:"bad",article:{id:"bad",link:"javascript:alert(1)"},deleted:false}])).status,400);
  assert.equal((await (await call("alice")).json()).items.length,0);
 } finally { close(); }
});


test("large personal collections paginate without hiding older saved items behind removal history", async () => {
 const {call,sqlite,close}=await setup();
 try {
  const insert=sqlite.prepare("INSERT INTO bookmarks (owner_id,kind,item_key,payload,deleted,updated_at) VALUES (?,?,?,?,?,?)");
  for(let index=0;index<505;index++) {
   const id=`item-${String(index).padStart(4,"0")}`;
   insert.run("alice","article",id,JSON.stringify({...article,id}),index%2,Date.now());
  }
  const first=await(await call("alice")).json();
  assert.equal(first.items.length,500);assert.equal(first.nextOffset,500);
  const second=await(await call("alice",undefined,{},first.nextOffset)).json();
  assert.equal(second.items.length,5);assert.equal(second.nextOffset,null);
  assert.equal(new Set([...first.items,...second.items].map(item=>item.key)).size,505);
 } finally {close();}
});
