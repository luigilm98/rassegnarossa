import test from 'node:test';
import assert from 'node:assert/strict';
import DATA from '../app/data/history-statistics.json' with {type:'json'};
import DECISIONS from '../app/data/community-decisions.json' with {type:'json'};
import {proposalId} from '../app/lib/community-model.ts';

test('historical annual snapshots retain complete dated series and a reproducible constant-price baseline',()=>{
 const rows=DATA.gdp.data;assert.equal(rows.length,47);assert.equal(rows[0].value,100);
 rows.forEach((point,index)=>{assert.equal(point.year,1978+index);assert.ok(Number.isFinite(point.constant2015USD)&&point.constant2015USD>0);assert.ok(Math.abs(point.value-point.constant2015USD/DATA.gdp.base*100)<.00051);});
 assert.ok(Math.abs(DATA.gdp.ratio-rows.at(-1).constant2015USD/DATA.gdp.base)<1e-9);
 assert.equal(DATA.health.series.length,4);
 for(const series of DATA.health.series){assert.equal(series.data.length,65);series.data.forEach((point,index)=>{assert.equal(point.year,1960+index);assert.ok(Number.isFinite(point.value)&&point.value>0&&point.value<100);});}
 assert.deepEqual(DATA.vietnam.data,[{year:2010,value:16.8},{year:2020,value:5}]);
 for(const item of [DATA.gdp,DATA.health,DATA.vietnam,...DATA.membership])assert.equal(new URL(item.source).protocol,'https:');
 assert.match(DATA.retrievedAt,/^\d{4}-\d{2}-\d{2}$/);assert.match(DATA.updatedAt,/^\d{4}-\d{2}-\d{2}$/);
 for(const item of DATA.membership)assert.ok(item.date&&item.publisher&&item.count>0);
});

test('public community decisions use valid IDs, public explanations and safe optional links',()=>{
 for(const [id,decision] of Object.entries(DECISIONS)){
 assert.ok(proposalId(id));assert.ok(['open','planned','implemented','declined','hidden'].includes(decision.status));assert.ok(typeof decision.reason==='string'&&decision.reason.trim());assert.match(decision.date,/^\d{4}-\d{2}-\d{2}$/);
 if(decision.url){const url=new URL(decision.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');}
 }
});
