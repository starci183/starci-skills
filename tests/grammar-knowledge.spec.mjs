import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../engine/yaml.mjs';
import {
  GRAMMAR_FAMILIES,censusGrammar,checkGrammarKnowledge,cssDeclarations,cssReads,lexSource,loadDnaModule,registryNames,replaceBlock,
} from '../scripts/checks/grammar-knowledge.mjs';
import {grammarTokenNames} from '../scripts/checks/brand.mjs';
import {cardClassesOf} from '../scripts/checks/render.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const packageRoot=path.join(root,'packages','grammar');
const grammarRoot=path.join(root,'knowledge','grammars');
const readYaml=file=>parseYaml(fs.readFileSync(file,'utf8'));
const census=await censusGrammar({packageRoot});

const copyGrammarRoot=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-grammar-knowledge-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.cpSync(grammarRoot,dir,{recursive:true});
  return dir;
};

test('the grammar knowledge snapshots match the package source: no drift', async()=>{
  const result=await checkGrammarKnowledge({packageRoot,grammarRoot,census});
  assert.deepEqual(result.findings,[],`drift - refresh with \`node scripts/checks/grammar-knowledge.mjs --write\`:\n${result.findings.map(f=>`${f.file} ${f.what}: ${f.detail}`).join('\n')}`);
  assert.equal(result.ok,true);
});

test('every renderer COMMON_GRAMMAR_COMPONENTS registers is listed, once, in all three DNA snapshots', ()=>{
  const registered=registryNames(packageRoot).names.map(entry=>entry.name).sort();
  assert.equal(registered.length,new Set(registered).size);
  assert.ok(registered.length>=95,`the registry holds ${registered.length} renderers`);
  for(const family of ['common','starci','offset-pop']){
    const listed=readYaml(path.join(grammarRoot,family,'DNA.yaml')).renderers.map(r=>r.component).sort();
    assert.deepEqual(listed,registered,`${family}/DNA.yaml renderers`);
  }
});

test('each family DNA block equals what its dna.ts exports, value for value', async()=>{
  for(const family of GRAMMAR_FAMILIES.filter(f=>f.dnaModule)){
    const exported=JSON.parse(JSON.stringify(await loadDnaModule(path.join(packageRoot,family.dnaModule))));
    const dna=readYaml(path.join(grammarRoot,family.knowledge,'DNA.yaml')).dna;
    assert.deepEqual(Object.keys(dna).sort(),Object.keys(exported).sort(),`${family.knowledge} dna exports`);
    for(const [name,value] of Object.entries(exported))assert.deepEqual(dna[name],value,`${family.knowledge} dna.${name}`);
  }
  const pop=readYaml(path.join(grammarRoot,'offset-pop','DNA.yaml')).dna.OFFSET_POP_DNA;
  assert.equal(pop.color.light.accentText,'#b8005f');
  assert.equal(pop.color.dark.accentText,'#ff7ab8');
  assert.deepEqual(Object.keys(pop.offset).sort(),['dark','ink','outlineWidth','shadowInk','x','y']);
  assert.deepEqual(Object.keys(pop.palette).sort(),['blush','critical','mint','pink','yellow']);
});

test('every Offset Pop contract token has a row whose value is the stylesheet default', ()=>{
  const doc=readYaml(path.join(grammarRoot,'offset-pop','DNA.yaml'));
  const rows=new Map(doc.tokens.map(t=>[t.name,t]));
  const css=fs.readFileSync(path.join(packageRoot,'src','offset-pop','styles.css'),'utf8');
  const defaults=new Map(cssDeclarations(css).filter(d=>d.context.at(-1)==='.grammar-common-root[data-grammar-family="offset-pop"]'&&d.context.length===2).map(d=>[d.name,d.value]));
  for(const name of Object.values(doc.dna.OFFSET_POP_TOKEN_NAMES)){
    assert.ok(rows.has(name),`${name} has a token row`);
    assert.equal(rows.get(name).value,defaults.get(name),`${name} value`);
  }
  for(const [name,value] of Object.entries(doc.dna.OFFSET_POP_DARK_TOKEN_DEFAULTS))assert.equal(rows.get(name).dark,value,`${name} dark`);
});

test('a snapshot that falls behind the package is reported: renderer, class, token, dna value, version, catalog', async t=>{
  const dir=copyGrammarRoot(t);
  const pop=path.join(dir,'offset-pop','DNA.yaml');
  let text=fs.readFileSync(pop,'utf8');
  text=text.replace('    accentText: "#b8005f"','    accentText: "#b8005e"');
  text=text.replace(/  - name: "--offset-pop-pink"\n    value: "#ff3593"/,'  - name: "--offset-pop-pink"\n    value: "#ff0000"');
  fs.writeFileSync(pop,text);
  const common=path.join(dir,'common','DNA.yaml');
  const doc=fs.readFileSync(common,'utf8');
  const withoutBottomNav=doc.replace(/  - component: "BottomNav"\n(?: {4}.*\n| {6}.*\n)+/,'');
  assert.notEqual(withoutBottomNav,doc);
  fs.writeFileSync(common,withoutBottomNav.replace('      - "starci-core-toaster-list"\n','').replace(/version: "\d+\.\d+\.\d+"/,`version: "0.4.13"`));
  const index=path.join(dir,'index.yaml');
  fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/the 95 renderers/,'the 42 renderers'));
  const {findings,ok}=await checkGrammarKnowledge({packageRoot,grammarRoot:dir,census});
  assert.equal(ok,false);
  const has=(file,what)=>assert.ok(findings.some(f=>f.file===file&&f.what.startsWith(what)),`expected ${file} ${what} in ${JSON.stringify(findings,null,1)}`);
  has('offset-pop/DNA.yaml','dna.OFFSET_POP_DNA');
  has('offset-pop/DNA.yaml','tokens.--offset-pop-pink.value');
  has('common/DNA.yaml','renderers');
  has('common/DNA.yaml','renderers.Toast.classes');
  has('common/DNA.yaml','provenance.version');
  has('index.yaml','topics.common.summary');
});

