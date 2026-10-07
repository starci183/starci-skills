import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../../lib/is-main.mjs';
import { eachInOrder } from '../../lib/in-order.mjs';
import { jsonClone } from '../../lib/json-clone.mjs';
import {parseYaml} from '../../../engine/yaml.mjs';
import {sha256File} from '../../../engine/digest.mjs';
import {skillRoot} from '../../../engine/runtime-root.mjs'; import { byCodeUnit } from '../../lib/list.mjs';
import {read,uniq} from './grammar-knowledge-lex.mjs';
import {censusRenderers} from './grammar-knowledge-renderers.mjs';
import {censusCommonTokens,censusFamilyTokens,loadDnaModule,shippedCss} from './grammar-knowledge-tokens.mjs';

/**
 * The grammar knowledge snapshots (`knowledge/grammars/<family>/DNA.yaml`) are measurements of
 * `packages/grammar`. This module takes that measurement again, from source, and either reports every
 * place a snapshot no longer matches the package (`checkGrammarKnowledge`, the default CLI mode) or
 * rewrites the measured blocks of the snapshots in place (`--write`).
 *
 * What is measured is the part of a snapshot a machine can own: the package version, the Common
 * renderer registry with each renderer's classes and stamped rule ids, the custom properties each
 * stylesheet set assigns or reads, and each family's DNA module (`src/<family>/dna.ts`) value for value.
 * Prose - observations, guidance, gaps, idioms, playbooks - stays authored; only its counts are held.
 *
 * Nothing here builds, installs or renders: every measurement is a static read of the package source,
 * and the DNA modules are loaded by stripping their TypeScript types (Node's own `stripTypeScriptTypes`).
 * The source readers live in grammar-knowledge-lex.mjs, the renderer census in grammar-knowledge-renderers.mjs
 * and the token census with the DNA loader in grammar-knowledge-tokens.mjs.
 */
export {loadDnaModule};
export {cssDeclarations,cssReads,lexSource} from './grammar-knowledge-lex.mjs';
export {registryNames,ruleCatalog} from './grammar-knowledge-renderers.mjs';
const GRAMMAR_KNOWLEDGE_CHECK='starci/grammar-knowledge-check@1';

/** The families whose snapshot this check owns, and where each one's source and DNA module live. */
export const GRAMMAR_FAMILIES=Object.freeze([
  Object.freeze({knowledge:'common',source:'common',dnaModule:null,root:'GrammarRoot'}),
  Object.freeze({knowledge:'starci',source:'core',dnaModule:'src/core/dna.ts',root:'CoreGrammarRoot',tokenPrefix:'--starci-core-'}),
  Object.freeze({knowledge:'offset-pop',source:'offset-pop',dnaModule:'src/offset-pop/dna.ts',root:'OffsetPopGrammarRoot',tokenPrefix:'--offset-pop-'}),
]);

function defaultPaths(root=skillRoot){
  return {root,packageRoot:path.join(root,'packages','grammar'),grammarRoot:path.join(root,'knowledge','grammars')};
}

// ---------------------------------------------------------------------------
// The whole census.
// ---------------------------------------------------------------------------

