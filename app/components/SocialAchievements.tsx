"use client";
import { lazy, Suspense, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ACHIEVEMENT_COUNTRIES, ACHIEVEMENT_THEMES, SOCIAL_ACHIEVEMENTS, selectAchievements } from '@/app/data/social-achievements';
import { LocalizedText } from './Localization';

const HistoricalStatistics = lazy(() => import('./HistoricalStatistics'));
const HistoricalDossiers = lazy(() => import('./HistoricalDossiers'));

export default function SocialAchievements() {
  const [country,setCountry] = useState('Italia');
  const [theme,setTheme] = useState('all');
  const [atlasOpen,setAtlasOpen] = useState(false);
  const results = selectAchievements(country,theme);
  return <div className="social-achievements" id="conquiste-sociali">
    <header className="achievements-intro">
      <p className="eyebrow"><LocalizedText>MEMORIA, DIRITTI, POSSIBILITÀ</LocalizedText></p>
      <h3><LocalizedText>Diritti, sviluppo e conquiste sociali.</LocalizedText></h3>
      <p><LocalizedText>Dalle lotte per studiare e lavorare con dignità alle trasformazioni di interi paesi. Una storia del contributo socialista, comunista, sindacale e popolare, attraverso dati, documenti e libri.</LocalizedText></p>
      <span>{ACHIEVEMENT_COUNTRIES.length} <LocalizedText>paesi</LocalizedText> · {SOCIAL_ACHIEVEMENTS.length} <LocalizedText>schede nell’atlante</LocalizedText></span>
    </header>
    <Suspense fallback={<p className="notice" role="status"><LocalizedText>Apertura dei grafici…</LocalizedText></p>}><HistoricalStatistics/></Suspense>
    <Suspense fallback={<p className="notice" role="status"><LocalizedText>Apertura degli approfondimenti…</LocalizedText></p>}><HistoricalDossiers/></Suspense>
    <details className="achievements-atlas" onToggle={event=>setAtlasOpen(event.currentTarget.open)}><summary><LocalizedText>Atlante delle conquiste</LocalizedText><span>20 <LocalizedText>paesi</LocalizedText> · 33 <LocalizedText>schede di consultazione</LocalizedText></span></summary>
    {atlasOpen && <>
    <div className="achievements-filters">
      <label><LocalizedText>Esplora un paese</LocalizedText><select value={country} onChange={event => setCountry(event.target.value)}><option value="all"><LocalizedText>Tutto il mondo</LocalizedText></option>{ACHIEVEMENT_COUNTRIES.map(name => <option key={name} value={name}><LocalizedText>{name}</LocalizedText></option>)}</select></label>
      <label><LocalizedText>Una conquista, un tema</LocalizedText><select value={theme} onChange={event => setTheme(event.target.value)}><option value="all"><LocalizedText>Tutti i temi</LocalizedText></option>{ACHIEVEMENT_THEMES.map(name => <option key={name} value={name}><LocalizedText>{name}</LocalizedText></option>)}</select></label>
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
    </>}
    </details>
    <p className="achievements-footnote"><LocalizedText>Raccolta tematica in ampliamento: celebra conquiste documentate e riconosce contributi diversi. I diritti scritti, la loro attuazione e i risultati misurati sono aspetti distinti. Apri i documenti e leggi i testi per approfondire.</LocalizedText></p>
  </div>;
}
