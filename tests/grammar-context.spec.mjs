import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {grammarContextRequired,resolveGrammarContext,renderGrammarContext} from '../scripts/kernel/grammar-context.mjs';
import {projectBinding} from '../scripts/kernel/target-repo.mjs';
import {buildOpPrompt} from '../scripts/kernel/op-prompt.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';

// An op manifest with grammarContext: required gets its grammar sources in packet context.grammar at
// dispatch: the family CSS from the product's brand record and installed @starci/grammar, the StarCi
// grammar knowledge, knowledge/ui and the product's grammar captures. A missing one refuses the spawn.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const slash=p=>p.replace(/\\/g,'/');

const tmp=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-grammar-ctx-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const write=(root,rel,text)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);};
const brandYaml=(family,sources)=>['schema: work/brand@1','kind: brand','brand:','  identity:',`    family: ${family}`,'  sources:',
  ...sources.map(s=>`    - {${Object.entries(s).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join(', ')}}`),''].join('\n');

// <source>/.workspaces/projects/p/work.json binds be (Work owner) and fe.
const product=(t,{family='starci',sources=[],grammarExports=null,captures=false}={})=>{
  const source=tmp(t);
  const be=path.join(source,'app-backend');const fe=path.join(source,'app-fe');
  fs.mkdirSync(be,{recursive:true});fs.mkdirSync(fe,{recursive:true});
  write(source,'.workspaces/projects/p/work.json',JSON.stringify({schema:'starci/workspace-binding@1',project:'p',
    repositories:{be:{pathFromSource:'app-backend'},fe:{pathFromSource:'app-fe'}},work:{ownerRole:'be',pathFromRepository:'.starciwork'}}));
  write(be,'.starciwork/brand/index.yaml',brandYaml(family,sources));
  if(grammarExports){
    write(fe,'node_modules/@starci/grammar/package.json',JSON.stringify({name:'@starci/grammar',exports:grammarExports}));
    for(const target of Object.values(grammarExports))write(fe,path.join('node_modules/@starci/grammar',target),':root{}\n');
  }
  if(captures)write(be,'.starciwork/_resources/grammar-captures/index.json','{}');
  return {source,be,fe,binding:projectBinding(be,{sourceRoot:source})};
};

test('interface.implement and interface.audit declare grammarContext: required',()=>{
  for(const op of ['interface.implement','interface.audit']){
    const brief=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops',`${op}.yaml`),'utf8'));
    assert.equal(brief.grammarContext,'required',op);
    assert.ok(grammarContextRequired(brief));
  }
  assert.equal(grammarContextRequired({}),false);
});

test('the family CSS resolves from brand.sources and the installed grammar family export; knowledge and captures ride along',t=>{
  const p=product(t,{family:'starci',captures:true,
    sources:[{repository:'app-fe',path:'src/family.css',kind:'tokens'},{path:'src/app/globals.css',kind:'css'},
      {path:'D:/legacy/globals.css',kind:'reference'},{repository:'app-fe',path:'src/Brand.tsx',kind:'component'}],
    grammarExports:{'./core.css':'./dist/core/styles.css','./offset-pop.css':'./dist/offset-pop/styles.css'}});
  write(p.fe,'src/family.css',':root{}');
  write(p.fe,'src/app/globals.css',':root{}');
  const g=resolveGrammarContext({skillRoot:ROOT,repo:p.be,binding:p.binding});
  assert.deepEqual(g.missing,[]);
  assert.equal(g.family,'starci');
  const css=g.sources.filter(s=>s.role==='family-css').map(s=>path.relative(p.fe,s.path).replace(/\\/g,'/'));
  assert.deepEqual(css,['src/family.css','src/app/globals.css','node_modules/@starci/grammar/dist/core/styles.css'],
    'declared .css sources (a reference is not one; a repository-less path is found in the bound fe) plus the starci family export (core)');
  assert.deepEqual(g.sources.filter(s=>s.role==='grammar-knowledge').map(s=>path.basename(s.path)),['family.yaml','DNA.yaml','playbook.yaml','idioms.yaml']);
  assert.deepEqual(g.sources.filter(s=>s.role==='ui-knowledge').map(s=>path.basename(s.path)),['presentation','composition','proof']);
  assert.ok(g.sources.find(s=>s.role==='ui-knowledge').files.every(f=>f.endsWith('.yaml')));
  assert.equal(g.sources.find(s=>s.role==='grammar-captures').path,slash(path.join(p.be,'.starciwork/_resources/grammar-captures')));

  const lines=renderGrammarContext(g).join('\n');
  assert.match(lines,/^grammar_context \(family starci\): read every source below before any action/);
  assert.ok(lines.includes(slash(path.join(p.fe,'src/family.css'))));
  assert.match(lines,/ui-knowledge: .*knowledge\/ui\/proof\/ — \d+ yaml: .*render-truth\.yaml/);
});

