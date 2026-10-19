"use client";
import { useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ACHIEVEMENT_COUNTRIES, ACHIEVEMENT_THEMES, SOCIAL_ACHIEVEMENTS, SOCIAL_DOSSIERS, selectAchievements } from '@/app/data/social-achievements';
import { THEORY_LIBRARY } from '@/app/data/library';
import { LocalizedText, useLocale } from './Localization';

export default function SocialAchievements() {
  const [country,setCountry] = useState('Italia');
  const [theme,setTheme] = useState('all');
  const [dossier,setDossier] = useState<string | null>(null);
  const language = useLocale();
  const results = selectAchievements(country,theme);
  const readLink = (id: string) => {
    const book = THEORY_LIBRARY.find(item => item.id === id);
    const edition = book?.editions?.find(item => item.language === language) ?? book?.editions?.find(item => item.language === 'en') ?? book?.editions?.[0];
    return edition && book ? {title:book.title,url:`/read?${new URLSearchParams({book:id,edition:edition.language})}`} : null;
  };
  return <div className="social-achievements" id="conquiste-sociali">
    <header className="achievements-intro">
      <p className="eyebrow"><LocalizedText>MEMORIA, DIRITTI, POSSIBILITÀ</LocalizedText></p>
      <h3><LocalizedText>Le conquiste che fanno vivere meglio.</LocalizedText></h3>
      <p><LocalizedText>Una vetrina delle conquiste socialiste, comuniste, sindacali e popolari: tempo liberato, sapere condiviso, cure e dignità. Le vittorie nascono da persone, movimenti e alleanze. Qui ne celebriamo il contributo, con documenti da leggere e idee da portare nel presente.</LocalizedText></p>
      <span>{ACHIEVEMENT_COUNTRIES.length} <LocalizedText>paesi</LocalizedText> · {SOCIAL_ACHIEVEMENTS.length} <LocalizedText>storie documentate</LocalizedText></span>
    </header>
    <div className="achievements-filters">
      <label><LocalizedText>Esplora un paese</LocalizedText><select value={country} onChange={event => setCountry(event.target.value)}><option value="all">🌍 Tutto il mondo</option>{ACHIEVEMENT_COUNTRIES.map(name => <option key={name}>{name}</option>)}</select></label>
      <label><LocalizedText>Una conquista, un tema</LocalizedText><select value={theme} onChange={event => setTheme(event.target.value)}><option value="all">Tutti i temi</option>{ACHIEVEMENT_THEMES.map(name => <option key={name}>{name}</option>)}</select></label>
      <p aria-live="polite">{results.length} <LocalizedText>schede</LocalizedText></p>
    </div>
    <div className="achievements-grid">
      {results.map(item => <article className="achievement-card" key={item.id}>
        <p className="eyebrow"><LocalizedText defer>{item.country}</LocalizedText> · <LocalizedText defer>{item.theme}</LocalizedText></p>
        <span className="achievement-year"><LocalizedText defer>{item.year}</LocalizedText></span>
        <h4><LocalizedText defer>{item.title}</LocalizedText></h4>
        <p><LocalizedText defer>{item.text}</LocalizedText></p>
        <p className="achievement-movement"><LocalizedText defer>{item.movement}</LocalizedText></p>
        <a href={item.url} target="_blank" rel="noopener noreferrer"><LocalizedText defer>{item.source}</LocalizedText><ArrowUpRight size={15}/></a>
      </article>)}
    </div>
    {!results.length && <p className="notice"><LocalizedText>Non ci sono ancora schede per questo incrocio. Scegli un altro tema o esplora tutto il mondo.</LocalizedText></p>}
    <section className="social-dossiers" aria-labelledby="social-dossier-title">
      <p className="eyebrow"><LocalizedText>ANDARE ALLE RADICI</LocalizedText></p>
      <h3 id="social-dossier-title"><LocalizedText>Tre percorsi per capire e approfondire</LocalizedText></h3>
      {SOCIAL_DOSSIERS.map(item => <details key={item.id} open={dossier === item.id} onToggle={event => {
        if(event.currentTarget.open) setDossier(item.id);
        else setDossier(current => current === item.id ? null : current);
      }}>
        <summary><span><strong><LocalizedText defer>{item.title}</LocalizedText></strong><small><LocalizedText defer>{item.subtitle}</LocalizedText></small></span><BookOpen size={20}/></summary>
        {dossier === item.id && <div className="social-dossier-body">
          {item.paragraphs.map((paragraph,index) => <p key={index}><LocalizedText defer>{paragraph}</LocalizedText></p>)}
          <div className="social-reading-links">{item.books.map(id => {const link=readLink(id);return link ? <a key={id} href={link.url}><BookOpen size={16}/><LocalizedText defer>{link.title}</LocalizedText><ArrowUpRight size={15}/></a> : null;})}</div>
          <div className="social-source-links">{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><LocalizedText defer>{source.label}</LocalizedText><ArrowUpRight size={14}/></a>)}</div>
        </div>}
      </details>)}
    </section>
    <p className="achievements-footnote"><LocalizedText>Raccolta tematica in ampliamento: celebra conquiste documentate e riconosce contributi diversi. I diritti scritti, la loro attuazione e i risultati misurati sono aspetti distinti. Apri i documenti e leggi i testi per approfondire.</LocalizedText></p>
  </div>;
}
