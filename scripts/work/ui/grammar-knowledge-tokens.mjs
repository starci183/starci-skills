import fs from 'node:fs';
import path from 'node:path';
import module from 'node:module';
import {slash} from '../../lib/path-key.mjs';
import {byCodeUnit} from '../../lib/list.mjs';
import {cssDeclarations,cssReads,lexSource,read,stripCssComments,stylesheetSet,uniq} from './grammar-knowledge-lex.mjs';

/**
 * The custom properties and the DNA modules of the grammar knowledge census (grammar-knowledge.mjs): the tokens
 * each stylesheet set assigns or reads, and each family's `dna.ts` loaded by stripping its types.
 */
const rel=(packageRoot,file)=>`packages/grammar/${slash(path.relative(packageRoot,file))}`;

/** Names written as inline styles by renderer source (`"--x": value`), with the writing component. */
function inlineWrites(packageRoot,renderers){
  const writes=new Map();
  for(const renderer of renderers){
    const file=path.join(path.dirname(packageRoot),renderer.source.replace(/^packages\//,''));
    for(const m of lexSource(read(file)).code.matchAll(/["'](--[a-z0-9-]+)["']\s*:/g)){
      if(!writes.has(m[1]))writes.set(m[1],new Set());
      writes.get(m[1]).add(renderer.component);
    }
  }
  return writes;
}

/** Who sets a token the Common sheets only read. */
function readOnlyOwner(name,writer){
  if(writer)return 'renderer';
  return name.startsWith('--starci-core-')?'family':'host';
}

/** The census row of one token: assigned by the Common sheets, or only read by them. */
function commonToken(name,assigns,uses,writer,packageRoot){
  if(assigns.length){
    const first=assigns[0];
    const distinct=uniq(assigns.map(a=>a.value));
    return {name,value:first.value,...(distinct.length>1?{valueRules:distinct.length}:{}),assignedBy:'common',
      ...(uses.length?{alsoReadBy:uses.length}:{}),source:`${rel(packageRoot,first.sheet)}:${first.line}`};
  }
  const first=uses[0];
  return {name,assignedBy:readOnlyOwner(name,writer),
    ...(writer?{writtenBy:[...writer].sort(byCodeUnit)}:{}),readBy:'common',
    ...(first.fallback===null?{}:{commonFallback:first.fallback}),uses:uses.length,source:`${rel(packageRoot,first.sheet)}:${first.line}`};
}

/**
 * Every custom property the Common entry's stylesheet set (`src/common/styles.css` and the sheets it
 * imports) names outside a comment: assigned by that set (value, distinct-value count, reads), written
 * inline by a renderer, or only read (with the first read's fallback).
 */
export function censusCommonTokens(packageRoot,renderers){
  // The entry sheet is read first, then the sheets it imports: a name's first read (its reported
  // fallback and source line) is the entry sheet's whenever the entry sheet reads it at all.
  const entry=path.join(packageRoot,'src','common','styles.css');
  const sheets=[entry,...stylesheetSet(entry).filter(sheet=>sheet!==entry)];
  const assigned=new Map();
  const reads=new Map();
  for(const sheet of sheets){
    const css=read(sheet);
    for(const d of cssDeclarations(css)){
      if(!assigned.has(d.name))assigned.set(d.name,[]);
      assigned.get(d.name).push({...d,sheet});
    }
    for(const r of cssReads(css)){
      if(!reads.has(r.name))reads.set(r.name,[]);
      reads.get(r.name).push({...r,sheet});
    }
  }
  const writes=inlineWrites(packageRoot,renderers);
  const names=uniq([...assigned.keys(),...reads.keys()]).sort(byCodeUnit);
  const tokens=names.map(name=>commonToken(name,assigned.get(name)??[],reads.get(name)??[],writes.get(name),packageRoot));
  return {tokens,sheets:sheets.map(sheet=>rel(packageRoot,sheet))};
}

const rootSelector=family=>`.grammar-common-root[data-grammar-family="${family}"]`;

/** What a declaration's selectors say beyond `scope`: the qualifier text, or null when one is not on the family root. */
function rootQualifier(selectors,scope){
  const onRoot=selectors.every(s=>s.startsWith(scope)&&!/\s/.test(s.slice(scope.length)));
  if(!onRoot)return null;
  const qualifiers=selectors.map(s=>s.slice(scope.length));
  return qualifiers.length===1?qualifiers[0]:qualifiers.map(item=>item||'(any)').join(' | ');
}

/** File one root-level declaration of a family sheet as the token's default, dark value or override. */
function recordFamilyDeclaration(rows,d,source,qualifier,atRules){
  if(!rows.has(d.name))rows.set(d.name,{name:d.name,overrides:[]});
  const row=rows.get(d.name);
  if(!atRules.length&&qualifier===''){row.value=d.value;row.source=source;}
  else if(!atRules.length&&qualifier==='[data-grammar-theme="dark"]')row.dark=d.value;
  else row.overrides.push({context:[...atRules,qualifier].filter(Boolean).join(' '),value:d.value});
}

/** Where a Common-read name in the family's namespace takes its value from. */
function commonValueFrom(token){
  if(token.value!==undefined)return 'common';
  return token.assignedBy==='renderer'?'renderer':'common-fallback';
}

/** The rows the family's own sheets set on its root, by token name. */
function familyRootRows(packageRoot,family){
  const scope=rootSelector(family.source);
  const familyDir=path.join(packageRoot,'src',family.source);
  const sheets=stylesheetSet(path.join(familyDir,'styles.css'),{include:file=>path.dirname(file)===familyDir});
  const rows=new Map();
  for(const sheet of sheets){
    for(const d of cssDeclarations(read(sheet))){
      const qualifier=rootQualifier(d.context.at(-1).split(',').map(s=>s.trim()),scope);
      if(qualifier===null)continue;
      const atRules=d.context.slice(0,-1).filter(p=>p.startsWith('@media')||p.startsWith('@supports'));
      recordFamilyDeclaration(rows,d,`${rel(packageRoot,sheet)}:${d.line}`,qualifier,atRules);
    }
  }
  return rows;
}

/** One family token as a census row. */
function familyTokenRow(row){
  const out={name:row.name};
  if(row.value!==undefined)out.value=row.value;
  if(row.dark!==undefined)out.dark=row.dark;
  out.valueFrom=row.valueFrom??'family';
  if(row.overrides.length)out.overrides=row.overrides;
  if(row.source)out.source=row.source;
  return out;
}

/**
 * The tokens one family's own sheets set on its root: the default (light) value, the explicit dark
 * theme value, and every other root-level override (narrow width, reduced motion, forced colours),
 * with the Common-read names in the family's namespace completed from Common's own value or fallback.
 */
export function censusFamilyTokens(packageRoot,family,{commonTokens=[],include=[]}={}){
  const rows=familyRootRows(packageRoot,family);
  const common=new Map(commonTokens.map(token=>[token.name,token]));
  for(const name of include){
    const token=common.get(name);
    if(rows.has(name)||!token)continue;
    rows.set(name,{name,value:token.value??token.commonFallback??null,valueFrom:commonValueFrom(token),source:token.source,overrides:[]});
  }
  return [...rows.values()].map(familyTokenRow).sort((a,b)=>byCodeUnit(a.name,b.name));
}

/** Loads a family's `dna.ts` by stripping its types; every exported frozen object is returned. */
export async function loadDnaModule(file){
  const source=read(file);
  if(typeof module.stripTypeScriptTypes!=='function')throw new Error('this Node has no module.stripTypeScriptTypes (needs >= 22.13)');
  const emit=process.emitWarning;
  process.emitWarning=(warning,...rest)=>{if(!String(warning?.message??warning).includes('stripTypeScriptTypes'))emit.call(process,warning,...rest);};
  let js;
  try{js=module.stripTypeScriptTypes(source,{mode:'strip'});}finally{process.emitWarning=emit;}
  if(/^[\t\v\f \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]*import\s/m.test(js))throw new Error(`${slash(file)} imports another module; the DNA module must stay self-contained`);
  const exported=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  return Object.fromEntries(Object.entries(exported).filter(([,value])=>value&&typeof value==='object'));
}

/** The grammar package's stylesheets with comments blanked, joined: the shipped CSS the census paints against. */
export function shippedCss(packageRoot){
  return ['common','core','heritage','offset-pop'].flatMap(dir=>{
    const full=path.join(packageRoot,'src',dir);
    return fs.existsSync(full)?fs.readdirSync(full).filter(name=>name.endsWith('.css')).map(name=>stripCssComments(read(path.join(full,name)))):[];
  }).join('\n');
}
