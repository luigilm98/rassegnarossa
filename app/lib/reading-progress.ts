import { bookEdition } from "../data/library";
import { readLimited } from "./article-photo";
export type Progress = { bookId: string; edition: string; chapter: number; page: number; scroll: number; revision: string; updatedAt: number };
type Statement = { bind(...values: unknown[]): Statement; all(): Promise<{results: Record<string,unknown>[]}>; run():Promise<unknown> };
type Database = { prepare(sql:string):Statement; batch(statements:Statement[]):Promise<unknown> };
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store",vary:"cookie"}});
export async function handleReadingProgress(request:Request,db:Database|undefined,userId:string|null,signInUrl:string):Promise<Response>{
 if(!userId)return reply({authenticated:false,signInUrl},401);
 if(!db)return reply({authenticated:true,error:"Archivio temporaneamente non disponibile"},503);
 const scope=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(userId)))).map(n=>n.toString(16).padStart(2,"0")).join("");
 const url=new URL(request.url),bookId=url.searchParams.get("bookId"),edition=url.searchParams.get("edition");
 if(request.method==="GET"){
  if([...url.searchParams.keys()].some(key=>!["bookId","edition"].includes(key)||url.searchParams.getAll(key).length>1)||(bookId||edition)&&(!bookId||!edition||!bookEdition(bookId,edition)))return reply({error:"Edizione non valida"},400);
  try{
   const rows=await (bookId?db.prepare("SELECT book_id, edition, chapter, page, scroll, revision, updated_at FROM reading_progress WHERE owner_id = ? AND book_id = ? AND edition = ?").bind(userId,bookId,edition):db.prepare("SELECT book_id, edition, chapter, page, scroll, revision, updated_at FROM reading_progress WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 1000").bind(userId)).all();
   return reply({authenticated:true,scope,items:rows.results.map(row=>({bookId:row.book_id,edition:row.edition,chapter:row.chapter,page:row.page,scroll:row.scroll,revision:row.revision,updatedAt:row.updated_at}))});
  }catch{return reply({error:"Impossibile recuperare il segnalibro"},503);}
 }
 if(request.method!=="POST")return reply({error:"Metodo non supportato"},405);
 if((request.headers.get("origin")&&request.headers.get("origin")!==url.origin)||request.headers.get("sec-fetch-site")==="cross-site")return reply({error:"Origine non valida"},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"JSON richiesto"},415);
 let p:Progress & {clientAt?: number; scope?: string};
 try{p=JSON.parse(new TextDecoder().decode(await readLimited(new Response(request.body),4096)));}catch{return reply({error:"Dati non validi"},400);}
 if(p?.scope && p.scope!==scope)return reply({error:"Account cambiato",accountChanged:true},409);
 if(!p||typeof p.bookId!=="string"||typeof p.edition!=="string"||!bookEdition(p.bookId,p.edition)||!Number.isSafeInteger(p.chapter)||p.chapter<0||p.chapter>255||!Number.isSafeInteger(p.page)||p.page<0||p.page>100000||!Number.isSafeInteger(p.scroll)||p.scroll<0||p.scroll>10000||typeof p.revision!=="string"||! /^[a-f0-9]{64}$/.test(p.revision))return reply({error:"Segnalibro non valido"},400);
 try{
  const now=Date.now();
  const stamp=typeof p.clientAt === "number" && Number.isSafeInteger(p.clientAt) && Math.abs(p.clientAt-now)<300000 ? Math.min(now,p.clientAt) : now;
  await db.batch([
   db.prepare("INSERT INTO reading_progress (owner_id, book_id, edition, chapter, page, scroll, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, book_id, edition) DO UPDATE SET chapter=excluded.chapter, page=excluded.page, scroll=excluded.scroll, revision=excluded.revision, updated_at=excluded.updated_at WHERE reading_progress.updated_at <= excluded.updated_at").bind(userId,p.bookId,p.edition,p.chapter,p.page,p.scroll,p.revision,stamp),
   db.prepare("INSERT INTO bookmarks (owner_id, kind, item_key, payload, deleted, updated_at) VALUES (?, 'book', ?, 'null', 0, ?) ON CONFLICT(owner_id, kind, item_key) DO NOTHING").bind(userId,p.bookId,stamp),
  ]);
  return reply({ok:true,updatedAt:stamp});
 }catch{return reply({error:"Segnalibro non salvato. Riprova."},503);}
}
