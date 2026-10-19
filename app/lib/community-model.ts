export const COMMUNITY_CATEGORIES = {
  sources:'Fonti e giornalismo', news:'Notizie e linea editoriale', library:'Libri e formazione',
  history:'Storia e dossier', design:'Pagine e accessibilità', translations:'Lingue e traduzioni',
  governance:'Regole e partecipazione', other:'Altre proposte',
};
export type CommunityCategory = keyof typeof COMMUNITY_CATEGORIES;
export type CommunityDecision = {status:'open'|'planned'|'implemented'|'declined'|'hidden';reason:string;date:string;url?:string};
export type CommunityProposal = {id:string;title:string;body:string;references:string;category:CommunityCategory;language:string;createdAt:number;votes:{support:number;oppose:number;abstain:number;total:number};decision:CommunityDecision|null};
export const proposalId = (value:unknown): value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function proposalParagraphs(text:string):string[]{
 const paragraphs:string[]=[];
 for(const paragraph of text.split(/\n\s*\n/))for(let offset=0;offset<paragraph.length;offset+=1800)paragraphs.push(paragraph.slice(offset,offset+1800));
 return paragraphs;
}
