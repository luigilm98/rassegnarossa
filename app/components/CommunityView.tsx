"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronLeft,ChevronRight,MessageSquare,RefreshCw,ThumbsDown,ThumbsUp,Minus} from 'lucide-react';
import {COMMUNITY_CATEGORIES,proposalId,proposalParagraphs,type CommunityProposal} from '@/app/lib/community-model';
import BOOK_LANGUAGES from '@/app/data/languages.json';
import {LocalizedText as T,LocalizedInput,useLocale} from './Localization';
const statuses={open:'In consultazione',planned:'In programma',implemented:'Realizzata',declined:'Non accolta',hidden:'Non disponibile'};
type Mine={authenticated?:boolean;votes?:Record<string,number>;own?:string[];signInUrl?:string};
const defaultSignIn='/signin-with-chatgpt?return_to=%2F%3Fview%3Dpartecipa';
export default function CommunityView(){
 const locale=useLocale();
 const [items,setItems]=useState<CommunityProposal[]>([]),[next,setNext]=useState<number|null>(null);
 const [offset,setOffset]=useState(0),[sort,setSort]=useState('latest'),[category,setCategory]=useState('all');
 const [single,setSingle]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
 const [mine,setMine]=useState<Mine>({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false),[formOpen,setFormOpen]=useState(false);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[references,setReferences]=useState(''),[area,setArea]=useState('governance'),[language,setLanguage]=useState(locale),[consent,setConsent]=useState(false);
 const requestId=useRef<string|null>(null);
 const formHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const id=new URL(location.href).searchParams.get('proposal');if(proposalId(id))setSingle(id);},[]);
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  const load=async()=>{
   if(running||document.visibilityState==='hidden')return;running=true;setLoading(true);
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
   try{
    const query=new URLSearchParams(single?{id:single}:{sort,category,offset:String(offset)});
    const response=await fetch('/api/community?'+query,{signal,cache:'no-store'});const data=await response.json();
    if(!response.ok)throw Error(data.error??'Non è stato possibile caricare le proposte.');
    if(controller.signal.aborted)return;
    setItems(data.items);setNext(data.nextOffset);setError('');
    const ownResponse=await fetch('/api/community/mine?'+new URLSearchParams({ids:data.items.map((item:CommunityProposal)=>item.id).join(',')}),{signal,cache:'no-store'});
    const ownData=await ownResponse.json();
    if(!controller.signal.aborted){if(ownResponse.ok||ownResponse.status===401)setMine(ownData);else setMine({});}
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'La partecipazione non è disponibile.');}
   finally{running=false;if(!controller.signal.aborted)setLoading(false);}
  };
  void load();const timer=setInterval(()=>void load(),30000);
  const visible=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',visible);
  return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[sort,category,offset,refresh,single]);
 const mutate=async(data:Record<string,unknown>)=>{
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/community',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});const result=await response.json();
   if(response.status===401){setMine(result);throw Error('Accedi per proporre e votare.');}
   if(!response.ok)throw Error(result.error??'La modifica non è stata salvata.');
   setRefresh(value=>value+1);return result;
  }catch(e){setError(e instanceof Error?e.message:'La modifica non è stata salvata. Riprova.');return null;}
  finally{setBusy(false);}
 };
 const publish=async(event:React.FormEvent)=>{
  event.preventDefault();if(!consent)return;
  requestId.current??=crypto.randomUUID();
  const result=await mutate({action:'propose',requestId:requestId.current,title,body,references,category:area,language});
  if(result){setTitle('');setBody('');setReferences('');setConsent(false);requestId.current=null;setFormOpen(false);setSingle(result.id);setMessage('La tua proposta è pubblicata. La comunità può leggerla e votarla.');const url=new URL(location.href);url.searchParams.set('view','partecipa');url.searchParams.set('proposal',result.id);history.replaceState(history.state,'',url);}
 };
 const all=()=>{setSingle(null);setOffset(0);const url=new URL(location.href);url.searchParams.delete('proposal');history.replaceState(history.state,'',url);};
 const signIn=mine.signInUrl??defaultSignIn;
 return <div className="community-view">
  <section className="community-welcome"><p className="eyebrow"><T>UN PROGETTO DA COSTRUIRE INSIEME</T></p><h2><T>La tua voce può cambiare questo sito.</T></h2><p><T>Attivisti, giornalisti indipendenti e di testata, collettivi, sindacati e lettori: proponete ciò che manca, confrontate le alternative e indicate le priorità. Anche le regole della partecipazione possono essere proposte e votate.</T></p><div className="community-welcome-actions">{mine.authenticated?<button className="button community-primary" type="button" onClick={()=>{setFormOpen(open=>!open);requestAnimationFrame(()=>formHeading.current?.focus());}}><MessageSquare size={17}/><T>{formOpen?'Chiudi il modulo':'Proponi un cambiamento'}</T></button>:<a className="button community-primary" href={signIn} target="_top"><T>Accedi per proporre e votare</T><ArrowUpRight size={17}/></a>}<a href="#community-rules" className="text-link"><T>Come funziona</T></a></div></section>
  <details id="community-rules" className="community-rules"><summary><T>Proposte, voto e decisioni: le regole attuali</T></summary><div><p><T>Chiunque può leggere. Con un account ChatGPT puoi pubblicare fino a tre proposte ogni 24 ore e dare un voto per proposta: favorevole, contrario o astensione. Puoi cambiarlo o ritirarlo. Per una nuova posizione su una consultazione chiusa si apre una nuova proposta.</T></p><p><T>I voti sono una consultazione della comunità partecipante. Un account non equivale a una persona verificata; questi risultati non rappresentano automaticamente tutti i movimenti o le popolazioni del mondo. Non raccogliamo appartenenze politiche, qualifiche professionali o posizione geografica.</T></p><p><T>Le preferenze aiutano a definire le priorità. Le modifiche al sito richiedono verifica delle fonti e revisione tecnica. Le decisioni dei manutentori compaiono accanto alla proposta, con stato e motivazione: in programma, realizzata o non accolta. Una proposta può riguardare anche questo metodo decisionale.</T></p><p><T>Testo e riferimenti della proposta sono pubblici. Nome, email, identificativo dell’account e scelta di voto non vengono mostrati. I voti restano salvati sul server anche se cancelli la cache; la partecipazione richiede accesso. Non inserire informazioni private nel testo. Puoi ritirare una tua proposta; contenuti illeciti, molestie e spam possono essere rimossi.</T></p><p><T>Scrivi nella tua lingua e indica la lingua originale. La lettura segue le traduzioni disponibili; il testo originale resta consultabile. Le traduzioni possono inviare il testo pubblico della proposta al servizio di traduzione.</T></p></div></details>
  {formOpen&&mine.authenticated&&<form className="community-form" onSubmit={event=>void publish(event)}><h3 ref={formHeading} tabIndex={-1}><T>Che cosa vorresti cambiare?</T></h3><div className="community-form-row"><label><T>Ambito della proposta</T><select value={area} onChange={e=>setArea(e.target.value)}>{Object.entries(COMMUNITY_CATEGORIES).map(([id,label])=><option key={id} value={id}><T>{label}</T></option>)}</select></label><label><T>Lingua della proposta</T><select value={language} onChange={e=>setLanguage(e.target.value)}>{Object.entries(BOOK_LANGUAGES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div><label><T>Un titolo chiaro</T><LocalizedInput value={title} onChange={e=>setTitle(e.target.value)} minLength={10} maxLength={140} required placeholder="Quale cambiamento proponi?"/></label><label><T>La proposta e il suo motivo</T><textarea value={body} onChange={e=>setBody(e.target.value)} minLength={40} maxLength={5000} required rows={7}/><small>{body.length}/5000 · <T>Spiega il bisogno, il cambiamento e le possibili alternative.</T></small></label><label><T>Fonti e riferimenti, se utili</T><textarea value={references} onChange={e=>setReferences(e.target.value)} maxLength={1000} rows={3}/></label><label className="community-consent"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span><T>Voglio pubblicare questa proposta. Ho escluso informazioni private e materiali che non posso condividere.</T></span></label><button className="button community-primary" disabled={busy||!consent} type="submit"><T>{busy?'Invio in corso…':'Pubblica la proposta'}</T></button></form>}
  {message&&<p role="status" className="community-notice"><Check size={17}/><T>{message}</T></p>}
  {error&&<p role="alert" className="community-error"><T>{error}</T> <button className="text-link" type="button" onClick={()=>setRefresh(x=>x+1)}><T>Riprova</T></button></p>}
  <div className="community-toolbar">{single?<button className="text-link" type="button" onClick={all}><ChevronLeft size={16}/><T>Tutte le proposte</T></button>:<><label><T>Ambito</T><select value={category} onChange={e=>{setCategory(e.target.value);setOffset(0);}}><option value="all"><T>Tutti gli ambiti</T></option>{Object.entries(COMMUNITY_CATEGORIES).map(([id,label])=><option key={id} value={id}><T>{label}</T></option>)}</select></label><label><T>Ordina</T><select value={sort} onChange={e=>{setSort(e.target.value);setOffset(0);}}><option value="latest"><T>Più recenti</T></option><option value="support"><T>Più sostenute</T></option><option value="participation"><T>Più votate</T></option></select></label></>}<button className="text-link" type="button" disabled={loading} onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={16}/><T>{loading?'Aggiornamento…':'Aggiorna'}</T></button></div>
  {!items.length&&!loading&&!error&&<div className="community-empty"><MessageSquare size={28}/><h3><T>{single?'La proposta non è disponibile.':'La prima proposta può essere la tua.'}</T></h3><p><T>{single?'Potrebbe essere stata ritirata o rimossa.':'Non ci sono ancora proposte in questa selezione. Apri un tema, suggerisci una fonte o proponi una regola: la consultazione parte dalle persone che partecipano.'}</T></p></div>}
  <div className="community-proposals">{items.map(item=><ProposalCard key={item.id} item={item} vote={mine.votes?.[item.id]} own={mine.own?.includes(item.id)??false} authenticated={mine.authenticated??false} busy={busy} signIn={signIn} mutate={mutate}/>)}</div>
  {!single&&(offset>0||next!==null)&&<div className="community-pagination"><button className="text-link" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-20))}><ChevronLeft size={16}/><T>Precedenti</T></button><span><T>Pagina</T> {Math.floor(offset/20)+1}</span><button className="text-link" disabled={next===null||loading} onClick={()=>next!==null&&setOffset(next)}><T>Successive</T><ChevronRight size={16}/></button></div>}
 </div>;
}
function ProposalCard({item,vote,own,authenticated,busy,signIn,mutate}:{item:CommunityProposal;vote:number|undefined;own:boolean;authenticated:boolean;busy:boolean;signIn:string;mutate:(data:Record<string,unknown>)=>Promise<unknown>}){
 const [original,setOriginal]=useState(false),[withdraw,setWithdraw]=useState(false);const locale=useLocale();
 const closed=item.decision&&item.decision.status!=='open';
 const content=(value:string)=><T from={item.language} defer>{value}</T>;
 return <article className="community-proposal" id={'proposal-'+item.id}>
  <header><p className="eyebrow"><T>{COMMUNITY_CATEGORIES[item.category]}</T> · <time dateTime={new Date(item.createdAt).toISOString()}>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(item.createdAt)}</time></p><h3>{original?item.title:content(item.title)}</h3><p className="community-proposal-status"><T>{statuses[item.decision?.status??'open']}</T><span> · {item.votes.total} <T>voti</T></span></p></header>
  <div className="community-proposal-body">{proposalParagraphs(item.body).map((p,i)=><p key={i}>{original?p:content(p)}</p>)}</div>
  {item.references&&<details className="community-references"><summary><T>Riferimenti della proposta</T></summary><p>{item.references}</p></details>}
  {item.decision&&<aside className="community-decision"><strong><T>Riscontro del progetto</T> · {item.decision.date}</strong><p><T defer>{item.decision.reason}</T></p>{item.decision.url&&<a href={item.decision.url} target="_blank" rel="noopener noreferrer"><T>Vedi la modifica</T><ArrowUpRight size={14}/></a>}</aside>}
  <div className="community-votes">{([{value:1,label:'Favorevole',count:item.votes.support,Icon:ThumbsUp},{value:-1,label:'Contrario',count:item.votes.oppose,Icon:ThumbsDown},{value:0,label:'Astensione',count:item.votes.abstain,Icon:Minus}]).map(({value,label,count,Icon})=><button key={value} type="button" aria-pressed={authenticated&&vote===value} disabled={!authenticated||busy||Boolean(closed)} onClick={()=>void mutate({action:'vote',id:item.id,value})}><Icon size={16}/><T>{label}</T><strong>{count}</strong></button>)}</div>
  {!authenticated&&<p className="community-login-note"><a href={signIn} target="_top"><T>Accedi per esprimere il tuo voto</T><ArrowUpRight size={13}/></a></p>}
  <footer><div>{authenticated&&vote!==undefined&&<button type="button" className="text-link" disabled={busy} onClick={()=>void mutate({action:'vote',id:item.id,value:null})}><T>Ritira il voto</T></button>}<button className="text-link" type="button" onClick={()=>setOriginal(x=>!x)}><T>{original?'Leggi tradotto':'Testo originale'}</T></button><a className="text-link" href={`/?view=partecipa&proposal=${item.id}`}><T>Link alla proposta</T><ArrowUpRight size={13}/></a></div>{own&&<button className="text-link" type="button" disabled={busy} onClick={()=>setWithdraw(x=>!x)}><T>Ritira la proposta</T></button>}</footer>
  {withdraw&&<div className="community-withdraw"><p><T>La proposta non sarà più pubblica e il suo testo verrà rimosso dall’archivio delle proposte. Questa operazione non si può annullare.</T></p><button className="text-link" type="button" disabled={busy} onClick={()=>void mutate({action:'withdraw',id:item.id})}><T>Conferma il ritiro</T></button><button className="text-link" type="button" onClick={()=>setWithdraw(false)}><T>Annulla</T></button></div>}
 </article>;
}
