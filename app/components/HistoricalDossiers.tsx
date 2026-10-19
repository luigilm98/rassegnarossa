"use client";
import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, BookOpen, Clock} from 'lucide-react';
import DATA from '@/app/data/history-dossiers.json';
import {HISTORY_INDEX,historyId,historyLink} from '@/app/lib/history-navigation';
import {THEORY_LIBRARY} from '@/app/data/library';
import {LocalizedText as T,useLocale} from './Localization';

type HistoricalSource = typeof DATA.sources[keyof typeof DATA.sources];
const sources: Record<string,HistoricalSource> = DATA.sources;
function SourceLinks({ids}: {ids:string[]}) {
  return <p className="history-citations">{[...new Set(ids)].map(id => {const source=sources[id];return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.locator}><T defer>{source.publisher}</T><span> · <T defer>{source.locator || source.title}</T></span><ArrowUpRight size={12}/></a> : null;})}</p>;
}
export default function HistoricalDossiers() {
  const [selected,setSelected] = useState('italia');
  const heading = useRef<HTMLHeadingElement>(null);
  const locale = useLocale();
  useEffect(() => {
    const sync=()=>{const id=historyId(new URL(location.href).searchParams.get('storia'));if(id)setSelected(id);};
    sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);
  },[]);
  const choose = (id:string) => {
    if(!historyId(id))return;
    setSelected(id);
    const url=new URL(location.href);url.searchParams.set('storia',id);
    history.replaceState(history.state,'',url);
    requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'auto'});});
  };
  const dossier = DATA.dossiers.find(item => item.id === selected) ?? DATA.dossiers[0];
  const bibliography=[...new Set([...dossier.sections.flatMap(item=>item.sources),...dossier.timeline.map(item=>item.source),...dossier.changes.map(item=>item.source),...dossier.metrics.map(item=>item.source)])];
  return <section className="history-dossiers" aria-label="Approfondimenti storici">
    <label className="history-dossier-select"><span><T>Scegli un approfondimento storico</T></span><select value={selected} onChange={event=>choose(event.target.value)}>{HISTORY_INDEX.map(item=><option key={item.id} value={item.id}><T>{item.country}</T> · <T>{item.title}</T></option>)}</select></label>
    <article className="history-article" key={dossier.id} aria-labelledby="history-article-title">
      <header className="history-article-header"><p className="eyebrow"><T>{dossier.country}</T> / <T>{dossier.period}</T></p><h3 id="history-article-title" ref={heading} tabIndex={-1}><T>{dossier.title}</T></h3><p className="history-deck"><T>{dossier.deck}</T></p><p className="history-article-meta"><span><Clock size={14}/>{dossier.minutes} <T>min di lettura circa</T></span><a href={historyLink(dossier.id)}><T>Link a questo dossier</T><ArrowUpRight size={14}/></a></p><p className="history-intro"><T>{dossier.intro}</T></p></header>
      {dossier.metrics.length>0 && <div className="history-metrics">{dossier.metrics.map(metric=><div key={metric.label}><strong><T defer>{metric.value}</T></strong><h4><T defer>{metric.label}</T></h4><p><T defer>{metric.note}</T></p><SourceLinks ids={[metric.source]}/></div>)}</div>}
      <div className="history-article-layout">
        <details className="history-outline"><summary><T>Indice del dossier</T></summary><ol>{dossier.sections.map(section=><li key={section.id}><a href={`#${dossier.id}-${section.id}`}><T defer>{section.title}</T></a></li>)}</ol><a href={`#${dossier.id}-cronologia`}><T>Cronologia</T></a><a href={`#${dossier.id}-documenti`}><T>Documenti e fonti</T></a></details>
        <div className="history-prose">
          {dossier.sections.map((section,index)=><section id={`${dossier.id}-${section.id}`} key={section.id}><span className="history-chapter-number">{String(index+1).padStart(2,'0')}</span><h4><T defer>{section.title}</T></h4>{section.paragraphs.map((paragraph,i)=><p key={i}><T defer>{paragraph}</T></p>)}<SourceLinks ids={section.sources}/></section>)}
          <section className="history-changes"><h4><T>Che cosa cambia</T></h4><div className="history-change-heading" aria-hidden="true"><span><T>La condizione di partenza</T></span><span><T>La trasformazione</T></span></div>{dossier.changes.map((change,index)=><div className="history-change" key={index}><p><small><T>Prima</T></small><T defer>{change.before}</T></p><p><small><T>Il cambiamento</T></small><T defer>{change.after}</T></p><SourceLinks ids={[change.source]}/></div>)}</section>
          <section id={`${dossier.id}-cronologia`} className="history-timeline"><h4><T>Le tappe</T></h4><ol>{dossier.timeline.map((event,index)=><li key={index}><strong><T defer>{event.date}</T></strong><div><p><T defer>{event.text}</T></p><SourceLinks ids={[event.source]}/></div></li>)}</ol></section>
          {dossier.readings.length>0 && <section className="history-readings"><h4><T>Dalla storia ai libri</T></h4>{dossier.readings.map(reading=>{
            const book=THEORY_LIBRARY.find(item=>item.id===reading.book);
            const edition=book?.editions?.find(item=>item.language===locale)??book?.editions?.find(item=>item.language==='en')??book?.editions?.[0];
            if(!book||!edition)return null;
            return <a key={book.id} href={`/read?${new URLSearchParams({book:book.id,edition:edition.language})}`}><BookOpen size={23}/><span><small>{book.author}</small><strong><T defer>{book.title}</T></strong><p><T defer>{reading.why}</T></p></span><ArrowUpRight size={18}/></a>;
          })}</section>}
          <section id={`${dossier.id}-documenti`} className="history-bibliography"><h4><T>Documenti e fonti del dossier</T></h4><ol>{bibliography.map(id=>{const source=sources[id];return <li key={id}><span className="eyebrow"><T defer>{source.kind}</T>{source.date&&<> · {source.date}</>}</span><a href={source.url} target="_blank" rel="noopener noreferrer"><T defer>{source.title}</T><ArrowUpRight size={14}/></a><p><T defer>{source.publisher}</T> · <T defer>{source.locator}</T></p></li>;})}</ol></section>
          <nav className="history-related" aria-label="Altri approfondimenti"><p className="eyebrow"><T>CONTINUA IL PERCORSO</T></p>{dossier.related.map(id=>{const next=HISTORY_INDEX.find(item=>item.id===id);return next?<button key={id} type="button" onClick={()=>choose(id)}><span><T defer>{next.title}</T></span><ArrowUpRight size={18}/></button>:null;})}</nav>
        </div>
      </div>
    </article>
  </section>;
}
