export type ReaderBlock = { type: "p" | "h2" | "h3"; text: string };
export type ReaderChapter = { title: string; url: string };
// Complete HTML5 named references, generated from Python html.entities.html5.
import namedEntities from "./html-entities.json" with { type: "json" };
const entities: Record<string, string> = namedEntities;
export function readerText(value: string) {
 return value.replace(/<[^>]*>/g," ").replace(/&(#x[\da-f]+|#\d+|[a-z][a-z0-9]+);/gi,(whole,key:string)=>{
  if(key.startsWith("#")){const n=key[1].toLowerCase()==="x"?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):"�";}
  return Object.hasOwn(entities,key)?entities[key]:whole;
 }).replace(/\s+/g," ").trim();
}
export function parseReaderPage(html: string): ReaderBlock[] {
 let clean=html.replace(/<!doctype[^>]*>/gi,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|footer|header|form|iframe|noscript|svg|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"");
 // AmuseWiki and WordPress publish the actual text in these containers.
 const start=clean.search(/<(?:div|article)\b[^>]*(?:id=["'](?:thework|main-text|wpb-content-root)|class=["'][^"']*entry-content)/i);
 if(start>=0) clean=clean.slice(start);
 const blocks: ReaderBlock[]=[];
 const tags=new Set(["p","h1","h2","h3","h4","li","blockquote","pre","div","br","hr"]);
 let text="",type:ReaderBlock["type"]="p";
 const flush=()=>{const value=readerText(text);if(value)blocks.push({type,text:value});text="";type="p";};
 for(const token of clean.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>|([^<]+)/gi)) {
  if(token[2]){text+=token[2];continue;}
  const tag=token[1].toLowerCase();
  if(tags.has(tag)){flush();if(!token[0].startsWith("</")&&/^h[1-4]$/.test(tag))type=tag==="h1"||tag==="h2"?"h2":"h3";}
  else if(["td","tr","table"].includes(tag)) text+=" ";
 }
 flush();return blocks;
}
export function paginateBook(blocks: ReaderBlock[], size=3200): ReaderBlock[][] {
 const pages: ReaderBlock[][]=[];let page:ReaderBlock[]=[],length=0;
 for(const block of blocks) {
  // Long paragraphs are split on whitespace; languages without spaces retain Unicode code points.
  const parts=block.text.length>size?block.text.match(new RegExp(`[^]{1,${size}}(?:\\s|$)|[^]{1,${size}}`,"gu"))??[block.text]:[block.text];
  for(const part of parts){if(length+part.length>size&&page.length){pages.push(page);page=[];length=0;}page.push({...block,text:part.trim()});length+=part.length;}
 }
 if(page.length)pages.push(page);return pages;
}
export function readerChapters(html:string, root:string):ReaderChapter[] {
 const base=new URL(root);const title=readerText(html.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1]??"Testo integrale");
 const indexPath=/(?:\/(?:index|toc|sommaire|contents|inhalt)[^/]*\.(?:html?|xhtml)|\/)$/i.test(base.pathname);
 const prefix=base.pathname.endsWith("/")?base.pathname:base.pathname.slice(0,base.pathname.lastIndexOf("/")+1);
 const chapters:ReaderChapter[]=[];const seen=new Set<string>();
 for(const a of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)){
  try{const url=new URL(a[1].replace(/&amp;/g,"&"),base);url.hash="";
   const label=readerText(a[2]);
   if(url.origin!==base.origin||!url.pathname.startsWith(prefix)||url.pathname===base.pathname||! /\.(?:html?|xhtml)$/i.test(url.pathname)||url.search||!label||seen.has(url.href)||/^(?:index|home|archive|marxists|next|previous|back|copyright)/i.test(label))continue;
   seen.add(url.href);chapters.push({title:label.slice(0,220),url:url.href});if(chapters.length>=256)break;
  }catch{/* Ignore malformed or external links. */}
 }
 const shortContents=chapters.length>=3&&parseReaderPage(html).reduce((n,block)=>n+block.text.length,0)<12000;
 return chapters.length&&(indexPath||shortContents)?chapters:[{title,url:base.href}];
}

export function sectionReaderBook(blocks:ReaderBlock[]):ReaderBlock[][] {
 if(blocks.filter(block=>block.type==="h2").length<3||blocks.reduce((n,block)=>n+block.text.length,0)<12000)return[blocks];
 const sections:ReaderBlock[][]=[];let section:ReaderBlock[]=[];
 for(const block of blocks){if(block.type==="h2"&&section.length&&sections.length<254){sections.push(section);section=[];}section.push(block);}
 if(section.length)sections.push(section);return sections;
}

/** Legacy archives include pre-UTF-8 editions; never silently replace their accented characters. */
export function decodeBookHtml(bytes:Uint8Array, contentType:string, language:string):string {
 const prefix=new TextDecoder().decode(bytes.subarray(0,3000));
 const declared=prefix.match(/charset\s*=\s*["']?([^\s"'>;]+)/i)?.[1]??contentType.match(/charset=([^;\s]+)/i)?.[1];
 if(declared&&!/^utf-?8$/i.test(declared)){try{return new TextDecoder(declared).decode(bytes);}catch{/* Check UTF-8 before choosing a legacy fallback. */}}
 try{return new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{
  const encodings:Record<string,string>={ru:"windows-1251",uk:"windows-1251",bg:"windows-1251",mk:"windows-1251",el:"windows-1253",pl:"windows-1250",cs:"windows-1250",sk:"windows-1250",sl:"windows-1250",hu:"windows-1250",ro:"windows-1250",lt:"windows-1257",ar:"windows-1256",fa:"windows-1256",he:"windows-1255",zh:"gb18030",ko:"euc-kr",th:"windows-874",vi:"windows-1258"};
  try{return new TextDecoder(encodings[language]??"windows-1252").decode(bytes);}catch{return new TextDecoder().decode(bytes);}
 }
}
