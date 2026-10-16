import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {initialState,applyAction,restoreState,summarize} from '../server/model.mjs';
import {openStore} from '../server/storage.mjs';
import {exportWorkbook} from '../server/export.mjs';
const seed=JSON.parse(await fs.readFile(new URL('../examples/demo-seed.json',import.meta.url),'utf8'));
const passageId='I01-T002', text=seed.interviews[0].turns[1].text;
const span=(codeId='C01',start=0,end=21)=>({type:'toggle-span',passageId,codeId,start,end,text:text.slice(start,end)});
test('exact evidence replaces unlocated coding, supports overlap and repeated text, counts once per passage',()=>{
 let s=initialState(seed);s=applyAction(s,seed,span());s=applyAction(s,seed,span('C01',49,70));s=applyAction(s,seed,span('C02',3,21));
 assert.equal(s.reviews[passageId].evidence.length,3);assert.equal(summarize(seed,s).codes[0].passages,1);
 s=applyAction(s,seed,span());assert.equal(s.reviews[passageId].evidence.length,2);assert.ok(s.reviews[passageId].codes.includes('C01'));
 s=applyAction(s,seed,{type:'remove-span',passageId,evidenceId:s.reviews[passageId].evidence.find(e=>e.codeId==='C01').id});
 assert.deepEqual(s.reviews[passageId].codes,['C02']);
});
test('rejects invented quotations, invalid ranges, split emoji and interviewer assignments',()=>{
 for(const a of [{...span(),text:'Invented'},span('C01',-1,3),span('C01',1,999),span('C01',2,2),span('C01',text.length-1,text.length),{...span(),passageId:'I01-T001'}]) assert.throws(()=>applyAction(initialState(seed),seed,a));
 assert.doesNotThrow(()=>applyAction(initialState(seed),seed,span('C01',text.length-2,text.length)));
});
test('changes revisit reviewed passages; archive, rename and dynamic Excel preserve evidence',async()=>{
 let s=applyAction(initialState(seed),seed,span());s=applyAction(s,seed,{type:'review',passageId,patch:{status:'reviewed'}});
 s=applyAction(s,seed,{type:'create-code',code:{name:'New code',definition:'Example',group:'RQ1'}});s=applyAction(s,seed,span('C03',0,21));
 assert.equal(s.reviews[passageId].status,'revisit');s=applyAction(s,seed,{type:'edit-code',code:{...s.codes[2],name:'Renamed code'}});
 const w=new ExcelJS.Workbook();await w.xlsx.load(await exportWorkbook(seed,s));
 assert.equal(w.getWorksheet('Evidence spans').getRow(3).getCell(4).value,'Renamed code');
 assert.equal(w.getWorksheet('Evidence spans').getRow(2).getCell(8).value,text.slice(0,21));
 assert.ok(w.getWorksheet('Coding').getRow(1).values.includes('C03 Renamed code'));
 s=applyAction(s,seed,{type:'archive-code',codeId:'C03'});assert.equal(s.reviews[passageId].evidence.length,2);
});
test('dated disk saves, reload and restore retain spans; corrupt snapshots are rejected',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ocis-evidence-'));
 try {const store=await openStore(dir,seed);const next=applyAction(store.state,seed,span());await store.save(store.state,next);
 const reloaded=await openStore(dir,seed);assert.deepEqual(reloaded.state.reviews,next.reviews);
 const list=await store.list();assert.match(list[0].filename,/T.*revision-000001/);
 const restored=await store.restore(next,list.find(s=>s.revision===0).filename);assert.equal(restored.revision,2);assert.equal(restored.reviews[passageId].evidence.length,0);
 const corrupt=structuredClone(next);corrupt.reviews[passageId].evidence[0].text='fabricated';assert.throws(()=>restoreState(next,seed,corrupt,'bad.json'));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