export async function censusGrammar({packageRoot=defaultPaths().packageRoot}={}){
  const pkg=JSON.parse(read(path.join(packageRoot,'package.json')));
  const {renderers,groups,catalog}=censusRenderers(packageRoot);
  const common=censusCommonTokens(packageRoot,renderers);
  const shipped=shippedCss(packageRoot);
  const emitted=uniq(renderers.flatMap(r=>r.classes)).sort(byCodeUnit);
  const painted=emitted.filter(cls=>new RegExp(String.raw`\.`+cls.replaceAll('-',String.raw`\-`)+String.raw`(?![\w-])`).test(shipped));
  const families={};
  // One family at a time: loadDnaModule swaps the shared process.emitWarning while it strips types.
  await eachInOrder(GRAMMAR_FAMILIES.filter(f=>f.dnaModule),async family=>{
    const dna=jsonClone(await loadDnaModule(path.join(packageRoot,family.dnaModule)));
    const bandNames=Object.values(Object.entries(dna).find(([key])=>key.endsWith('BAND_TOKEN_NAMES'))?.[1]??{});
    const include=family.source==='core'
      ?common.tokens.map(t=>t.name).filter(name=>name.startsWith(family.tokenPrefix))
      :bandNames;
    families[family.knowledge]={dna,tokens:censusFamilyTokens(packageRoot,family,{commonTokens:common.tokens,include})};
  });
  const assignedRows=common.tokens.filter(t=>t.assignedBy==='common');
  return {
    schema:GRAMMAR_KNOWLEDGE_CHECK,
    package:pkg.name,
    version:pkg.version,
    groups,
    renderers,
    ruleCatalogSize:catalog.ids.length,
    commonTokens:common.tokens,
    commonSheets:common.sheets,
    families,
    counts:{
      renderers:renderers.length,
      tokens:common.tokens.length,
      tokensAssignedByCommon:assignedRows.length,
      tokensAssignedAndAlsoReadByCommon:assignedRows.filter(t=>t.alsoReadBy).length,
      tokensWrittenByRenderers:common.tokens.filter(t=>t.assignedBy==='renderer').length,
      tokensReadOnlyByCommon:common.tokens.filter(t=>t.assignedBy!=='common').length,
      tokensReadByCommon:common.tokens.filter(t=>t.assignedBy!=='common'||t.alsoReadBy).length,
      claimEntries:renderers.reduce((sum,r)=>sum+r.claims.length+r.computedClaims.length,0),
      distinctClaimIds:uniq(renderers.flatMap(r=>[...r.claims,...r.computedClaims])).length,
      emittedClasses:emitted.length,
      classesWithARuleInAShippedSheet:painted.length,
    },
    unpaintedClasses:emitted.filter(cls=>!painted.includes(cls)),
  };
}

/** The sha256 of each file the census read, so a reader can tell whether a snapshot still describes a tree. */
function censusDigests(packageRoot,files){
  return files.map(file=>({path:`packages/grammar/${file}`,sha256:sha256File(path.join(packageRoot,file))}));
}

// ---------------------------------------------------------------------------
// YAML emission of the measured blocks.
// ---------------------------------------------------------------------------

const q=value=>JSON.stringify(String(value));
const key=value=>/^[A-Za-z_]\w*$/.test(value)?value:q(value);
const scalar=value=>{
  if(typeof value==='number'||typeof value==='boolean')return String(value);
  return value===null?'null':q(value);
};
const flow=list=>`[${list.map(q).join(', ')}]`;

/** One entry of a nested plain object as block YAML at `pad`. */
function yamlEntry(pad,name,value,indent){
  if(value&&typeof value==='object'&&!Array.isArray(value))return `${pad}${key(name)}:\n${yamlObject(value,indent+2)}`;
  return `${pad}${key(name)}: ${Array.isArray(value)?flow(value):scalar(value)}`;
}

/** A nested plain object as block YAML at `indent`. */
function yamlObject(object,indent){
  const pad=' '.repeat(indent);
  return Object.entries(object).map(([name,value])=>yamlEntry(pad,name,value,indent)).join('\n');
}

function yamlClosedValues(closedValues){
  if(!closedValues.length)return ['    closedValues: []'];
  const lines=['    closedValues:'];
  for(const c of closedValues){
    lines.push(`      - prop: ${q(c.prop)}`,c.values?`        values: ${flow(c.values)}`:`        type: ${q(c.type)}`);
  }
  return lines;
}

function yamlRenderer(r,{closedValues,source}){
  const lines=[`  - component: ${q(r.component)}`,`    propsType: ${r.propsType?q(r.propsType):'null'}`,`    kind: ${q(r.kind)}`,`    group: ${q(r.group)}`];
  if(source)lines.push(`    source: ${q(r.source)}`);
  if(closedValues)lines.push(...yamlClosedValues(r.closedValues));
  lines.push(`    claims: ${flow(r.claims)}`,`    computedClaims: ${flow(r.computedClaims)}`);
  if(r.classes.length)lines.push('    classes:',...r.classes.map(c=>`      - ${q(c)}`));
  else lines.push('    classes: []');
  return lines;
}

function yamlRenderers(renderers,{closedValues=false,source=true}={}){
  return ['renderers:',...renderers.flatMap(r=>yamlRenderer(r,{closedValues,source}))].join('\n');
}