test('a package that moves ahead of the snapshot is reported too', async()=>{
  const moved=structuredClone(census);
  moved.renderers.push({...moved.renderers[0],component:'NewRenderer'});
  moved.families['offset-pop'].dna.OFFSET_POP_DNA.palette.pink='#ff0099';
  moved.families.starci.tokens.push({name:'--starci-core-new-knob',value:'1rem',valueFrom:'family'});
  moved.version='0.6.0';
  const {findings}=await checkGrammarKnowledge({packageRoot,grammarRoot,census:moved});
  const whats=findings.map(f=>`${f.file} ${f.what} ${f.detail}`);
  for(const family of ['common','starci','offset-pop'])assert.ok(whats.some(w=>w.startsWith(`${family}/DNA.yaml renderers missing`)&&w.includes('NewRenderer')),family);
  assert.ok(whats.some(w=>w.startsWith('offset-pop/DNA.yaml dna.OFFSET_POP_DNA')));
  assert.ok(whats.some(w=>w.startsWith('starci/DNA.yaml tokens missing --starci-core-new-knob')));
  assert.ok(whats.some(w=>w.startsWith('offset-pop/DNA.yaml provenance.version')));
});

test('every grammar knowledge file is a well-formed knowledge source', ()=>{
  const schema=readYaml(path.join(root,'modules','schemas','knowledge-source.schema.yaml'));
  const allowed=new Set(Object.keys(schema.properties));
  const areas=new Set(schema.properties.appliesTo.items.enum);
  const files=[path.join(grammarRoot,'index.yaml'),...fs.readdirSync(grammarRoot,{withFileTypes:true}).filter(e=>e.isDirectory())
    .flatMap(e=>fs.readdirSync(path.join(grammarRoot,e.name)).filter(n=>n.endsWith('.yaml')).map(n=>path.join(grammarRoot,e.name,n)))];
  assert.ok(files.length>=11);
  const ids=new Set();
  for(const file of files){
    const doc=readYaml(file);
    const label=path.relative(grammarRoot,file);
    for(const key of schema.required)assert.ok(doc[key]!==undefined,`${label} has ${key}`);
    for(const key of Object.keys(doc))assert.ok(allowed.has(key),`${label}: ${key} is not a knowledge-source property`);
    assert.equal(doc.schema,'starci/knowledge-source@1',label);
    assert.match(doc.id,new RegExp(schema.properties.id.pattern),label);
    assert.ok(!ids.has(doc.id),`${label}: duplicate id ${doc.id}`);ids.add(doc.id);
    for(const area of doc.appliesTo)assert.ok(areas.has(area),`${label}: appliesTo ${area}`);
    for(const entry of doc.guidance??[])assert.ok(entry.id&&entry.requirement,`${label}: guidance entry needs id and requirement`);
    for(const topic of doc.topics??[])assert.ok(fs.existsSync(path.join(path.dirname(file),topic.path)),`${label}: topic ${topic.path} exists`);
  }
});

test('the Offset Pop snapshot names no product', ()=>{
  const dir=path.join(grammarRoot,'offset-pop');
  for(const name of fs.readdirSync(dir)){
    assert.doesNotMatch(fs.readFileSync(path.join(dir,name),'utf8'),/mia\s*mia/i,name);
  }
});

test('the brand and render checks read the new family from its snapshot', ()=>{
  const tokens=grammarTokenNames({family:'offset-pop',grammarRoot});
  assert.equal(tokens.error,null);
  for(const name of ['--offset-pop-pink','--offset-pop-accent-text','--offset-pop-shadow-x','--accent'])assert.ok(tokens.names.includes(name),name);
  const cards=cardClassesOf({family:'offset-pop',grammarRoot});
  assert.match(cards.source,/offset-pop\/DNA\.yaml$/);
  assert.ok(cards.classes.includes('starci-core-surface-card')&&cards.classes.includes('starci-core-surface'));
  assert.deepEqual(cardClassesOf({family:'offset-pop',grammarRoot:path.join(grammarRoot,'nowhere')}).classes,['starci-core-surface','starci-core-surface-card']);
  assert.ok(grammarTokenNames({family:'common',grammarRoot}).names.includes('--grammar-row-gap'));
});

test('the census lexer and CSS readers keep what they are for', ()=>{
  const {strings,code}=lexSource('// "not-a-string"\nconst a = "starci-core-x" /* \'no\' */\nconst b = `grammar-y ${c ? "starci-core-z" : ""} tail`\n<p>Don\'t</p>');
  assert.deepEqual(strings.map(s=>s.value),['starci-core-x','grammar-y ','starci-core-z','',' tail']);
  assert.equal(code.length>0,true);
  const css='.r[data-grammar-family="x"] { --a: 1px; color: red; }\n@media (max-width: 40rem) { .r[data-grammar-family="x"] { --a: 2px } }\n.k { width: var(--a, calc(1px + 2px)); }';
  assert.deepEqual(cssDeclarations(css).map(d=>[d.name,d.value,d.context.length]),[['--a','1px',1],['--a','2px',2]]);
  assert.deepEqual(cssReads(css).map(r=>[r.name,r.fallback]),[['--a','calc(1px + 2px)']]);
  assert.equal(replaceBlock('a: 1\nb:\n  - x\nc: 2\n','b','b: []'),'a: 1\nb: []\nc: 2\n');
});
