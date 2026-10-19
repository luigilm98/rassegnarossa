import {COMMUNITY_CATEGORIES,proposalId,type CommunityDecision,type CommunityProposal} from './community-model.ts';
import DECISIONS from '../data/community-decisions.json' with {type:'json'};
type Row=Record<string,unknown>;
type Statement={bind(...values:unknown[]):Statement;all():Promise<{results:Row[]}>;run():Promise<{meta?:{changes?:number};changes?:number|bigint}>};
export type CommunityDatabase={prepare(sql:string):Statement};
const decisions:Record<string,CommunityDecision>=DECISIONS;
const privateHeaders={'cache-control':'private, no-store',vary:'cookie'};
const category=(value:unknown)=>typeof value==='string' && Object.hasOwn(COMMUNITY_CATEGORIES,value);
const text=(value:unknown,min:number,max:number):value is string=>typeof value==='string' && value.trim().length>=min && value.trim().length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const ownerKey=async(user:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('internazionale-rossa:community:'+user)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const changed=(result:{meta?:{changes?:number};changes?:number|bigint})=>Number(result.meta?.changes??result.changes??0)>0;
const publicRow=(r:Row):CommunityProposal=>({id:String(r.id),title:String(r.title),body:String(r.body),references:String(r.references_text),category:r.category as CommunityProposal['category'],language:String(r.language),createdAt:Number(r.created_at),votes:{support:Number(r.support??0),oppose:Number(r.oppose??0),abstain:Number(r.abstain??0),total:Number(r.total??0)},decision:decisions[String(r.id)]??null});

export async function handleCommunity(request:Request,db:CommunityDatabase|undefined,userId:string|null,signInUrl='/?view=partecipa',decisionOverrides:Record<string,CommunityDecision>=decisions):Promise<Response>{
 const url=new URL(request.url), mine=url.pathname.endsWith('/mine');
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
 // This endpoint deliberately stays out of shared caches, including the public board.
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if((mine||request.method==='POST')&&!userId)return reply({authenticated:false,signInUrl},401);
 if(!db)return reply({error:'La partecipazione è temporaneamente non disponibile.'},503);
 const hidden=Object.entries(decisionOverrides).filter(([,d])=>d.status==='hidden').map(([id])=>id);
 const visibleSql=hidden.length?` AND p.id NOT IN (${hidden.map(()=>'?').join(',')})`:'';
 if(request.method==='GET'){
  try{
   if(mine){
    if([...url.searchParams.keys()].some(k=>k!=='ids')||url.searchParams.getAll('ids').length>1)return reply({error:'Invalid query'},400);
    const ids=(url.searchParams.get('ids')??'').split(',').filter(Boolean);
    if(ids.length>20||ids.some(id=>!proposalId(id)))return reply({error:'Invalid IDs'},400);
    if(!ids.length)return reply({authenticated:true,votes:{},own:[]});
    const key=await ownerKey(userId!);const slots=ids.map(()=>'?').join(',');
    const [votes,own]=await Promise.all([
     db.prepare(`SELECT proposal_id,value FROM community_votes WHERE voter_key=? AND proposal_id IN (${slots})`).bind(key,...ids).all(),
     db.prepare(`SELECT id FROM community_proposals WHERE owner_key=? AND withdrawn=0 AND id IN (${slots})`).bind(key,...ids).all(),
    ]);
    return reply({authenticated:true,votes:Object.fromEntries(votes.results.map(r=>[r.proposal_id,r.value])),own:own.results.map(r=>r.id)});
   }
   const allowed=['sort','offset','category','id'];
   if([...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length>1))return reply({error:'Invalid query'},400);
   const sort=url.searchParams.get('sort')??'latest',offset=Number(url.searchParams.get('offset')??0),scope=url.searchParams.get('category')??'all',id=url.searchParams.get('id');
   if(!['latest','support','participation'].includes(sort)||!Number.isSafeInteger(offset)||offset<0||offset>100000||(scope!=='all'&&!category(scope))||(id!==null&&!proposalId(id)))return reply({error:'Invalid query'},400);
   const conditions=scope==='all'?'':' AND p.category=?';
   const byId=id?' AND p.id=?':'';
   const rows=await db.prepare(`SELECT p.id,p.title,p.body,p.references_text,p.category,p.language,p.created_at,COALESCE(SUM(v.value=1),0) AS support,COALESCE(SUM(v.value=-1),0) AS oppose,COALESCE(SUM(v.value=0),0) AS abstain,COUNT(v.voter_key) AS total FROM community_proposals p LEFT JOIN community_votes v ON v.proposal_id=p.id WHERE p.withdrawn=0${visibleSql}${conditions}${byId} GROUP BY p.id ORDER BY ${sort==='support'?'support DESC,':sort==='participation'?'total DESC,':''}p.created_at DESC,p.id LIMIT 21 OFFSET ?`).bind(...hidden,...(scope==='all'?[]:[scope]),...(id?[id]:[]),offset).all();
   const items=rows.results.slice(0,20).map(publicRow).map(item=>({...item,decision:decisionOverrides[item.id]??null}));
   return reply({items,nextOffset:rows.results.length>20?offset+20:null});
  }catch{return reply({error:'Non è stato possibile caricare le proposte.'},503);}
 }
 if(mine)return reply({error:'Method not allowed'},405);
 if((request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Invalid origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON required'},415);
 let data:Record<string,unknown>;
 const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid input'},400);
 try{
  let bytes=0,raw='';const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>32000){await reader.cancel();return reply({error:'Payload too large'},413);}raw+=decoder.decode(value,{stream:true});}
  data=JSON.parse(raw+decoder.decode());
 }catch{return reply({error:'Invalid JSON'},400);}finally{reader.releaseLock();}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.hasOwn(data,'ownerKey')||Object.hasOwn(data,'userId'))return reply({error:'Invalid input'},400);
 try{
  const key=await ownerKey(userId!),now=Date.now();
  if(data.action==='propose'){
   if(!text(data.title,10,140)||!text(data.body,40,5000)||!text(data.references??'',0,1000)||!category(data.category)||typeof data.language!=='string'||!/^([a-z]{2,3})(-[a-zA-Z]{2,4})?$/.test(data.language))return reply({error:'Controlla titolo, testo, categoria e lingua.'},400);
   if(data.requestId!==undefined&&!proposalId(data.requestId))return reply({error:'Invalid request ID'},400);
   const id=typeof data.requestId==='string'?data.requestId:crypto.randomUUID();
   const result=await db.prepare('INSERT INTO community_proposals (id,owner_key,title,body,references_text,category,language,created_at,withdrawn) SELECT ?,?,?,?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM community_proposals WHERE owner_key=? AND created_at>?)<3 ON CONFLICT(id) DO NOTHING').bind(id,key,data.title.trim(),data.body.trim(),String(data.references??'').trim(),data.category,data.language,now,key,now-86400000).run();
   if(!changed(result)){
    const retry=await db.prepare('SELECT id,title,body,references_text,category,language,withdrawn FROM community_proposals WHERE id=? AND owner_key=?').bind(id,key).all();
    const previous=retry.results[0];
    if(previous&&previous.title===data.title.trim()&&previous.body===data.body.trim()&&previous.references_text===String(data.references??'').trim()&&previous.category===data.category&&previous.language===data.language&&!previous.withdrawn)return reply({ok:true,id},201);
    return reply({error:'Proposta non inviata: limite di tre proposte ogni 24 ore o identificatore già utilizzato. Le bozze restano nel modulo.'},429);
   }
   return reply({ok:true,id},201);
  }
  if(!proposalId(data.id))return reply({error:'Invalid proposal'},400);
  if(data.action==='withdraw'){
   const result=await db.prepare('UPDATE community_proposals SET withdrawn=1,title=?,body=?,references_text=? WHERE id=? AND owner_key=? AND withdrawn=0').bind('','','',data.id,key).run();
   return changed(result)?reply({ok:true}):reply({error:'Proposta non disponibile.'},404);
  }
  if(data.action!=='vote'||![1,-1,0,null].includes(data.value as number|null))return reply({error:'Invalid vote'},400);
  if(data.value===null){await db.prepare('DELETE FROM community_votes WHERE proposal_id=? AND voter_key=?').bind(data.id,key).run();return reply({ok:true});}
  const decision=decisionOverrides[data.id];if(decision&&decision.status!=='open')return reply({error:'La consultazione su questa proposta è chiusa.'},409);
  const exists=await db.prepare('SELECT id FROM community_proposals WHERE id=? AND withdrawn=0').bind(data.id).all();
  if(!exists.results.length)return reply({error:'Proposta non disponibile.'},404);

  const result=await db.prepare('INSERT INTO community_votes (proposal_id,voter_key,value,updated_at) SELECT id,?,?,? FROM community_proposals WHERE id=? AND withdrawn=0 ON CONFLICT(proposal_id,voter_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,data.value,now,data.id).run();
  return changed(result)?reply({ok:true}):reply({error:'Proposta non disponibile.'},404);
 }catch{return reply({error:'La modifica non è stata salvata. Riprova.'},503);}
}