function yamlCommonTokens(tokens){
  const lines=['tokens:'];
  for(const t of tokens){
    lines.push(`  - name: ${q(t.name)}`);
    for(const field of ['value','valueRules','assignedBy','writtenBy','readBy','commonFallback','uses','alsoReadBy','source']){
      if(t[field]===undefined)continue;
      lines.push(`    ${field}: ${Array.isArray(t[field])?flow(t[field]):scalar(t[field])}`);
    }
  }
  return lines.join('\n');
}

function yamlFamilyTokens(tokens){
  const lines=['tokens:'];
  for(const t of tokens){
    lines.push(`  - name: ${q(t.name)}`);
    for(const field of ['value','dark','valueFrom']){
      if(t[field]!==undefined)lines.push(`    ${field}: ${scalar(t[field])}`);
    }
    if(t.overrides){
      lines.push('    overrides:');
      for(const o of t.overrides)lines.push(`      - context: ${q(o.context)}`,`        value: ${q(o.value)}`);
    }
    if(t.source)lines.push(`    source: ${q(t.source)}`);
  }
  return lines.join('\n');
}

/** The end of a block that starts at `start` and stops before `next`, without its blank tail. */
function trimBlankTail(lines,start,next){
  let end=next<0?lines.length:next;
  while(end>start+1&&lines[end-1].trim()==='')end--;
  return end;
}

/** The line range [start, end) of the top-level `name:` block. */
function topLevelRange(lines,name){
  const start=lines.findIndex(line=>line.startsWith(`${name}:`));
  if(start<0)throw new Error(`no top-level \`${name}:\` block`);
  return {start,end:trimBlankTail(lines,start,lines.findIndex((line,i)=>i>start&&/^[A-Za-z]/.test(line)))};
}

/** The line range [start, end) of the block nested two spaces under the top-level `parent:`. */
function nestedRange(lines,name,parent){
  const top=lines.findIndex(line=>line.startsWith(`${parent}:`));
  if(top<0)throw new Error(`no top-level \`${parent}:\` block`);
  const start=lines.findIndex((line,i)=>i>top&&line.startsWith(`  ${name}:`));
  if(start<0)throw new Error(`no \`${parent}.${name}\` block`);
  return {start,end:trimBlankTail(lines,start,lines.findIndex((line,i)=>i>start&&(!/^(\s{3,}|\s*$)/.test(line)||/^\S/.test(line))))};
}

/**
 * Replace one top-level block (`name:` at column 0 through the line before the next column-0 key) or,
 * with `parent`, one block nested two spaces under a top-level key.
 */
export function replaceBlock(text,name,replacement,{parent=null}={}){
  const lines=text.split('\n');
  const {start,end}=parent===null?topLevelRange(lines,name):nestedRange(lines,name,parent);
  return [...lines.slice(0,start),...replacement.split('\n'),...lines.slice(end)].join('\n');
}

// ---------------------------------------------------------------------------
// Comparing a snapshot with the census.
// ---------------------------------------------------------------------------

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const readYaml=file=>parseYaml(read(file));

/** The drift of one renderer's measured fields against its snapshot row. */
function rendererFieldFindings(file,r,row,closedValues){
  const findings=[];
  for(const field of ['propsType','kind','group','claims','computedClaims','classes',...(closedValues?['closedValues']:[])]){
    const expected=r[field]??null;
    const actual=row[field]??(Array.isArray(expected)?[]:null);
    if(!same(actual,expected))findings.push({file,what:`renderers.${r.component}.${field}`,detail:`snapshot ${JSON.stringify(actual)} but source ${JSON.stringify(expected)}`});
  }
  return findings;
}

function compareRenderers(findings,file,snapshot,renderers,{closedValues}){
  const rows=Array.isArray(snapshot.renderers)?snapshot.renderers:[];
  const listed=rows.map(r=>r.component);
  const measured=renderers.map(r=>r.component);
  const missing=measured.filter(name=>!listed.includes(name));
  const extra=listed.filter(name=>!measured.includes(name));
  if(missing.length)findings.push({file,what:'renderers',detail:`missing ${missing.length} registered renderer(s): ${missing.join(', ')}`});
  if(extra.length)findings.push({file,what:'renderers',detail:`lists ${extra.length} renderer(s) the registry no longer holds: ${extra.join(', ')}`});
  for(const r of renderers){
    const row=rows.find(entry=>entry.component===r.component);
    if(row)findings.push(...rendererFieldFindings(file,r,row,closedValues));
  }
}

