"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookmarkCheck, BookOpen } from "lucide-react";
import { BOOK_LANGUAGES, THEORY_LIBRARY, bookEdition } from "@/app/data/library";
import type { ReaderDocument } from "@/app/lib/book-reader";
import type { Progress } from "@/app/lib/reading-progress";
import { LocalizationProvider, LocalizedText } from "./Localization";

export function BookReader() {
 const [language,setLanguage]=useState("it");
 useEffect(()=>{try {const saved=localStorage.getItem("rassegna-rossa.reading-language");setLanguage(saved&&saved!=="auto"?saved:navigator.language.split("-")[0]);}catch{setLanguage(navigator.language.split("-")[0]);}},[]);
 return <LocalizationProvider language={language}><Reader language={language}/></LocalizationProvider>;
}
function Reader({language}:{language:string}) {
 const [bookId,setBookId]=useState("");
 const [edition,setEdition]=useState("");
 const [document,setDocument]=useState<ReaderDocument|null>(null);
 const [page,setPage]=useState(0);
 const [font,setFont]=useState(20);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [auth,setAuth]=useState(true);
 const [signIn,setSignIn]=useState("");
 const [resumed,setResumed]=useState(false);
 const [retryKey,setRetryKey]=useState(0);
 const [saveState,setSaveState]=useState<"idle"|"saving"|"saved"|"error">("idle");
 const viewport=useRef<HTMLDivElement>(null);
 const current=useRef<(Progress & {clientAt:number;scope:string})|null>(null);
 const pending=useRef<(Progress & {clientAt:number;scope:string})|null>(null);
 const sending=useRef(false);
 const scope=useRef("");
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const restoring=useRef(false);
 const restoredScroll=useRef(0);
 const request=useRef(0);
 const controller=useRef<AbortController|null>(null);
 const book=THEORY_LIBRARY.find(item=>item.id===bookId);
 const selected=bookEdition(bookId,edition);
 const pump=useCallback(async()=>{
  if(sending.current)return;sending.current=true;
  try{
   while(pending.current){const point=pending.current;pending.current=null;setSaveState("saving");
    try{const response=await fetch("/api/reading-progress",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(point),signal:AbortSignal.timeout(12000)});
     if(response.status===401){const data=await response.json();setAuth(false);setSignIn(data.signInUrl);throw Error("Login required");}
     if(response.status===409){pending.current=null;current.current=null;setRetryKey(value=>value+1);return;}
     if(!response.ok)throw Error("Save failed");setSaveState("saved");
    }catch{pending.current??=point;setSaveState("error");break;}
   }
  }finally{sending.current=false;}
 },[]);
 const queueSave=useCallback((immediate=false)=>{
  if(!current.current)return;
  current.current={...current.current,clientAt:Date.now()};pending.current=current.current;
  clearTimeout(timer.current);
  if(immediate)void pump();else timer.current=setTimeout(()=>void pump(),900);
 },[pump]);
 const load=useCallback(async(chapter:number,restorePage=0,scroll=0)=>{
  const version=++request.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
  setLoading(true);setError("");
  try{const params=new URLSearchParams({bookId,edition,chapter:String(chapter)});
   const response=await fetch(`/api/library/read?${params}`,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(25000)])});
   const data=await response.json();if(version!==request.current)return;
   if(response.status===401){setAuth(false);setSignIn(data.signInUrl);return;}
   if(!response.ok||!Array.isArray(data.pages))throw Error(data.error??"Edizione non disponibile");
   restoredScroll.current=scroll;setDocument(data);setPage(Math.min(Math.max(0,restorePage),data.pages.length-1));
  }catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Non è stato possibile aprire il testo.");}
  finally{if(version===request.current)setLoading(false);}
 },[bookId,edition]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search),id=params.get("book")??"manifesto";
  const entry=THEORY_LIBRARY.find(item=>item.id===id);
  if(!entry?.editions?.length){setError("Libro non disponibile nel lettore.");setLoading(false);return;}
  const preferred=params.get("edition")??language;
  setBookId(id);setEdition(entry.editions.find(item=>item.language===preferred)?.language??entry.editions.find(item=>item.language==="en")?.language??entry.editions[0].language);
 },[]);
 useEffect(()=>{
  if(!bookId||!edition)return;let alive=true;setLoading(true);setError("");setAuth(true);setResumed(false);setDocument(null);setSaveState("idle");current.current=null;
  const params=new URLSearchParams({bookId,edition});
  void(async()=>{try{
   const response=await fetch(`/api/reading-progress?${params}`,{cache:"no-store",signal:AbortSignal.timeout(12000)});
   const result=await response.json();if(!alive)return;
   if(response.status===401){setAuth(false);setSignIn(result.signInUrl);setLoading(false);return;}
   if(!response.ok)throw Error("Il segnalibro non è raggiungibile. Riprova per evitare di perdere la posizione.");
   scope.current=result.scope;
   const saved=result.items?.[0];setResumed(Boolean(saved));
   await load(saved?.chapter??0,saved?.page??0,saved?.scroll??0);
  }catch(e){if(alive){setError(e instanceof Error?e.message:"Archivio non disponibile");setLoading(false);}}})();
  window.history.replaceState(null,"",`/read?${new URLSearchParams({book:bookId,edition})}`);
  return()=>{alive=false;controller.current?.abort();};
 },[bookId,edition,load,retryKey]);
 useEffect(()=>{
  if(!document||loading)return;
  current.current={bookId,edition,chapter:document.chapter,page,scroll:restoredScroll.current,revision:document.revision,updatedAt:0,clientAt:Date.now(),scope:scope.current};
  restoring.current=true;
  const frame=requestAnimationFrame(()=>{const el=viewport.current;if(el)el.scrollTop=restoredScroll.current/10000*Math.max(0,el.scrollHeight-el.clientHeight);restoredScroll.current=0;restoring.current=false;queueSave(true);});
  return()=>cancelAnimationFrame(frame);
 },[document,page,loading,bookId,edition,queueSave]);
 useEffect(()=>{
  const flush=()=>{clearTimeout(timer.current);if(pending.current){void fetch("/api/reading-progress",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending.current),keepalive:true}).catch(()=>{});}};
  window.addEventListener("pagehide",flush);return()=>{window.removeEventListener("pagehide",flush);flush();};
 },[]);
 const move=(delta:number)=>{
  if(!document)return;queueSave(true);
  if(page+delta>=0&&page+delta<document.pages.length){restoredScroll.current=0;setPage(page+delta);}
  else if(document.chapter+delta>=0&&document.chapter+delta<document.chapters.length)void load(document.chapter+delta);
 };
 const scroll=()=>{if(restoring.current||!current.current||!viewport.current)return;const el=viewport.current;current.current={...current.current,scroll:Math.max(0,Math.min(10000,Math.round(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight)*10000)))};queueSave();};
 return <main className="book-reader">
  <header className="book-reader-header">
   <a href="/?view=teoria" onClick={()=>queueSave(true)}><ArrowLeft size={18}/><LocalizedText>Biblioteca</LocalizedText></a>
   <div><span className="eyebrow"><LocalizedText>Lettura personale</LocalizedText></span><h1>{book?.title??"Rassegna Rossa"}</h1><p>{book?.author}</p></div>
   <BookOpen size={24}/>
  </header>
  {!auth?<section className="reader-message"><h2><LocalizedText>Accedi per leggere e ritrovare il tuo segnalibro</LocalizedText></h2><p><LocalizedText>La posizione di lettura e gli articoli salvati rimangono nel tuo account, anche su un altro dispositivo.</LocalizedText></p><a className="primary-button" href={signIn} target="_top"><LocalizedText>Accedi con ChatGPT</LocalizedText></a></section>:null}
  {auth&&book?<div className="reader-controls">
   <label><LocalizedText>Edizione del libro</LocalizedText><select value={edition} onChange={e=>{queueSave(true);setEdition(e.target.value);}}>{book.editions?.map(item=><option key={item.language} value={item.language}>{BOOK_LANGUAGES[item.language]??item.language}</option>)}</select></label>
   {document?<label className="reader-chapters"><LocalizedText>Capitolo</LocalizedText><select value={document.chapter} onChange={e=>{queueSave(true);void load(Number(e.target.value));}}>{document.chapters.map((chapter,i)=><option key={`${chapter.url}:${i}`} value={i}>{chapter.title}</option>)}</select></label>:null}
   <label><LocalizedText>Testo</LocalizedText><select value={font} onChange={e=>setFont(Number(e.target.value))}><option value={18}>A</option><option value={20}>A+</option><option value={23}>A++</option></select></label>
  </div>:null}
  {loading&&auth?<p className="reader-message" role="status"><LocalizedText>Apertura del testo e recupero del segnalibro…</LocalizedText></p>:null}
  {error?<section className="reader-message" role="alert"><p>{error}</p>{bookId?<button className="text-link" onClick={()=>setRetryKey(value=>value+1)}><LocalizedText>Riprova</LocalizedText></button>:null}{selected?<a href={selected.url} target="_blank" rel="noopener noreferrer"><LocalizedText>Apri l’archivio originale</LocalizedText></a>:null}</section>:null}
  {auth&&document&&!loading&&!error?<>
   <div className="reader-save-status" role="status" aria-live="polite">
    <BookmarkCheck size={16}/><LocalizedText>{saveState==="error"?"Segnalibro non salvato. Riprova.":saveState==="saved"?"Segnalibro salvato nel tuo account":saveState==="saving"?"Salvataggio del segnalibro…":resumed?"Ripresa dall’ultima posizione salvata":"Lettura con segnalibro automatico"}</LocalizedText>
    {saveState==="error"?<button className="text-link" onClick={()=>void pump()}><LocalizedText>Riprova</LocalizedText></button>:null}
   </div>
   <div ref={viewport} className="reader-viewport" onScroll={scroll} tabIndex={0} aria-label="Pagina del libro" style={{fontSize:font}}>
    <article className="reader-paper" lang={edition} dir={["ar","fa","he","ur"].includes(edition)?"rtl":"ltr"}>
     {document.pages[page]?.map((block,i)=>block.type==="p"?<p key={i}>{block.text}</p>:block.type==="h2"?<h2 key={i}>{block.text}</h2>:<h3 key={i}>{block.text}</h3>)}
    </article>
   </div>
   <footer className="reader-pagination">
    <button onClick={()=>move(-1)} disabled={page===0&&document.chapter===0}><ArrowLeft size={18}/><LocalizedText>Precedente</LocalizedText></button>
    <label><LocalizedText>Pagina di lettura</LocalizedText><input aria-label="Numero pagina di lettura" type="number" min={1} max={document.pages.length} value={page+1} onChange={e=>{const next=Number(e.target.value)-1;if(Number.isSafeInteger(next)&&next>=0&&next<document.pages.length){queueSave(true);restoredScroll.current=0;setPage(next);}}}/><span>/ {document.pages.length}</span></label>
    <button onClick={()=>move(1)} disabled={page===document.pages.length-1&&document.chapter===document.chapters.length-1}><LocalizedText>Successiva</LocalizedText><ArrowRight size={18}/></button>
   </footer>
   <div className="reader-source"><span>{document.source} · {BOOK_LANGUAGES[edition]??edition}</span><a href={document.url} target="_blank" rel="noopener noreferrer"><LocalizedText>Testo, attribuzione e licenza nell’archivio originale</LocalizedText></a><button className="text-link" onClick={()=>queueSave(true)}><BookmarkCheck size={16}/><LocalizedText>Segna questa pagina</LocalizedText></button></div>
  </>:null}
 </main>;
}
