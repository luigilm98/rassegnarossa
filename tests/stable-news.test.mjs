import test from "node:test";
import assert from "node:assert/strict";
import { retainArticleOrder } from "../app/lib/stable-news.ts";
test("incoming rankings and revised images never move existing cards while reading", () => {
 const before=[{id:"one",image:null},{id:"two",image:"pending"}];
 const incoming=[{id:"new",image:"new"},{id:"two",image:"loaded"},{id:"one",image:null}];
 const ordered=retainArticleOrder(before.map(item=>item.id),incoming);
 assert.deepEqual(ordered.map(item=>item.id),["one","two","new"]);
 assert.equal(ordered[1].image,"loaded");
 assert.deepEqual(retainArticleOrder([],incoming).map(item=>item.id),["new","two","one"]);
 assert.deepEqual(retainArticleOrder(["removed","two"],incoming.slice(0,2)).map(item=>item.id),["two","new"]);
});
