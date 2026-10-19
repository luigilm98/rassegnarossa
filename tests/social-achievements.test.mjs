import test from 'node:test';
import assert from 'node:assert/strict';
import {SOCIAL_ACHIEVEMENTS,ACHIEVEMENT_COUNTRIES,ACHIEVEMENT_THEMES,SOCIAL_DOSSIERS,selectAchievements} from '../app/data/social-achievements.ts';
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

test('historical dossiers link to actual readable editions and distinguish political periods and evidence',()=>{
 assert.equal(SOCIAL_DOSSIERS.length,3);
 for(const dossier of SOCIAL_DOSSIERS){
   assert.ok(dossier.paragraphs.length>=3&&dossier.sources.length>=2);
   for(const id of dossier.books)assert.ok(THEORY_LIBRARY.find(book=>book.id===id)?.editions?.length,id);
   for(const source of dossier.sources)assert.equal(new URL(source.url).protocol,'https:');
 }
 const cultural=SOCIAL_DOSSIERS.find(item=>item.id==='rivoluzione-culturale');
 assert.match(cultural.subtitle,/1966–1976/);
 assert.match(cultural.paragraphs.join(' '),/1981/);
 assert.match(cultural.paragraphs.join(' '),/non sono conquiste sociali/);
 assert.match(SOCIAL_ACHIEVEMENTS.find(item=>item.id==='cn-poverta').text,/1,90.*2011/);
});
