import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {tempRoot} from '../../engine/temp-root.mjs';
import {collectRuleCatalog,collectPackageRuleClaims,generateRuleCatalog} from '../../packages/grammar/scripts/generate-rule-catalog.mjs';

const directories=['ui/composition','ui/presentation','ui/proof','grammars/starci'];
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(tempRoot(),'starci-rule-catalog-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const knowledgeDir=path.join(root,'knowledge'),packageRoot=path.join(root,'package');
  for(const relative of directories)fs.mkdirSync(path.join(knowledgeDir,relative),{recursive:true});
  fs.mkdirSync(path.join(packageRoot,'src','core'),{recursive:true});
  return {knowledgeDir,packageRoot,target:path.join(packageRoot,'catalog.ts')};
};
const topic=(f,relative,body)=>fs.writeFileSync(path.join(f.knowledgeDir,relative),'schema: starci/knowledge-source@1\n'+body);
const consumer=(f,name,body)=>{
  const file=path.join(f.packageRoot,'src',name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
};
const published=ids=>'export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze('+JSON.stringify(ids)+')\n';

test('YAML declarations preserve sparse addresses and ignore scale rows, cases, references and retired notes',t=>{
  const f=fixture(t);
  topic(f,'ui/composition/state.yaml','rules:\n  - id: STATE-1\n    closed: STATE-4 is spent, never reused\n    cases:\n      - id: STATE-4\n        when: a case id is not a declaration\n        assert: do not publish it\n  - id: STATE-8\nscale:\n  steps:\n    - id: STATE-4\nguidance:\n  - id: NOT-A-RULE-1\ncomponentOwnership:\n  rows:\n    - rule: NOT-A-RULE-2\n');
  topic(f,'ui/presentation/margin.yaml','rules:\n  - id: MARGIN-0\n  - id: MARGIN-AUTO\n');
  topic(f,'ui/presentation/radius.yaml','rules:\n  - id: RADIUS-2\n  - id: RADIUS-6\n  - id: RADIUS-9\n');
  fs.writeFileSync(path.join(f.knowledgeDir,'ui/composition','legacy.md'),'## STATE-4\n');
  consumer(f,'core/render.tsx','const contract = ["STATE-8", "MARGIN-AUTO"];\nexport const render = () => <div data-contract="STATE-1 RADIUS-6" />;\n');
  fs.writeFileSync(f.target,published(['STATE-1']));
  const catalog=generateRuleCatalog(f);
  assert.deepEqual(new Set(catalog.ids),new Set(['STATE-1','STATE-8','MARGIN-0','MARGIN-AUTO','RADIUS-2','RADIUS-6','RADIUS-9']));
  assert.deepEqual(catalog.retiredIds,[]);
  assert.deepEqual(new Set(catalog.addedIds),new Set(['STATE-8','MARGIN-0','MARGIN-AUTO','RADIUS-2','RADIUS-6','RADIUS-9']));
  assert.doesNotMatch(fs.readFileSync(f.target,'utf8'),/STATE-4|RADIUS-3|NOT-A-RULE/);
  assert.deepEqual(new Set(collectPackageRuleClaims(f).map(row=>row.id)),new Set(['STATE-8','MARGIN-AUTO','STATE-1','RADIUS-6']));
  const first=fs.readFileSync(f.target,'utf8');
  const second=generateRuleCatalog(f);
  assert.equal(second.changed,false);
  assert.deepEqual(second.retiredIds,[]);
  assert.deepEqual(second.addedIds,[]);
  assert.equal(fs.readFileSync(f.target,'utf8'),first);
});

test('mixed-prefix topics and a family split across topics retain actual source ownership',t=>{
  const f=fixture(t);
  topic(f,'ui/proof/contrast.yaml','rules:\n  - id: COLOR-3\n  - id: COLOR-5\n  - id: CONTRAST-1\n');
  topic(f,'ui/proof/more.yaml','rules:\n  - id: CONTRAST-7\n');
  assert.deepEqual(collectRuleCatalog(f).families,[
    {family:'COLOR',ids:['COLOR-3','COLOR-5'],sources:['ui/proof/contrast.yaml']},
    {family:'CONTRAST',ids:['CONTRAST-1','CONTRAST-7'],sources:['ui/proof/contrast.yaml','ui/proof/more.yaml']},
  ]);
});

test('retiring an id refuses the write until its literal and computed consumer claims are migrated',t=>{
  const f=fixture(t);
  topic(f,'ui/composition/coverage.yaml','rules:\n  - id: COVERAGE-1\n');
  const before=published(['STATE-4']);
  fs.writeFileSync(f.target,before);
  consumer(f,'core/render.tsx','const computed = ["STATE-4"];\nexport const render = () => <div data-contract="STATE-4" />;\n');
  assert.throws(()=>generateRuleCatalog(f),/no current declaration: STATE-4 \(src\/core\/render.tsx\)/);
  assert.equal(fs.readFileSync(f.target,'utf8'),before);
  consumer(f,'core/render.tsx','const computed = ["COVERAGE-1"];\nexport const render = () => <div data-contract="COVERAGE-1" />;\n');
  const result=generateRuleCatalog(f);
  assert.deepEqual(result.retiredIds,['STATE-4']);
  assert.deepEqual(result.addedIds,['COVERAGE-1']);
  assert.doesNotMatch(fs.readFileSync(f.target,'utf8'),/STATE-4/);
});

test('unknown production claims refuse a first catalog without trusting known family prefixes',t=>{
  const f=fixture(t);
  topic(f,'ui/composition/state.yaml','rules:\n  - id: STATE-8\n');
  consumer(f,'core/render.tsx','export const render = () => <div data-contract="INVENTED-1" />;\n');
  assert.throws(()=>generateRuleCatalog(f),/INVENTED-1 \(src\/core\/render.tsx\)/);
  assert.equal(fs.existsSync(f.target),false);
});

test('comments, examples and test modules do not pose as production consumer claims',t=>{
  const f=fixture(t);
  topic(f,'ui/composition/state.yaml','rules:\n  - id: STATE-8\n');
  consumer(f,'core/render.tsx','// "COMMENT-1"\n/* data-contract="COMMENT-2" */\nexport const render = () => <div data-contract="STATE-8" />;\n');
  for(const name of ['core/render.spec.tsx','stories/example.tsx','__test__/fixture.tsx'])consumer(f,name,'const example = "EXAMPLE-1";\n');
  assert.deepEqual(collectPackageRuleClaims(f),[{id:'STATE-8',source:'src/core/render.tsx'}]);
  assert.doesNotThrow(()=>generateRuleCatalog(f));
});

test('malformed declarations, duplicates, missing inputs and unreadable published arrays fail before writing',t=>{
  const f=fixture(t),before=published(['STATE-8']);
  fs.writeFileSync(f.target,before);
  const invalid=[
    ['rules: null\n',/Invalid rule topic/],
    ['rules:\n  - title: missing id\n',/Invalid rule id/],
    ['rules:\n  - id: STATE-8\n  - id: STATE-8\n',/declared twice: STATE-8/],
  ];
  for(const [body,error] of invalid){topic(f,'ui/composition/state.yaml',body);assert.throws(()=>generateRuleCatalog(f),error);assert.equal(fs.readFileSync(f.target,'utf8'),before);}
  topic(f,'ui/composition/state.yaml','rules:\n  - id: STATE-8\n');
  topic(f,'ui/proof/other.yaml','rules:\n  - id: STATE-8\n');
  assert.throws(()=>generateRuleCatalog(f),/declared twice: STATE-8/);
  assert.equal(fs.readFileSync(f.target,'utf8'),before);
  fs.unlinkSync(path.join(f.knowledgeDir,'ui/proof/other.yaml'));
  for(const body of ['not a published array\n',published(['STATE-8','STATE-8']),published([])]){
    fs.writeFileSync(f.target,body);assert.throws(()=>generateRuleCatalog(f),/canonical rule id array/i);assert.equal(fs.readFileSync(f.target,'utf8'),body);
  }
  fs.writeFileSync(f.target,before);
  fs.rmSync(path.join(f.knowledgeDir,'ui/proof'),{recursive:true});
  assert.throws(()=>generateRuleCatalog(f),/ENOENT/);
  assert.equal(fs.readFileSync(f.target,'utf8'),before);
});

test('index, translation and pending topics cannot contribute duplicate declarations; an empty tree refuses',t=>{
  const f=fixture(t);
  assert.throws(()=>collectRuleCatalog(f),/declare no rules/);
  topic(f,'ui/composition/state.yaml','rules:\n  - id: STATE-8\n');
  for(const name of ['index.yaml','state.vi.yaml','_pending-state.yaml'])topic(f,'ui/composition/'+name,'rules:\n  - id: STATE-8\n');
  assert.deepEqual(collectRuleCatalog(f).ids,['STATE-8']);
});

test('the repository catalog equals independently read authored declarations, without a frozen count',()=>{
  const root=fileURLToPath(new URL('../..',import.meta.url)),knowledgeDir=path.join(root,'knowledge');
  const declared=[];
  for(const directory of directories){
    for(const name of fs.readdirSync(path.join(knowledgeDir,directory))){
      if(!name.endsWith('.yaml')||name.endsWith('.vi.yaml')||name.toLowerCase()==='index.yaml'||name.startsWith('_pending-'))continue;
      const document=parseYaml(fs.readFileSync(path.join(knowledgeDir,directory,name),'utf8'));
      for(const rule of document.rules??[])declared.push(rule.id);
    }
  }
  assert.ok(declared.length>0);
  const actual=collectRuleCatalog({knowledgeDir});
  assert.deepEqual([...actual.ids].sort(),[...declared].sort());
  assert.equal(new Set(actual.ids).size,declared.length);
  assert.ok(actual.ids.includes('STATE-8'));
  assert.ok(actual.ids.includes('MARGIN-AUTO'));
  assert.ok(actual.ids.includes('RADIUS-6'));
  assert.equal(actual.ids.includes('STATE-4'),false);
  assert.equal(actual.ids.includes('ACTION-4'),false);
});
