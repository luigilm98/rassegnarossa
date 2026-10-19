import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {handleCommunity} from '../app/lib/community.ts';
const fixture={action:'propose',title:'Una proposta per la comunità',body:'Una proposta documentata per migliorare la biblioteca e renderla più accessibile a tutte le persone.',references:'https://example.org/documento',category:'library',language:'it'};
async function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile(new URL('../drizzle/0003_even_marten_broadcloak.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const statement=sqlite.prepare(sql);const bound=values=>({bind:(...next)=>bound(next),all:async()=>({results:statement.all(...values)}),run:async()=>statement.run(...values)});return bound([]);}};
 const call=(user=null,data=undefined,path='',headers={},decisions={})=>handleCommunity(new Request('https://example.test/api/community'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?headers:{'content-type':'application/json',origin:'https://example.test',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})}),db,user,'/signin',decisions);
 const propose=async(user='alice',data={})=>{const r=await call(user,{...fixture,...data});assert.equal(r.status,201);return(await r.json()).id;};
 return {sqlite,db,call,propose,close:()=>sqlite.close()};
}
test('visitors read genuine empty results; proposals and private voting state require hosted identity',async()=>{const f=await setup();try{
 const publicResponse=await f.call();assert.deepEqual((await publicResponse.json()).items,[]);assert.equal(publicResponse.headers.get('cache-control'),'private, no-store');
 assert.equal((await f.call(null,fixture)).status,401);assert.equal((await f.call(null,undefined,'/mine')).status,401);
 assert.equal((await handleCommunity(new Request('https://example.test/api/community'),undefined,null)).status,503);
}finally{f.close();}});
test('submission retries are idempotent; public content contains no account key, email or inferred identity',async()=>{const f=await setup();try{
 const requestId=crypto.randomUUID(),id=await f.propose('private-account-id',{requestId});assert.equal(await f.propose('private-account-id',{requestId}),id);
 assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM community_proposals').get().n,1);
 const row=f.sqlite.prepare('SELECT * FROM community_proposals').get();assert.equal(row.owner_key.length,64);assert.notEqual(row.owner_key,'private-account-id');
 const publicData=await(await f.call()).json();assert.equal(publicData.items[0].title,fixture.title);assert.equal(publicData.items[0].references,fixture.references);assert.doesNotMatch(JSON.stringify(publicData),/owner_key|private-account-id|email|voter_key/);
 assert.equal((await f.call('another-account',{...fixture,requestId})).status,429);
 assert.equal((await f.call('private-account-id',{...fixture,requestId,references:'changed'})).status,429);
}finally{f.close();}});
test('votes persist per account, remain private, change rather than duplicate, and can be withdrawn',async()=>{const f=await setup();try{
 const id=await f.propose();
 for(const [user,value]of [['alice',1],['alice',1],['bob',-1]])assert.equal((await f.call(user,{action:'vote',id,value})).status,200);
 let board=await(await f.call()).json();assert.deepEqual(board.items[0].votes,{support:1,oppose:1,abstain:0,total:2});
 assert.equal((await f.call('alice',{action:'vote',id,value:0})).status,200);
 const mine=await(await f.call('alice',undefined,'/mine?ids='+id)).json(),bob=await(await f.call('bob',undefined,'/mine?ids='+id)).json();assert.equal(mine.votes[id],0);assert.equal(bob.votes[id],-1);assert.deepEqual(mine.own,[id]);assert.deepEqual(bob.own,[]);
 assert.equal((await f.call('alice',{action:'vote',id,value:null})).status,200);board=await(await f.call()).json();assert.equal(board.items[0].votes.total,1);
 assert.equal((await f.call('alice',{action:'vote',id,value:1,userId:'bob'})).status,400);
}finally{f.close();}});
test('rate limits are enforced in the database and withdrawals erase public text without granting other accounts control',async()=>{const f=await setup();try{
 const id=await f.propose();await f.propose();await f.propose();assert.equal((await f.call('alice',fixture)).status,429);
 assert.equal((await f.call('bob',{action:'withdraw',id})).status,404);assert.equal((await f.call('alice',{action:'withdraw',id})).status,200);
 assert.equal((await(await f.call()).json()).items.length,2);const row=f.sqlite.prepare('SELECT title,body,references_text FROM community_proposals WHERE id=?').get(id);assert.deepEqual({...row},{title:'',body:'',references_text:''});
 assert.equal((await f.call('bob',{action:'vote',id,value:1})).status,404);
}finally{f.close();}});
test('public decision records close voting, expose explanations, hide removed content and still allow withdrawal of a private vote',async()=>{const f=await setup();try{
 const id=await f.propose();await f.call('alice',{action:'vote',id,value:1});const decision={status:'planned',reason:'Accolta per una prossima versione.',date:'2026-10-19'};
 assert.equal((await f.call('bob',{action:'vote',id,value:1},'',{}, {[id]:decision})).status,409);
 assert.deepEqual((await(await f.call(null,undefined,'',{}, {[id]:decision})).json()).items[0].decision,decision);
 assert.equal((await f.call('alice',{action:'vote',id,value:null},'',{}, {[id]:decision})).status,200);
 assert.deepEqual((await(await f.call(null,undefined,'',{}, {[id]:{...decision,status:'hidden'}})).json()).items,[]);
}finally{f.close();}});
test('unsafe request shapes, cross-origin mutations, oversized bodies and database failures fail without invented vote counts',async()=>{const f=await setup();try{
 for(const edit of [{title:'short'},{body:'short'},{category:'invented'},{language:'https://bad'},{ownerKey:'other'},{requestId:'invalid'}])assert.equal((await f.call('alice',{...fixture,...edit})).status,400);
 assert.equal((await f.call('alice',fixture,'',{origin:'https://other.test'})).status,403);
 assert.equal((await f.call('alice',fixture,'',{'content-type':'text/plain'})).status,415);
 assert.equal((await f.call('alice',{...fixture,body:'x'.repeat(40000)})).status,413);
 for(const path of ['?sort=wrong','?offset=-1','?offset=Infinity','?category=wrong','?id=','?id=not-an-id','?sort=latest&sort=support','?unknown=1'])assert.equal((await f.call(null,undefined,path)).status,400);
 const broken={prepare(){throw Error('unavailable');}};assert.equal((await handleCommunity(new Request('https://example.test/api/community'),broken,null)).status,503);
}finally{f.close();}});
test('the board paginates and filters without hiding all but the newest proposals, and sorting uses actual votes',async()=>{const f=await setup();try{
 const insert=f.sqlite.prepare('INSERT INTO community_proposals (id,owner_key,title,body,references_text,category,language,created_at,withdrawn) VALUES (?,?,?,?,?,?,?,?,0)');
 let firstId;for(let i=0;i<25;i++){const id=crypto.randomUUID();firstId??=id;insert.run(id,'key',fixture.title,fixture.body,'',i%2?'library':'governance','it',i);}
 const first=await(await f.call()).json(),second=await(await f.call(null,undefined,'?offset=20')).json();assert.equal(first.items.length,20);assert.equal(first.nextOffset,20);assert.equal(second.items.length,5);assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,25);
 await f.call('alice',{action:'vote',id:firstId,value:1});assert.equal((await(await f.call(null,undefined,'?sort=support')).json()).items[0].id,firstId);
 assert.equal((await(await f.call(null,undefined,'?category=library')).json()).items.length,12);
}finally{f.close();}});