function compareTokens(findings,file,snapshot,tokens,fields){
  const rows=new Map((Array.isArray(snapshot.tokens)?snapshot.tokens:[]).map(t=>[t.name,t]));
  for(const t of tokens){
    const row=rows.get(t.name);
    if(!row){findings.push({file,what:'tokens',detail:`missing ${t.name}`});continue;}
    for(const field of fields){
      if(!same(row[field]??null,t[field]??null))findings.push({file,what:`tokens.${t.name}.${field}`,detail:`snapshot ${JSON.stringify(row[field]??null)} but source ${JSON.stringify(t[field]??null)}`});
    }
    rows.delete(t.name);
  }
  for(const name of rows.keys())findings.push({file,what:'tokens',detail:`lists ${name}, which the source no longer names`});
}

/** Key-order-insensitive canonical form, so a YAML mapping equals the module object it mirrors. */
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort(byCodeUnit).map(k=>[k,canonical(value[k])]));
  return value;
}

/** The package version a snapshot (or its index) states, against the measured one. */
function versionFindings(findings,file,doc,measured){
  for(const [parent,field] of [['provenance','version'],['identity','version']]){
    const value=doc?.[parent]?.[field];
    if(value!==undefined&&value!==measured.version)findings.push({file,what:`${parent}.${field}`,detail:`snapshot ${value} but package ${measured.version}`});
  }
}

function compareCounts(findings,file,counts,expected){
  for(const [name,value] of Object.entries(expected)){
    if(counts[name]!==value)findings.push({file,what:`identity.counts.${name}`,detail:`snapshot ${counts[name]} but source ${value}`});
  }
}

function compareDna(findings,file,family,dna,measured){
  for(const [name,value] of Object.entries(measured)){
    if(!same(canonical(dna[name]),canonical(value)))findings.push({file,what:`dna.${name}`,detail:`snapshot differs from ${family.dnaModule}`});
  }
  for(const name of Object.keys(dna))if(!(name in measured))findings.push({file,what:`dna.${name}`,detail:`${family.dnaModule} exports no ${name}`});
}

function checkCommonSnapshot(findings,grammarRoot,measured){
  const common=readYaml(path.join(grammarRoot,'common','DNA.yaml'));
  versionFindings(findings,'common/DNA.yaml',common,measured);
  compareRenderers(findings,'common/DNA.yaml',common,measured.renderers,{closedValues:false});
  compareTokens(findings,'common/DNA.yaml',common,measured.commonTokens,['value','valueRules','assignedBy','writtenBy','readBy','commonFallback']);
  const counts=common?.identity?.counts??{};
  compareCounts(findings,'common/DNA.yaml',counts,measured.counts);
  if(counts.gaps!==(common.gaps??[]).length)findings.push({file:'common/DNA.yaml',what:'identity.counts.gaps',detail:`counts ${counts.gaps} but lists ${(common.gaps??[]).length}`});
}

function checkFamilySnapshot(findings,family,grammarRoot,measured){
  const file=`${family.knowledge}/DNA.yaml`;
  const full=path.join(grammarRoot,family.knowledge,'DNA.yaml');
  if(!fs.existsSync(full)){findings.push({file,what:'file',detail:'the family has no DNA snapshot'});return;}
  const doc=readYaml(full);
  versionFindings(findings,file,doc,measured);
  const index=path.join(grammarRoot,family.knowledge,'index.yaml');
  if(fs.existsSync(index))versionFindings(findings,`${family.knowledge}/index.yaml`,readYaml(index),measured);
  compareRenderers(findings,file,doc,measured.renderers,{closedValues:true});
  const census=measured.families[family.knowledge];
  compareTokens(findings,file,doc,census.tokens,['value','dark','valueFrom','overrides']);
  compareDna(findings,file,family,doc?.dna??{},census.dna);
  compareCounts(findings,file,doc?.identity?.counts??{},{renderers:measured.renderers.length,tokens:census.tokens.length});
}

