import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_CHANNELS,videoChannel} from '../app/data/video-catalog.ts';
import {parseVideoFeed,parsePeerTubeVideos} from '../app/lib/video-parser.ts';
import {validateVideos,rankVideos} from '../app/lib/videos.ts';
const channel=videoChannel('clara-statello');
const entry=(id='abcdefghijk',publisher=channel.channelId)=>`<entry><yt:videoId>${id}</yt:videoId><yt:channelId>${publisher}</yt:channelId><title>Cooperazione &amp; libert&agrave;</title><published>2026-10-19T10:00:00Z</published><media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg"/></entry>`;

test('video sources include the requested channels, European and global languages and an independent platform',()=>{
 for(const id of ['clara-statello','dazibao','ottolina'])assert.ok(videoChannel(id));
 assert.equal(new Set(VIDEO_CHANNELS.map(c=>c.id)).size,VIDEO_CHANNELS.length);
 assert.ok(new Set(VIDEO_CHANNELS.map(c=>c.language)).size>=6);
 for(const country of ['Francia','Germania','Spagna','Regno Unito','Brasile','India','Australia'])assert.ok(VIDEO_CHANNELS.some(c=>c.country===country));
 assert.equal(videoChannel('le-media').platform,'peertube');
});

test('channel feeds return actual bounded videos, decoded titles and dates while rejecting other channels and unsafe destinations',()=>{
 const videos=parseVideoFeed('<feed>'+entry()+entry('otherabcdef','wrong-channel')+entry('invalid-id')+'</feed>',channel);
 assert.equal(videos.length,1);assert.equal(videos[0].title,'Cooperazione & libertà');
 assert.equal(videos[0].publishedAt,'2026-10-19T10:00:00Z');
 assert.deepEqual(parseVideoFeed('<html>Consent required</html>',channel),[]);
 for(const changes of [{channel:'unknown'},{url:'javascript:alert(1)'},{url:'https://www.youtube.com.evil.example/watch?v=abcdefghijk'},{url:'https://user:pass@www.youtube.com/watch?v=abcdefghijk'},{id:'otherabcdef'}])assert.deepEqual(validateVideos([{...videos[0],...changes}]),[]);
 const noImage=validateVideos([{...videos[0],image:'https://127.0.0.1/private.jpg'}]);assert.equal(noImage[0].image,null);
});

test('PeerTube accepts only the official channel and its fixed host; language priority preserves every channel',()=>{
 const c=videoChannel('le-media'),id='11111111-1111-4111-8111-111111111111';
 const item={uuid:id,name:'Une autre information',url:`https://video.lemediatv.fr/videos/watch/${id}`,thumbnailPath:'/lazy-static/photo.jpg',publishedAt:'2026-10-18T10:00:00Z',channel:{name:'chaine_officielle'}};
 const clips=parsePeerTubeVideos({data:[item,{...item,url:'https://unverified.example/videos/watch/'+id}]},c);assert.equal(clips.length,1);
 assert.equal(clips[0].image,'https://video.lemediatv.fr/lazy-static/photo.jpg');
 assert.deepEqual(parsePeerTubeVideos({data:[{...item,channel:{name:'someone-else'}}]},c),[]);
 const italian=parseVideoFeed('<feed>'+entry()+'</feed>',channel);
 const ranked=rankVideos([...italian,...clips], 'fr');assert.equal(ranked[0].channel,'le-media');assert.equal(ranked.length,2);
});

test('the public video API accepts only catalogue channels, caches completed results and exposes real fallback data as stale',async()=>{
 const {default:worker}=await import('../dist/server/index.js');const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async raw=>{calls++;const url=String(raw);assert.equal(url,`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`);return new Response('<feed>'+entry()+'</feed>',{headers:{'content-type':'application/atom+xml'}});};
 const call=query=>worker.fetch(new Request('https://news.example/api/videos?'+query),{ASSETS:{fetch:async()=>new Response(null,{status:404})}},{waitUntil(){},passThroughOnException(){}});
 try{
  const first=await call('channel=clara-statello');assert.equal(first.status,200);const body=await first.json();assert.equal(body.videos[0].title,'Cooperazione & libertà');assert.equal(body.stale,false);
  assert.match(first.headers.get('cache-control'),/^public/);
  await call('channel=clara-statello');assert.equal(calls,1);
  for(const query of ['channel=unknown','channel=clara-statello&channel=dazibao','channel=clara-statello&url=https://127.0.0.1/'])assert.equal((await call(query)).status,400);
  assert.equal(calls,1);
  globalThis.fetch=async()=>{throw Error('Offline');};
  const fallback=await(await call('channel=dazibao')).json();assert.equal(fallback.stale,true);assert.ok(fallback.videos.every(video=>video.channel==='dazibao'));
 }finally{globalThis.fetch=original;}
});
