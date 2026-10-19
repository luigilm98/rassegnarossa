import test from 'node:test';
import assert from 'node:assert/strict';
import {SOCIAL_ACHIEVEMENTS,ACHIEVEMENT_COUNTRIES,ACHIEVEMENT_THEMES,selectAchievements} from '../app/data/social-achievements.ts';
import HISTORY from '../app/data/history-dossiers.json' with {type:'json'};
import {HISTORY_INDEX,historyId,historyLink} from '../app/lib/history-navigation.ts';
import {THEORY_LIBRARY} from '../app/data/library.ts';

test('the social collection has sourced global coverage, unique records and usable country/topic intersections',()=>{
 assert.equal(ACHIEVEMENT_COUNTRIES.length,20);
 assert.equal(new Set(SOCIAL_ACHIEVEMENTS.map(item=>item.id)).size,SOCIAL_ACHIEVEMENTS.length);
 for(const region of ['Europa','Asia','Americhe','Africa'])assert.ok(SOCIAL_ACHIEVEMENTS.some(item=>item.region===region));
 for(const item of SOCIAL_ACHIEVEMENTS){const url=new URL(item.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.ok(item.movement&&item.source&&item.year&&item.text);}
 for(const country of ACHIEVEMENT_COUNTRIES)for(const theme of ACHIEVEMENT_THEMES){
   const results=selectAchievements(country,theme);
   assert.deepEqual(results,SOCIAL_ACHIEVEMENTS.filter(item=>item.country===country&&item.theme===theme));
 }
 assert.equal(selectAchievements('all','all').length,SOCIAL_ACHIEVEMENTS.length);
 assert.equal(selectAchievements('missing','all').length,0);
 for(const theme of ['Lavoro','Salute','Scuola','Diritti'])assert.ok(selectAchievements('Italia',theme).length);
});

test('every dossier chapter, timeline, metric and before/after comparison resolves to a specific document and real book edition',()=>{
 const ids=new Set(HISTORY.dossiers.map(item=>item.id));
 assert.equal(ids.size,HISTORY.dossiers.length);
 assert.deepEqual(HISTORY_INDEX.map(item=>item.id),[...ids]);
 for(const dossier of HISTORY.dossiers){
  const chapterIds=new Set();
  for(const section of dossier.sections){
   assert.ok(!chapterIds.has(section.id));chapterIds.add(section.id);
   assert.ok(section.paragraphs.length&&section.sources.length);
   for(const ref of section.sources)assert.ok(HISTORY.sources[ref],ref);
  }
  for(const item of [...dossier.timeline,...dossier.changes,...dossier.metrics])assert.ok(HISTORY.sources[item.source],item.source);
  for(const reading of dossier.readings)assert.ok(THEORY_LIBRARY.find(book=>book.id===reading.book)?.editions?.length,reading.book);
  for(const related of dossier.related)assert.ok(ids.has(related),related);
  assert.ok(dossier.minutes>0);
 }
 for(const source of Object.values(HISTORY.sources)){
  const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');
  assert.ok(source.publisher&&source.locator&&source.kind);
 }
});

test('dossier navigation accepts catalogue IDs only and creates stable shareable destinations',()=>{
 for(const item of HISTORY_INDEX){
  assert.equal(historyId(item.id),item.id);
  const target=new URL(historyLink(item.id),'https://example.test');
  assert.equal(target.origin,'https://example.test');
  assert.equal(historyId(target.searchParams.get('storia')),item.id);
 }
 for(const value of [null,undefined,'','missing','../italia','https://evil.example','<script>','ITALIA']){
  assert.equal(historyId(value),null);
  if(typeof value==='string')assert.equal(historyLink(value),'/');
 }
});