/** The catalog entries (`index.yaml`) that name a path that is not there. */
function catalogPathFindings(findings,grammarRoot,catalog){
  for(const topic of catalog.topics??[]){
    if(!fs.existsSync(path.join(grammarRoot,topic.path)))findings.push({file:'index.yaml',what:`topics.${topic.id}`,detail:`${topic.path} does not exist`});
  }
  for(const family of catalog.families??[]){
    for(const field of ['authority','packageSnapshot','reusableStyle','productComposition','index']){
      if(family[field]&&!fs.existsSync(path.join(grammarRoot,family[field])))findings.push({file:'index.yaml',what:`families.${family.id}.${field}`,detail:`${family[field]} does not exist`});
    }
  }
}

function checkCatalog(findings,grammarRoot,measured){
  const catalog=readYaml(path.join(grammarRoot,'index.yaml'));
  const listed=new Set((catalog.families??[]).map(f=>f.id));
  for(const family of GRAMMAR_FAMILIES)if(!listed.has(family.knowledge))findings.push({file:'index.yaml',what:'families',detail:`no \`${family.knowledge}\` family entry`});
  catalogPathFindings(findings,grammarRoot,catalog);
  const commonSummary=(catalog.topics??[]).find(t=>t.id==='common')?.summary??'';
  const stated=/\b(\d+) renderers\b/.exec(commonSummary);
  if(!stated||Number(stated[1])!==measured.renderers.length)findings.push({file:'index.yaml',what:'topics.common.summary',detail:`states ${stated?stated[1]:'no'} renderers but the registry holds ${measured.renderers.length}`});
}

/**
 * Every drift between the grammar knowledge snapshots and the package source. Line positions, use
 * counts and digests are pointers, not facts, so they are refreshed by `--write` but never reported.
 */
export async function checkGrammarKnowledge({packageRoot=defaultPaths().packageRoot,grammarRoot=defaultPaths().grammarRoot,census=null}={}){
  const measured=census??await censusGrammar({packageRoot});
  const findings=[];
  checkCommonSnapshot(findings,grammarRoot,measured);
  for(const family of GRAMMAR_FAMILIES.filter(f=>f.dnaModule))checkFamilySnapshot(findings,family,grammarRoot,measured);
  checkCatalog(findings,grammarRoot,measured);
  return {schema:GRAMMAR_KNOWLEDGE_CHECK,ok:findings.length===0,version:measured.version,renderers:measured.renderers.length,findings};
}

// ---------------------------------------------------------------------------
// Rewriting the measured blocks.
// ---------------------------------------------------------------------------

const COMMON_DIGEST_FILES=['src/common/index.ts','src/common/renderers.ts','src/common/renderers-forms.ts','src/common/renderers-overlays.ts',
  'src/common/renderers-navigation.ts','src/common/registry.tsx','src/common/styles.css','src/common/components-forms.css',
  'src/common/components-overlays.css','src/common/components-navigation.css','src/common/spacing.ts','src/common/state.ts',
  'src/common/conformance.ts','src/common/rule-catalog.generated.ts','src/core/overlayScope.tsx','src/core/classNames.ts'];

const familyDigestFiles=family=>family.source==='core'
  ?['src/core/index.ts','src/core/dna.ts','src/core/styles.css','src/common/registry.tsx']
  :['src/offset-pop/index.tsx','src/offset-pop/dna.ts','src/offset-pop/conformance.ts','src/offset-pop/styles.css',
    'src/offset-pop/components-forms.css','src/offset-pop/components-overlays.css','src/offset-pop/components-navigation.css','src/common/registry.tsx'];

const yamlDigests=digests=>['  digests:',...digests.flatMap(d=>[`    - path: ${q(d.path)}`,`      sha256: ${q(d.sha256)}`])].join('\n');

/** The package version the check compares (provenance.version, identity.version), rewritten where the snapshot states it. */
function withVersion(text,version){
  const doc=parseYaml(text)??{};
  for(const parent of ['provenance','identity'])
    if(doc[parent]?.version!==undefined)text=replaceBlock(text,'version',`  version: ${q(version)}`,{parent});
  return text;
}