test('a declared CSS source not on disk, or no brand record, is a missing source - never a silent omission',t=>{
  const p=product(t,{family:'nivo',sources:[{repository:'app-fe',path:'packages/ui/nivo.css',kind:'tokens'}]});
  const g=resolveGrammarContext({skillRoot:ROOT,repo:p.be,binding:p.binding});
  assert.equal(g.missing.length,1);
  assert.equal(g.missing[0].role,'family-css');
  assert.equal(g.missing[0].path,'app-fe:packages/ui/nivo.css');

  const bare=product(t,{family:'nivo',sources:[]});
  const none=resolveGrammarContext({skillRoot:ROOT,repo:bare.be,binding:bare.binding});
  assert.match(none.missing[0].detail,/declares no CSS in brand\.sources and no bound repository installs a @starci\/grammar CSS export for family nivo/);

  const empty=tmp(t);
  const noBrand=resolveGrammarContext({skillRoot:ROOT,repo:empty,binding:null});
  assert.match(noBrand.missing[0].detail,/no brand record/);
  assert.ok(noBrand.sources.some(s=>s.role==='grammar-knowledge'),'the Source knowledge still resolves');
});

test('buildOpPrompt renders packet context.grammar and nothing when the packet has none',()=>{
  const packet={op:'interface.draw',brief:'modules/ops/ops/interface.draw.yaml',
    context:{records:['.starciwork/shell'],owned_paths:[],attempt:1},constraints:{model:'m'}};
  assert.doesNotMatch(buildOpPrompt({skillRoot:ROOT,packet}),/grammar_context/);
  const grammar={family:'nivo',sources:[{role:'family-css',path:'D:/p/nivo.css'}]};
  const prompt=buildOpPrompt({skillRoot:ROOT,packet:{...packet,context:{...packet.context,grammar}}});
  assert.match(prompt,/records: \.starciwork\/shell\ngrammar_context \(family nivo\)[^\n]*\n  family-css: D:\/p\/nivo\.css\n/);
});

test('api dispatch attaches context.grammar and refuses grammar-context-missing before any Orca call',t=>{
  const root=tmp(t);
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const log=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_SOURCE_ROOT:root,LOCALAPPDATA:path.join(root,'localappdata'),STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite')};
  const ledger=openLedger({file:ledgerFileFor(repo,{env})});
  try{seedWorkflow(ledger,{id:'wf-grammar',jobs:[{jobId:'job-impl',opId:'interface.implement',
    payload:{opId:'interface.implement',records:[],owned_paths:['src/app'],model:'devin-agent'}}]});}
  finally{ledger.close();}
  const run=(...extra)=>spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-impl',...extra,'--json'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});

  const dry=run();
  assert.equal(dry.status,0,dry.stdout+dry.stderr);
  const preview=JSON.parse(dry.stdout);
  assert.match(preview.grammarContextMissing,/family-css: no brand record.*spawn will refuse grammar-context-missing/);
  assert.ok(preview.packet.context.grammar.sources.some(s=>s.role==='grammar-knowledge'));

  const spawn=run('--spawn');
  assert.equal(spawn.status,1,spawn.stdout+spawn.stderr);
  const refused=JSON.parse(spawn.stdout);
  assert.equal(refused.reason,'grammar-context-missing');
  assert.match(refused.detail,/interface\.implement declares grammarContext: required.*The job stays queued/);
  assert.equal(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():'','','nothing reached the host');
  const inspect=inspectLedger({file:ledgerFileFor(repo,{env})});
  try{assert.equal(inspect.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-impl').status,'queued');}
  finally{inspect.close();}

  write(repo,'.starciwork/brand/index.yaml',brandYaml('nivo',[{path:'src/nivo.css',kind:'tokens'}]));
  write(repo,'src/nivo.css',':root{}');
  const ok=run();
  assert.equal(ok.status,0,ok.stdout+ok.stderr);
  const out=JSON.parse(ok.stdout);
  assert.equal(out.grammarContextMissing,undefined);
  assert.equal(out.packet.context.grammar.family,'nivo');
  assert.ok(out.prompt.includes(`family-css: ${slash(path.join(repo,'src/nivo.css'))}`));
});
