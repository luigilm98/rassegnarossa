import test from "node:test";
import assert from "node:assert/strict";
import { createPhotoLoader, resolvePhoto } from "../app/lib/photo-loader.ts";

test("24 simultaneous cards use at most four downloads, decode before display and reuse successful photos",async()=>{
 let active=0,max=0,requests=0,decoded=0;
 const load=createPhotoLoader(()=>({onload:null,onerror:null,referrerPolicy:"",set src(value){requests++;active++;max=Math.max(max,active);setTimeout(()=>{active--;this.onload?.();},2);},async decode(){decoded++;}}),4,1000);
 const urls=Array.from({length:24},(_,i)=>`/photo/${i}`);
 assert.deepEqual(await Promise.all(urls.map(load)),urls);
 assert.equal(max,4);assert.equal(decoded,24);
 assert.deepEqual(await Promise.all(urls.map(load)),urls);assert.equal(requests,24);
});

test("broken downloads and undecodable pixels do not stop the queue; a failed URL may be retried",async()=>{
 let calls=0;
 const load=createPhotoLoader(()=>({onload:null,onerror:null,referrerPolicy:"",set src(value){calls++;queueMicrotask(()=>value==="broken"&&calls===1?this.onerror?.():this.onload?.());},async decode(){}}),1,1000);
 assert.equal(await load("broken"),null);
 assert.equal(await load("broken"),"broken");
 assert.equal(await load("next"),"next");
 const corrupt=createPhotoLoader(()=>({onload:null,onerror:null,referrerPolicy:"",set src(value){queueMicrotask(()=>this.onload?.());},async decode(){throw Error("corrupt");}}),1,100);
 assert.equal(await corrupt("bad"),null);
});

test("a fast direct photo avoids recovery while a slow publisher races an independent recovery queue",async()=>{
 let recoveries=0;
 assert.equal(await resolvePhoto(["fast"],"proxy",async url=>url,async url=>{recoveries++;return url;},10),"fast");
 await new Promise(resolve=>setTimeout(resolve,15));assert.equal(recoveries,0);
 assert.equal(await resolvePhoto(["slow"],"proxy",()=>new Promise(()=>{}),async url=>url,1),"proxy");
 assert.equal(await resolvePhoto(["broken"],"proxy",async()=>null,async url=>url,1000),"proxy");
 assert.equal(await resolvePhoto([],null,async()=>null,async()=>null,1),null);
 assert.equal(await resolvePhoto(["broken"],"proxy",async()=>null,async()=>null,1),null);
});
