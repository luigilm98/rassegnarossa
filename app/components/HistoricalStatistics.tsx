"use client";
import {useState} from 'react';
import DATA from '@/app/data/history-statistics.json';
import {LocalizedText as T,useLocale} from './Localization';

const COLORS=['#b02a2a','#236957','#946219','#6c7280'];
type Point={year:number;value:number};
function LineChart({series,maximum,unit}:{series:{label:string;data:Point[]}[];maximum:number;unit:string}) {
  const first=series[0].data[0].year,last=series[0].data.at(-1)!.year;
  const x=(year:number)=>60+(year-first)/(last-first)*760,y=(value:number)=>255-value/maximum*225;
  return <svg className="history-chart" viewBox="0 0 850 300" role="img" aria-label={`${series.map(item=>item.label).join(', ')}: ${first}–${last}; ${unit}`}>
    <title>{series.map(item=>item.label).join(', ')} · {first}–{last}</title>
    {[0,1,2,3].map(step=>{const value=maximum*step/3;return <g key={step}><line x1="60" x2="820" y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".15"/><text x="49" y={y(value)+5} textAnchor="end">{Math.round(value)}</text></g>;})}
    {[first,Math.round((first+last)/2),last].map(year=><text key={year} x={x(year)} y="282" textAnchor="middle">{year}</text>)}
    {series.map((item,index)=><path key={item.label} d={item.data.map((point,i)=>`${i?'L':'M'}${x(point.year).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ')} fill="none" stroke={COLORS[index]} strokeWidth="3" strokeLinejoin="round"/>)}
  </svg>;
}
export default function HistoricalStatistics(){
  const [selected,setSelected]=useState<'gdp'|'poverty'|'health'>('gdp');
  const locale=useLocale();
  const number=(value:number,digits=1)=>new Intl.NumberFormat(locale,{maximumFractionDigits:digits}).format(value);
  const [year,setYear]=useState(2024);
  const health=DATA.health.series;
  return <section className="history-statistics" aria-labelledby="history-statistics-title">
    <header><p className="eyebrow"><T>RISULTATI DA MISURARE</T></p><h3 id="history-statistics-title"><T>Le trasformazioni, in numeri.</T></h3><p><T>Crescita, povertà e salute raccontano aspetti diversi della vita di un paese. Qui puoi seguirne l’andamento e consultare i dati originali.</T></p></header>
    <div className="history-chart-tabs" role="group" aria-label="Scegli un indicatore">
      {([['gdp','Cina · crescita reale'],['poverty','Vietnam · povertà'],['health','Salute · confronto']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={selected===id} onClick={()=>setSelected(id)}><T>{label}</T></button>)}
    </div>
    {selected==='gdp'&&<div className="history-chart-panel">
      <div className="history-chart-stat"><strong>×{number(DATA.gdp.ratio)}</strong><div><h4><T>Il PIL reale della Cina, dal 1978 al 2024</T></h4><p><T>Il valore complessivo della produzione, al netto dell’inflazione, è diventato circa cinquanta volte quello iniziale.</T></p></div></div>
      <LineChart series={[{label:'Cina',data:DATA.gdp.data}]} maximum={6000} unit="Indice: 1978 = 100"/>
      <p className="history-chart-caption"><T>Indice 1978 = 100. PIL totale a prezzi costanti del 2015, non PIL per abitante. Tutte le 47 osservazioni annuali sono incluse.</T></p>
      <p><T>La serie attraversa le riforme avviate nel 1978, la trasformazione industriale e l’espansione degli scambi. Misura la crescita della produzione; da sola non ne separa le cause e non descrive la distribuzione del reddito.</T></p>
      <a href={DATA.gdp.source} target="_blank" rel="noopener noreferrer"><T>Fonte: Banca Mondiale · PIL reale</T> ↗</a>
      <details><summary><T>Consulta i dati annuali</T></summary><div className="history-data-table"><table><caption><T>Cina · indice del PIL reale, 1978 = 100</T></caption><thead><tr><th><T>Anno</T></th><th><T>Indice</T></th></tr></thead><tbody>{DATA.gdp.data.map(point=><tr key={point.year}><th scope="row">{point.year}</th><td>{number(point.value,3)}</td></tr>)}</tbody></table></div></details>
    </div>}
    {selected==='poverty'&&<div className="history-chart-panel">
      <div className="history-chart-stat"><strong>16,8% → 5%</strong><div><h4><T>Vietnam: la riduzione della povertà tra 2010 e 2020</T></h4><p><T>Circa dieci milioni di persone sono uscite dalla povertà secondo la soglia utilizzata nel rapporto della Banca Mondiale.</T></p></div></div>
      <div className="history-poverty-bars">{DATA.vietnam.data.map(point=><div key={point.year}><strong>{point.year}</strong><span><i style={{width:`${point.value/20*100}%`}}/></span><b>{number(point.value)}%</b></div>)}</div>
      <p className="history-chart-caption"><T>Quota della popolazione sotto 3,20 dollari al giorno, a parità di potere d’acquisto del 2011. Il calo è di 11,8 punti percentuali, pari a circa il 70% del tasso iniziale. Sono due osservazioni, non una serie annuale.</T></p>
      <p><T>La soglia appartiene al rapporto del 2022. Non va confrontata direttamente con le soglie successive espresse a prezzi e parità di potere d’acquisto differenti.</T></p>
      <a href={DATA.vietnam.source} target="_blank" rel="noopener noreferrer"><T>Fonte: Banca Mondiale · rapporto sulla povertà in Vietnam, 2022</T> ↗</a>
    </div>}
    {selected==='health'&&<div className="history-chart-panel">
      <h4><T>Aspettativa di vita: Cina, Vietnam, Cuba e media mondiale</T></h4>
      <LineChart series={health} maximum={90} unit="Anni di vita alla nascita"/>
      <div className="history-chart-legend">{health.map((item,index)=><span key={item.id}><i style={{background:COLORS[index]}}/><T>{item.label}</T></span>)}</div>
      <label className="history-year"><T>Esplora un anno</T><input type="range" min="1960" max="2024" value={year} onChange={event=>setYear(Number(event.target.value))}/><output>{year}</output></label>
      <div className="history-year-values" aria-live="polite">{health.map(item=><span key={item.id}><T>{item.label}</T><strong>{number(item.data.find(point=>point.year===year)!.value)} <T>anni</T></strong></span>)}</div>
      <p className="history-chart-caption"><T>Aspettativa di vita alla nascita, in anni. Sono presenti tutti gli anni dal 1960 al 2024, comprese le flessioni. Stime demografiche della Banca Mondiale basate sulle serie delle Nazioni Unite.</T></p>
      <p><T>L’indicatore risente di sanità, nutrizione, reddito, conflitti e crisi. Il confronto mostra risultati e differenze nel tempo; non isola l’effetto di un solo sistema politico.</T></p>
      <a href={DATA.health.source} target="_blank" rel="noopener noreferrer"><T>Fonte: Banca Mondiale · aspettativa di vita</T> ↗</a>
      <details><summary><T>Consulta tutti i dati</T></summary><div className="history-data-table"><table><caption><T>Aspettativa di vita alla nascita · anni</T></caption><thead><tr><th><T>Anno</T></th>{health.map(item=><th key={item.id}><T>{item.label}</T></th>)}</tr></thead><tbody>{health[0].data.map((point,index)=><tr key={point.year}><th scope="row">{point.year}</th>{health.map(item=><td key={item.id}>{number(item.data[index].value,2)}</td>)}</tr>)}</tbody></table></div></details>
    </div>}
    <p className="history-chart-caption"><T>Serie annuali aggiornate dalla Banca Mondiale l’8 ottobre 2026; dati acquisiti il 19 ottobre 2026.</T></p>
    <details className="history-membership"><summary><T>Partiti nel mondo: gli iscritti dichiarati</T></summary><p><T>Gli iscritti non coincidono con gli attivisti effettivi, gli elettori o il consenso dell’intera popolazione. Le organizzazioni applicano criteri diversi: questi dati hanno date e fonti proprie e non costituiscono una classifica di efficacia.</T></p><div className="history-data-table"><table><caption><T>Iscritti secondo le fonti indicate</T></caption><thead><tr><th><T>Partito</T></th><th><T>Iscritti</T></th><th><T>Data del dato</T></th><th><T>Fonte</T></th></tr></thead><tbody>{DATA.membership.map(item=><tr key={item.party}><th scope="row"><T>{item.party}</T><small><T>{item.country}</T></small></th><td><T>{item.display}</T></td><td><T>{item.date}</T></td><td><a href={item.source} target="_blank" rel="noopener noreferrer">{item.publisher} ↗</a></td></tr>)}</tbody></table></div></details>
  </section>;
}