export async function writeGrammarKnowledge({packageRoot=defaultPaths().packageRoot,grammarRoot=defaultPaths().grammarRoot}={}){
  const census=await censusGrammar({packageRoot});
  const written=[];
  const commonFile=path.join(grammarRoot,'common','DNA.yaml');
  let text=withVersion(read(commonFile).replaceAll('\r\n','\n'),census.version);
  text=replaceBlock(text,'tokens',yamlCommonTokens(census.commonTokens));
  text=replaceBlock(text,'renderers',yamlRenderers(census.renderers,{closedValues:false}));
  const gaps=(parseYaml(text).gaps??[]).length;
  text=replaceBlock(text,'counts',`  counts:\n${yamlObject({...census.counts,gaps},4)}`,{parent:'identity'});
  text=replaceBlock(text,'digests',yamlDigests(censusDigests(packageRoot,COMMON_DIGEST_FILES)),{parent:'provenance'});
  fs.writeFileSync(commonFile,text);written.push('common/DNA.yaml');
  for(const family of GRAMMAR_FAMILIES.filter(f=>f.dnaModule)){
    const file=path.join(grammarRoot,family.knowledge,'DNA.yaml');
    if(!fs.existsSync(file))continue;
    const measured=census.families[family.knowledge];
    let doc=withVersion(read(file).replaceAll('\r\n','\n'),census.version);
    doc=replaceBlock(doc,'dna',`dna:\n${yamlObject(measured.dna,2)}`);
    doc=replaceBlock(doc,'tokens',yamlFamilyTokens(measured.tokens));
    doc=replaceBlock(doc,'renderers',yamlRenderers(census.renderers,{closedValues:true}));
    const familyGaps=(parseYaml(doc).gaps??[]).length;
    doc=replaceBlock(doc,'counts',`  counts:\n${yamlObject({renderers:census.renderers.length,tokens:measured.tokens.length,
      claimEntries:census.counts.claimEntries,gaps:familyGaps},4)}`,{parent:'identity'});
    doc=replaceBlock(doc,'digests',yamlDigests(censusDigests(packageRoot,familyDigestFiles(family))),{parent:'provenance'});
    fs.writeFileSync(file,doc);written.push(`${family.knowledge}/DNA.yaml`);
    const index=path.join(grammarRoot,family.knowledge,'index.yaml');
    if(fs.existsSync(index)){
      const before=read(index).replaceAll('\r\n','\n'),after=withVersion(before,census.version);
      if(after!==before){fs.writeFileSync(index,after);written.push(`${family.knowledge}/index.yaml`);}
    }
  }
  return {written,census};
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

export async function main(argv=process.argv.slice(2)){
  if(argv.includes('--help'))return {exitCode:0,text:'Usage: starci work grammar-knowledge [--write] [--json]\n\nCompares knowledge/grammars/*/DNA.yaml with packages/grammar source (renderers, classes, rule ids, tokens, dna.ts values, version). --write refreshes the measured blocks in place. Exit 0 is clean, 1 reports drift.\n'};
  if(argv.includes('--write')){
    const {written,census}=await writeGrammarKnowledge();
    return {exitCode:0,text:`rewrote ${written.join(', ')} from ${census.package}@${census.version} (${census.renderers.length} renderers)\n`};
  }
  const result=await checkGrammarKnowledge();
  if(argv.includes('--json'))return {exitCode:result.ok?0:1,text:`${JSON.stringify(result,null,2)}\n`};
  const lines=[`grammar knowledge vs ${result.version} (${result.renderers} renderers): ${result.ok?'no drift':result.findings.length+' drift finding(s)'}`];
  for(const f of result.findings.slice(0,60))lines.push(`  ${f.file} ${f.what}: ${f.detail}`);
  if(result.findings.length>60)lines.push(`  ... ${result.findings.length-60} more`);
  if(!result.ok)lines.push('  refresh the measured blocks with: starci work grammar-knowledge --write');
  return {exitCode:result.ok?0:1,text:`${lines.join('\n')}\n`};
}

if(isMain(import.meta.url)){
  const {exitCode,text}=await main();
  process.stdout.write(text);
  process.exitCode=exitCode;
}
