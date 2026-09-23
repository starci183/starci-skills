import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import module from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';

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
 */
export const GRAMMAR_KNOWLEDGE_CHECK='starci/grammar-knowledge-check@1';

/** The families whose snapshot this check owns, and where each one's source and DNA module live. */
export const GRAMMAR_FAMILIES=Object.freeze([
  Object.freeze({knowledge:'common',source:'common',dnaModule:null,root:'GrammarRoot'}),
  Object.freeze({knowledge:'starci',source:'core',dnaModule:'src/core/dna.ts',root:'CoreGrammarRoot',tokenPrefix:'--starci-core-'}),
  Object.freeze({knowledge:'offset-pop',source:'offset-pop',dnaModule:'src/offset-pop/dna.ts',root:'OffsetPopGrammarRoot',tokenPrefix:'--offset-pop-'}),
]);

const slash=value=>String(value??'').replaceAll('\\','/');
const read=file=>fs.readFileSync(file,'utf8');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lineAt=(text,offset)=>{let line=1;for(let i=0;i<offset&&i<text.length;i++)if(text.charCodeAt(i)===10)line++;return line;};
const uniq=values=>[...new Set(values)];
const byName=(a,b)=>a<b?-1:a>b?1:0;

export function defaultPaths(root=skillRoot){
  return {root,packageRoot:path.join(root,'packages','grammar'),grammarRoot:path.join(root,'knowledge','grammars')};
}

// ---------------------------------------------------------------------------
// Source lexing: comments blanked (offsets kept), string literals collected.
// ---------------------------------------------------------------------------

/**
 * A small TS/TSX lexer. Comments become spaces (newlines kept, so offsets and lines survive); every
 * single-, double-quoted and template string chunk is returned with its offset. A quote that does not
 * close on its own line is JSX text (an apostrophe), not a string, and is left as code.
 */
export function lexSource(source){
  const out=source.split('');
  const strings=[];
  const blank=(from,to)=>{for(let k=from;k<to;k++)if(out[k]!=='\n'&&out[k]!=='\r')out[k]=' ';};
  const templateDepth=[];
  let i=0;
  const n=source.length;
  const scanTemplate=start=>{
    let j=start,chunk='',chunkStart=start;
    while(j<n){
      const c=source[j];
      if(c==='\\'){chunk+=source.slice(j,j+2);j+=2;continue;}
      if(c==='`'){strings.push({value:chunk,start:chunkStart});return {end:j+1,open:false};}
      if(c==='$'&&source[j+1]==='{'){strings.push({value:chunk,start:chunkStart});return {end:j+2,open:true};}
      chunk+=c;j++;
    }
    strings.push({value:chunk,start:chunkStart});return {end:n,open:false};
  };
  let braces=0;
  while(i<n){
    const c=source[i];
    if(c==='/'&&source[i+1]==='/'){const end=source.indexOf('\n',i);const stop=end<0?n:end;blank(i,stop);i=stop;continue;}
    if(c==='/'&&source[i+1]==='*'){const end=source.indexOf('*/',i+2);const stop=end<0?n:end+2;blank(i,stop);i=stop;continue;}
    if(c==='"'||c==='\''){
      let j=i+1,value='',closed=false;
      while(j<n&&source[j]!=='\n'){
        if(source[j]==='\\'){value+=source.slice(j,j+2);j+=2;continue;}
        if(source[j]===c){closed=true;break;}
        value+=source[j];j++;
      }
      if(closed){strings.push({value,start:i});i=j+1;continue;}
      i++;continue;
    }
    if(c==='`'){
      const result=scanTemplate(i+1);
      if(result.open){templateDepth.push(braces);braces++;}
      i=result.end;continue;
    }
    if(c==='{'){braces++;i++;continue;}
    if(c==='}'){
      braces--;
      if(templateDepth.length&&templateDepth[templateDepth.length-1]===braces){
        templateDepth.pop();
        const result=scanTemplate(i+1);
        if(result.open){templateDepth.push(braces);braces++;}
        i=result.end;continue;
      }
      i++;continue;
    }
    i++;
  }
  return {code:out.join(''),strings};
}

/** CSS with every comment blanked, offsets and lines kept. */
export function stripCssComments(css){
  return css.replace(/\/\*[\s\S]*?\*\//g,match=>match.replace(/[^\n\r]/g,' '));
}

/**
 * Every declaration in a stylesheet with the stack of block preludes it sits in
 * (`@layer x`, `@media (...)`, the rule's selector list), its custom-property name and its value.
 */
export function cssDeclarations(css){
  const code=stripCssComments(css);
  const declarations=[];
  const stack=[];
  let segmentStart=0;
  let depthParen=0;
  for(let i=0;i<code.length;i++){
    const c=code[i];
    if(c==='(')depthParen++;
    else if(c===')')depthParen=Math.max(0,depthParen-1);
    else if(depthParen)continue;
    else if(c==='{'){stack.push(code.slice(segmentStart,i).replace(/\s+/g,' ').trim());segmentStart=i+1;}
    else if(c==='}'||c===';'){
      const text=code.slice(segmentStart,i);
      const match=/^\s*(--[A-Za-z0-9_-]+)\s*:([\s\S]*)$/.exec(text);
      if(match&&stack.length&&!stack[stack.length-1].startsWith('@')){
        const offset=segmentStart+text.indexOf(match[1]);
        declarations.push({name:match[1],value:match[2].replace(/\s+/g,' ').trim(),context:[...stack],line:lineAt(code,offset)});
      }
      if(c==='}')stack.pop();
      segmentStart=i+1;
    }
  }
  return declarations;
}

/** Every `var(--name[, fallback])` read in a stylesheet, fallback kept verbatim (whitespace collapsed). */
export function cssReads(css){
  const code=stripCssComments(css);
  const reads=[];
  const pattern=/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g;
  let match;
  while((match=pattern.exec(code))){
    let fallback=null;
    if(match[2]){
      let depth=1,j=pattern.lastIndex;
      const start=j;
      while(j<code.length&&depth){if(code[j]==='(')depth++;else if(code[j]===')')depth--;j++;}
      fallback=code.slice(start,j-1).replace(/\s+/g,' ').trim();
    }
    reads.push({name:match[1],fallback,line:lineAt(code,match.index)});
  }
  return reads;
}

/** A stylesheet and the relative sheets it `@import`s, in cascade order, with no repeats. */
export function stylesheetSet(entry,{include=()=>true}={}){
  const seen=[];
  const visit=file=>{
    if(seen.includes(file))return;
    const text=stripCssComments(read(file));
    const imports=[...text.matchAll(/@import\s+["']([^"']+)["']\s*;/g)].map(m=>path.resolve(path.dirname(file),m[1]));
    for(const imported of imports)if(include(imported))visit(imported);
    seen.push(file);
  };
  visit(entry);
  return seen;
}

// ---------------------------------------------------------------------------
// The Common renderer registry.
// ---------------------------------------------------------------------------

const exportStatements=source=>[...lexSource(source).code.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)]
  .map(m=>({names:m[1].split(',').map(part=>part.trim()).filter(Boolean),from:m[2]}));

const resolveModule=(fromFile,specifier)=>{
  const base=path.resolve(path.dirname(fromFile),specifier.replace(/\.js$/,''));
  return ['.tsx','.ts','/index.tsx','/index.ts'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate))??null;
};

/** The names `COMMON_GRAMMAR_COMPONENTS` holds, with the frozen group maps it spreads resolved. */
export function registryNames(packageRoot){
  const commonDir=path.join(packageRoot,'src','common');
  const registry=lexSource(read(path.join(commonDir,'registry.tsx'))).code;
  const body=/COMMON_GRAMMAR_COMPONENTS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\s*as const\)/.exec(registry);
  if(!body)throw Error('COMMON_GRAMMAR_COMPONENTS was not found in src/common/registry.tsx');
  const names=[];
  const groups=[];
  for(const part of body[1].split(',').map(item=>item.trim()).filter(Boolean)){
    const spread=/^\.\.\.([A-Z0-9_]+)$/.exec(part);
    if(!spread){names.push({name:part,group:'base'});continue;}
    const file=fs.readdirSync(commonDir).filter(name=>/^renderers-.+\.ts$/.test(name))
      .map(name=>path.join(commonDir,name)).find(candidate=>new RegExp(`export const ${spread[1]}\\b`).test(read(candidate)));
    if(!file)throw Error(`${spread[1]} is spread into COMMON_GRAMMAR_COMPONENTS but no renderers-*.ts defines it`);
    const group=/renderers-(.+)\.ts$/.exec(file)[1];
    groups.push({group,map:spread[1],file:slash(path.relative(packageRoot,file))});
    const map=new RegExp(`export const ${spread[1]}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\s*as const\\)`).exec(lexSource(read(file)).code);
    for(const name of map[1].split(',').map(item=>item.trim()).filter(Boolean))names.push({name,group});
  }
  return {names,groups};
}

/** Every value the Common barrel files re-export, mapped to the module file and the props type beside it. */
function barrelExports(packageRoot){
  const commonDir=path.join(packageRoot,'src','common');
  const files=['renderers.ts',...fs.readdirSync(commonDir).filter(name=>/^renderers-.+\.ts$/.test(name)).sort()];
  const exported=new Map();
  for(const name of files){
    const file=path.join(commonDir,name);
    for(const statement of exportStatements(read(file))){
      const moduleFile=resolveModule(file,statement.from);
      const types=statement.names.filter(part=>part.startsWith('type ')).map(part=>part.slice(5).trim());
      for(const part of statement.names.filter(item=>!item.startsWith('type '))){
        const value=part.split(/\s+as\s+/).pop().trim();
        exported.set(value,{moduleFile,propsType:types.includes(`${value}Props`)?`${value}Props`:null,barrel:name});
      }
    }
  }
  return exported;
}

const RULE_ID=/^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-(?:\d+|AUTO)$/;

/** The canonical rule ids and the prefixes they use, from the generated catalog. */
export function ruleCatalog(packageRoot){
  const text=read(path.join(packageRoot,'src','common','rule-catalog.generated.ts'));
  const ids=uniq([...text.matchAll(/"([A-Z][A-Z0-9-]*-\d+)"/g)].map(m=>m[1]));
  const prefixes=new Set(ids.map(id=>id.replace(/-\d+$/,'')));
  return {ids,prefixes};
}

const CLASS_LITERAL=/(?<![\w-])((?:starci-core|grammar)-[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?)(?![\w-])/g;
const classesIn=value=>[...value.matchAll(CLASS_LITERAL)].map(m=>m[1]);

/** The text of one top-level exported declaration: from its line to the next top-level `export`. */
function declarationText(code,name){
  const start=new RegExp(`^export\\s+(?:const|function|let|class)\\s+${name}\\b`,'m').exec(code);
  if(!start)return null;
  const rest=code.slice(start.index+1);
  const next=/^export\s/m.exec(rest);
  return {start:start.index,end:next?start.index+1+next.index:code.length};
}

/** Imports of a module: value names only, with the resolved file. Bare (vendor) specifiers are skipped. */
function valueImports(file,code){
  const imports=[];
  for(const m of code.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)){
    if(m[1]||!m[3].startsWith('.'))continue;
    const target=resolveModule(file,m[3]);
    if(!target)continue;
    const names=m[2].split(',').map(part=>part.trim()).filter(part=>part&&!part.startsWith('type '))
      .map(part=>part.split(/\s+as\s+/)[0].trim());
    imports.push({target,names});
  }
  return imports;
}

/** Literal union aliases (`type X = "a" | "b"`) declared across the package source. */
function literalAliases(files){
  const aliases=new Map();
  for(const file of files){
    for(const m of read(file).matchAll(/^(?:export\s+)?type\s+([A-Z]\w*)\s*=\s*((?:"[^"]*"|\d+)(?:\s*\|\s*(?:"[^"]*"|\d+))*)\s*$/gm)){
      aliases.set(m[1],{file,values:literalValues(m[2])});
    }
  }
  return aliases;
}
const literalValues=text=>text.split('|').map(part=>part.trim()).map(part=>part.startsWith('"')?part.slice(1,-1):part);
const isLiteralUnion=text=>/^(?:"[^"]*"|\d+)(?:\s*\|\s*(?:"[^"]*"|\d+))*$/.test(text);

/**
 * The closed values a renderer's props type publishes: every `readonly prop?: <closed type>` member of
 * the props type and of the local object types its declaration names (one level down, e.g. the
 * `ButtonBase & (DestinationButton | CommandButton)` members). A string/number literal union, or a
 * local alias of one, is listed as `values`; a closed alias imported from elsewhere in the package
 * is listed by `type` name.
 */
function closedValuesOf(moduleFile,propsType,aliases){
  if(!propsType)return [];
  const lines=lexSource(read(moduleFile)).code.split(/\r?\n/);
  const declarations=new Map();
  for(let index=0;index<lines.length;index++){
    const m=/^(?:export\s+)?type\s+(\w+)(?:<[^=]*>)?\s*=\s*(.*)$/.exec(lines[index]);
    if(!m)continue;
    const text=[m[2]];
    let open=(m[2].match(/[{(]/g)??[]).length-(m[2].match(/[})]/g)??[]).length;
    for(let j=index+1;j<lines.length&&(open>0||/^\s*[|&]/.test(lines[j]));j++){
      text.push(lines[j]);
      open+=(lines[j].match(/[{(]/g)??[]).length-(lines[j].match(/[})]/g)??[]).length;
    }
    declarations.set(m[1],text);
  }
  const visited=new Set();
  const members=[];
  const MEMBER=/readonly\s+(\w+)\??\s*:\s*((?:"[^"]*"|[^;{}"])+?)\s*(?=;|\}|,?\s*$)/g;
  const collect=(name,depth)=>{
    if(visited.has(name)||depth>4)return;
    visited.add(name);
    const text=declarations.get(name);
    if(!text)return;
    for(const line of text){
      for(const member of line.matchAll(MEMBER)){
        members.push({prop:member[1],type:member[2].trim()});
        // A member typed as a local object type (an item record, say) publishes its own closed members.
        const ref=/^([A-Z]\w*)(?:\s*\|\s*undefined)?$/.exec(member[2].trim());
        if(ref&&/^\s*\{/.test(declarations.get(ref[1])?.[0]??''))collect(ref[1],depth+1);
      }
      const rest=line.replace(MEMBER,'').replace(/"[^"]*"/g,'');
      for(const ref of rest.matchAll(/\b([A-Z]\w*)\b/g))collect(ref[1],depth+1);
    }
  };
  collect(propsType,0);
  const seen=new Set();
  const closed=[];
  const moduleDir=path.dirname(path.resolve(moduleFile));
  for(const {prop,type} of members){
    if(seen.has(prop))continue;
    const cleaned=type.replace(/\s*\|\s*undefined$/,'').trim();
    if(isLiteralUnion(cleaned)){seen.add(prop);closed.push({prop,values:literalValues(cleaned)});continue;}
    if(!/^[A-Z]\w*$/.test(cleaned)||/Props$/.test(cleaned))continue;
    const alias=aliases.get(cleaned);
    if(alias&&path.dirname(path.resolve(alias.file))===moduleDir){seen.add(prop);closed.push({prop,values:alias.values});continue;}
    if(alias||['IconSource','PresentationState'].includes(cleaned)){seen.add(prop);closed.push({prop,type:cleaned});}
  }
  return closed;
}

/** One renderer's census: kind, source, classes and rule ids, and closed prop values. */
function censusRenderer({name,group},{packageRoot,exported,catalog,rendererNames,aliases}){
  const entry=exported.get(name);
  if(!entry||!entry.moduleFile)throw Error(`${name} is registered in COMMON_GRAMMAR_COMPONENTS but no Common barrel re-exports it`);
  const moduleFile=entry.moduleFile;
  const coreDir=path.join(packageRoot,'src','core');
  const relative=slash(path.relative(coreDir,moduleFile));
  const flat=!relative.includes('/');
  const kind=flat?'core':relative.split('/')[0];
  const moduleDir=path.dirname(moduleFile);
  const ownFiles=flat?[moduleFile]:fs.readdirSync(moduleDir)
    .filter(file=>/\.(tsx?|mts)$/.test(file)&&!/\.(spec|test)\./.test(file)).map(file=>path.join(moduleDir,file)).sort();
  const classes=new Set();
  const claims=new Set();
  const computed=new Set();
  const isRuleId=token=>RULE_ID.test(token)&&catalog.prefixes.has(token.replace(/-(?:\d+|AUTO)$/,''));
  for(const file of ownFiles){
    const {code,strings}=lexSource(read(file));
    const literalAt=new Set();
    for(const m of code.matchAll(/data-contract="([^"]*)"/g)){
      literalAt.add(m.index+'data-contract='.length);
      for(const token of m[1].split(/\s+/))if(isRuleId(token))claims.add(token);
    }
    for(const string of strings){
      for(const cls of classesIn(string.value))classes.add(cls);
      if(literalAt.has(string.start))continue;
      for(const token of string.value.split(/[\s,]+/))if(isRuleId(token))computed.add(token);
    }
    // One hop: helpers (never other renderers) imported by name from another package module.
    for(const {target,names} of valueImports(file,code)){
      if(ownFiles.includes(target))continue;
      const lexed=lexSource(read(target));
      for(const imported of names){
        if(rendererNames.has(imported))continue;
        const span=declarationText(lexed.code,imported);
        if(!span)continue;
        for(const string of lexed.strings)if(string.start>=span.start&&string.start<span.end)for(const cls of classesIn(string.value))classes.add(cls);
      }
    }
  }
  return {
    component:name,
    propsType:entry.propsType,
    kind,
    group,
    source:slash(path.relative(path.dirname(packageRoot),moduleFile)).replace(/^/,'packages/'),
    closedValues:closedValuesOf(moduleFile,entry.propsType,aliases),
    claims:[...claims].sort(byName),
    computedClaims:[...computed].filter(id=>!claims.has(id)).sort(byName),
    classes:[...classes].sort(byName),
  };
}

const sourceFilesUnder=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())return entry.name==='stories'||entry.name==='__test__'?[]:sourceFilesUnder(full);
  return /\.(tsx?)$/.test(entry.name)&&!/\.(spec|test)\./.test(entry.name)?[full]:[];
});

/** The 95-renderer census (or however many the registry now holds). */
export function censusRenderers(packageRoot){
  const {names,groups}=registryNames(packageRoot);
  const exported=barrelExports(packageRoot);
  const catalog=ruleCatalog(packageRoot);
  const rendererNames=new Set(names.map(entry=>entry.name));
  const aliases=literalAliases(sourceFilesUnder(path.join(packageRoot,'src')));
  const renderers=names.map(entry=>censusRenderer(entry,{packageRoot,exported,catalog,rendererNames,aliases}))
    .sort((a,b)=>byName(a.component,b.component));
  return {renderers,groups,catalog};
}

// ---------------------------------------------------------------------------
// Custom properties.
// ---------------------------------------------------------------------------

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
  const names=uniq([...assigned.keys(),...reads.keys()]).sort(byName);
  const tokens=names.map(name=>{
    const assigns=assigned.get(name)??[];
    const uses=reads.get(name)??[];
    if(assigns.length){
      const first=assigns[0];
      const distinct=uniq(assigns.map(a=>a.value));
      return {name,value:first.value,...(distinct.length>1?{valueRules:distinct.length}:{}),assignedBy:'common',
        ...(uses.length?{alsoReadBy:uses.length}:{}),source:`${rel(packageRoot,first.sheet)}:${first.line}`};
    }
    const first=uses[0];
    const writer=writes.get(name);
    return {name,assignedBy:writer?'renderer':name.startsWith('--starci-core-')?'family':'host',
      ...(writer?{writtenBy:[...writer].sort(byName)}:{}),readBy:'common',
      ...(first.fallback===null?{}:{commonFallback:first.fallback}),uses:uses.length,source:`${rel(packageRoot,first.sheet)}:${first.line}`};
  });
  return {tokens,sheets:sheets.map(sheet=>rel(packageRoot,sheet))};
}

const rootSelector=family=>`.grammar-common-root[data-grammar-family="${family}"]`;

/**
 * The tokens one family's own sheets set on its root: the default (light) value, the explicit dark
 * theme value, and every other root-level override (narrow width, reduced motion, forced colours),
 * with the Common-read names in the family's namespace completed from Common's own value or fallback.
 */
export function censusFamilyTokens(packageRoot,family,{commonTokens=[],include=[]}={}){
  const scope=rootSelector(family.source);
  const sheets=stylesheetSet(path.join(packageRoot,'src',family.source,'styles.css'),
    {include:file=>path.dirname(file)===path.join(packageRoot,'src',family.source)});
  const rows=new Map();
  for(const sheet of sheets){
    for(const d of cssDeclarations(read(sheet))){
      const selectors=d.context[d.context.length-1].split(',').map(s=>s.trim());
      const atRules=d.context.slice(0,-1).filter(p=>p.startsWith('@media')||p.startsWith('@supports'));
      const onRoot=selectors.every(s=>s.startsWith(scope)&&!/\s/.test(s.slice(scope.length)));
      if(!onRoot)continue;
      const qualifiers=selectors.map(s=>s.slice(scope.length));
      const qualifier=qualifiers.length===1?qualifiers[0]:qualifiers.map(item=>item||'(any)').join(' | ');
      if(!rows.has(d.name))rows.set(d.name,{name:d.name,overrides:[]});
      const row=rows.get(d.name);
      if(!atRules.length&&qualifier===''){row.value=d.value;row.source=`${rel(packageRoot,sheet)}:${d.line}`;}
      else if(!atRules.length&&qualifier==='[data-grammar-theme="dark"]')row.dark=d.value;
      else row.overrides.push({context:[...atRules,qualifier].filter(Boolean).join(' '),value:d.value});
    }
  }
  const common=new Map(commonTokens.map(token=>[token.name,token]));
  for(const name of include){
    if(rows.has(name))continue;
    const token=common.get(name);
    if(!token)continue;
    rows.set(name,{name,value:token.value??token.commonFallback??null,valueFrom:token.value!==undefined?'common':token.assignedBy==='renderer'?'renderer':'common-fallback',
      source:token.source,overrides:[]});
  }
  return [...rows.values()].map(row=>{
    const out={name:row.name};
    if(row.value!==undefined)out.value=row.value;
    if(row.dark!==undefined)out.dark=row.dark;
    out.valueFrom=row.valueFrom??'family';
    if(row.overrides.length)out.overrides=row.overrides;
    if(row.source)out.source=row.source;
    return out;
  }).sort((a,b)=>byName(a.name,b.name));
}

// ---------------------------------------------------------------------------
// The DNA modules.
// ---------------------------------------------------------------------------

/** Loads a family's `dna.ts` by stripping its types; every exported frozen object is returned. */
export async function loadDnaModule(file){
  const source=read(file);
  if(typeof module.stripTypeScriptTypes!=='function')throw Error('this Node has no module.stripTypeScriptTypes (needs >= 22.13)');
  const emit=process.emitWarning;
  process.emitWarning=(warning,...rest)=>{if(!String(warning?.message??warning).includes('stripTypeScriptTypes'))emit.call(process,warning,...rest);};
  let js;
  try{js=module.stripTypeScriptTypes(source,{mode:'strip'});}finally{process.emitWarning=emit;}
  if(/^\s*import\s/m.test(js))throw Error(`${slash(file)} imports another module; the DNA module must stay self-contained`);
  const exported=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  return Object.fromEntries(Object.entries(exported).filter(([,value])=>value&&typeof value==='object'));
}

const plain=value=>JSON.parse(JSON.stringify(value));

// ---------------------------------------------------------------------------
// The whole census.
// ---------------------------------------------------------------------------

export async function censusGrammar({packageRoot=defaultPaths().packageRoot}={}){
  const pkg=JSON.parse(read(path.join(packageRoot,'package.json')));
  const {renderers,groups,catalog}=censusRenderers(packageRoot);
  const common=censusCommonTokens(packageRoot,renderers);
  const shipped=['common','core','heritage','offset-pop'].flatMap(dir=>{
    const full=path.join(packageRoot,'src',dir);
    return fs.existsSync(full)?fs.readdirSync(full).filter(name=>name.endsWith('.css')).map(name=>stripCssComments(read(path.join(full,name)))):[];
  }).join('\n');
  const emitted=uniq(renderers.flatMap(r=>r.classes)).sort(byName);
  const painted=emitted.filter(cls=>new RegExp(`\\.${cls.replace(/[-]/g,'\\-')}(?![\\w-])`).test(shipped));
  const families={};
  for(const family of GRAMMAR_FAMILIES.filter(f=>f.dnaModule)){
    const dna=plain(await loadDnaModule(path.join(packageRoot,family.dnaModule)));
    const bandNames=Object.values(Object.entries(dna).find(([key])=>key.endsWith('BAND_TOKEN_NAMES'))?.[1]??{});
    const include=family.source==='core'
      ?common.tokens.map(t=>t.name).filter(name=>name.startsWith(family.tokenPrefix))
      :bandNames;
    families[family.knowledge]={dna,tokens:censusFamilyTokens(packageRoot,family,{commonTokens:common.tokens,include})};
  }
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
export function censusDigests(packageRoot,files){
  return files.map(file=>({path:`packages/grammar/${file}`,sha256:sha256(path.join(packageRoot,file))}));
}

// ---------------------------------------------------------------------------
// YAML emission of the measured blocks.
// ---------------------------------------------------------------------------

const q=value=>JSON.stringify(String(value));
const key=value=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)?value:q(value);
const scalar=value=>typeof value==='number'||typeof value==='boolean'?String(value):value===null?'null':q(value);
const flow=list=>`[${list.map(q).join(', ')}]`;

/** A nested plain object as block YAML at `indent`. */
export function yamlObject(object,indent){
  const pad=' '.repeat(indent);
  return Object.entries(object).map(([name,value])=>value&&typeof value==='object'&&!Array.isArray(value)
    ?`${pad}${key(name)}:\n${yamlObject(value,indent+2)}`
    :`${pad}${key(name)}: ${Array.isArray(value)?flow(value):scalar(value)}`).join('\n');
}

export function yamlRenderers(renderers,{closedValues=false,source=true}={}){
  const lines=['renderers:'];
  for(const r of renderers){
    lines.push(`  - component: ${q(r.component)}`);
    lines.push(`    propsType: ${r.propsType?q(r.propsType):'null'}`);
    lines.push(`    kind: ${q(r.kind)}`);
    lines.push(`    group: ${q(r.group)}`);
    if(source)lines.push(`    source: ${q(r.source)}`);
    if(closedValues){
      if(!r.closedValues.length)lines.push('    closedValues: []');
      else{
        lines.push('    closedValues:');
        for(const c of r.closedValues){
          lines.push(`      - prop: ${q(c.prop)}`);
          if(c.values)lines.push(`        values: ${flow(c.values)}`);
          else lines.push(`        type: ${q(c.type)}`);
        }
      }
    }
    lines.push(`    claims: ${flow(r.claims)}`);
    lines.push(`    computedClaims: ${flow(r.computedClaims)}`);
    if(!r.classes.length)lines.push('    classes: []');
    else{lines.push('    classes:');for(const c of r.classes)lines.push(`      - ${q(c)}`);}
  }
  return lines.join('\n');
}

export function yamlCommonTokens(tokens){
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

export function yamlFamilyTokens(tokens){
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

/**
 * Replace one top-level block (`name:` at column 0 through the line before the next column-0 key) or,
 * with `parent`, one block nested two spaces under a top-level key.
 */
export function replaceBlock(text,name,replacement,{parent=null}={}){
  const lines=text.split('\n');
  let start=-1,end=lines.length;
  if(parent===null){
    start=lines.findIndex(line=>line.startsWith(`${name}:`));
    if(start<0)throw Error(`no top-level \`${name}:\` block`);
    for(let i=start+1;i<lines.length;i++)if(/^[A-Za-z]/.test(lines[i])){end=i;break;}
    while(end>start+1&&lines[end-1].trim()==='')end--;
  }else{
    const top=lines.findIndex(line=>line.startsWith(`${parent}:`));
    if(top<0)throw Error(`no top-level \`${parent}:\` block`);
    start=lines.findIndex((line,i)=>i>top&&line.startsWith(`  ${name}:`));
    if(start<0)throw Error(`no \`${parent}.${name}\` block`);
    for(let i=start+1;i<lines.length;i++)if(!/^(\s{3,}|\s*$)/.test(lines[i])||/^\S/.test(lines[i])){end=i;break;}
    while(end>start+1&&lines[end-1].trim()==='')end--;
  }
  return [...lines.slice(0,start),...replacement.split('\n'),...lines.slice(end)].join('\n');
}

// ---------------------------------------------------------------------------
// Comparing a snapshot with the census.
// ---------------------------------------------------------------------------

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const readYaml=file=>parseYaml(read(file));

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
    if(!row)continue;
    for(const field of ['propsType','kind','group','claims','computedClaims','classes',...(closedValues?['closedValues']:[])]){
      const expected=r[field]??null;
      const actual=row[field]??(Array.isArray(expected)?[]:null);
      if(!same(actual,expected))findings.push({file,what:`renderers.${r.component}.${field}`,detail:`snapshot ${JSON.stringify(actual)} but source ${JSON.stringify(expected)}`});
    }
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

/**
 * Every drift between the grammar knowledge snapshots and the package source. Line positions, use
 * counts and digests are pointers, not facts, so they are refreshed by `--write` but never reported.
 */
export async function checkGrammarKnowledge({packageRoot=defaultPaths().packageRoot,grammarRoot=defaultPaths().grammarRoot,census=null}={}){
  const measured=census??await censusGrammar({packageRoot});
  const findings=[];
  const version=(file,doc)=>{
    for(const at of [['provenance','version'],['identity','version']]){
      const value=doc?.[at[0]]?.[at[1]];
      if(value!==undefined&&value!==measured.version)findings.push({file,what:at.join('.'),detail:`snapshot ${value} but package ${measured.version}`});
    }
  };
  const commonFile=path.join(grammarRoot,'common','DNA.yaml');
  const common=readYaml(commonFile);
  version('common/DNA.yaml',common);
  compareRenderers(findings,'common/DNA.yaml',common,measured.renderers,{closedValues:false});
  compareTokens(findings,'common/DNA.yaml',common,measured.commonTokens,['value','valueRules','assignedBy','writtenBy','readBy','commonFallback']);
  for(const [name,value] of Object.entries(measured.counts)){
    if(common?.identity?.counts?.[name]!==value)findings.push({file:'common/DNA.yaml',what:`identity.counts.${name}`,detail:`snapshot ${common?.identity?.counts?.[name]} but source ${value}`});
  }
  if(common?.identity?.counts?.gaps!==(common.gaps??[]).length)findings.push({file:'common/DNA.yaml',what:'identity.counts.gaps',detail:`counts ${common?.identity?.counts?.gaps} but lists ${(common.gaps??[]).length}`});
  for(const family of GRAMMAR_FAMILIES.filter(f=>f.dnaModule)){
    const file=`${family.knowledge}/DNA.yaml`;
    const full=path.join(grammarRoot,family.knowledge,'DNA.yaml');
    if(!fs.existsSync(full)){findings.push({file,what:'file',detail:'the family has no DNA snapshot'});continue;}
    const doc=readYaml(full);
    version(file,doc);
    const index=path.join(grammarRoot,family.knowledge,'index.yaml');
    if(fs.existsSync(index))version(`${family.knowledge}/index.yaml`,readYaml(index));
    compareRenderers(findings,file,doc,measured.renderers,{closedValues:true});
    const census=measured.families[family.knowledge];
    compareTokens(findings,file,doc,census.tokens,['value','dark','valueFrom','overrides']);
    const dna=doc?.dna??{};
    for(const [name,value] of Object.entries(census.dna)){
      if(!same(canonical(dna[name]),canonical(value)))findings.push({file,what:`dna.${name}`,detail:`snapshot differs from ${family.dnaModule}`});
    }
    for(const name of Object.keys(dna))if(!(name in census.dna))findings.push({file,what:`dna.${name}`,detail:`${family.dnaModule} exports no ${name}`});
    const counts=doc?.identity?.counts??{};
    const expected={renderers:measured.renderers.length,tokens:census.tokens.length};
    for(const [name,value] of Object.entries(expected))if(counts[name]!==value)findings.push({file,what:`identity.counts.${name}`,detail:`snapshot ${counts[name]} but source ${value}`});
  }
  const catalog=readYaml(path.join(grammarRoot,'index.yaml'));
  const listed=(catalog.families??[]).map(f=>f.id);
  for(const family of GRAMMAR_FAMILIES)if(!listed.includes(family.knowledge))findings.push({file:'index.yaml',what:'families',detail:`no \`${family.knowledge}\` family entry`});
  for(const topic of catalog.topics??[]){
    if(!fs.existsSync(path.join(grammarRoot,topic.path)))findings.push({file:'index.yaml',what:`topics.${topic.id}`,detail:`${topic.path} does not exist`});
  }
  for(const family of catalog.families??[]){
    for(const field of ['authority','packageSnapshot','reusableStyle','productComposition','index']){
      if(family[field]&&!fs.existsSync(path.join(grammarRoot,family[field])))findings.push({file:'index.yaml',what:`families.${family.id}.${field}`,detail:`${family[field]} does not exist`});
    }
  }
  const commonSummary=(catalog.topics??[]).find(t=>t.id==='common')?.summary??'';
  const stated=/\b(\d+) renderers\b/.exec(commonSummary);
  if(!stated||Number(stated[1])!==measured.renderers.length)findings.push({file:'index.yaml',what:'topics.common.summary',detail:`states ${stated?stated[1]:'no'} renderers but the registry holds ${measured.renderers.length}`});
  return {schema:GRAMMAR_KNOWLEDGE_CHECK,ok:findings.length===0,version:measured.version,renderers:measured.renderers.length,findings};
}

/** Key-order-insensitive canonical form, so a YAML mapping equals the module object it mirrors. */
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
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

export async function writeGrammarKnowledge({packageRoot=defaultPaths().packageRoot,grammarRoot=defaultPaths().grammarRoot}={}){
  const census=await censusGrammar({packageRoot});
  const written=[];
  const commonFile=path.join(grammarRoot,'common','DNA.yaml');
  let text=read(commonFile).replace(/\r\n/g,'\n');
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
    let doc=read(file).replace(/\r\n/g,'\n');
    doc=replaceBlock(doc,'dna',`dna:\n${yamlObject(measured.dna,2)}`);
    doc=replaceBlock(doc,'tokens',yamlFamilyTokens(measured.tokens));
    doc=replaceBlock(doc,'renderers',yamlRenderers(census.renderers,{closedValues:true}));
    const familyGaps=(parseYaml(doc).gaps??[]).length;
    doc=replaceBlock(doc,'counts',`  counts:\n${yamlObject({renderers:census.renderers.length,tokens:measured.tokens.length,
      claimEntries:census.counts.claimEntries,gaps:familyGaps},4)}`,{parent:'identity'});
    doc=replaceBlock(doc,'digests',yamlDigests(censusDigests(packageRoot,familyDigestFiles(family))),{parent:'provenance'});
    fs.writeFileSync(file,doc);written.push(`${family.knowledge}/DNA.yaml`);
  }
  return {written,census};
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

export async function main(argv=process.argv.slice(2)){
  if(argv.includes('--help'))return {exitCode:0,text:'Usage: node scripts/checks/grammar-knowledge.mjs [--write] [--json]\n\nCompares knowledge/grammars/*/DNA.yaml with packages/grammar source (renderers, classes, rule ids, tokens, dna.ts values, version). --write refreshes the measured blocks in place. Exit 0 is clean, 1 reports drift.\n'};
  if(argv.includes('--write')){
    const {written,census}=await writeGrammarKnowledge();
    return {exitCode:0,text:`rewrote ${written.join(', ')} from ${census.package}@${census.version} (${census.renderers.length} renderers)\n`};
  }
  const result=await checkGrammarKnowledge();
  if(argv.includes('--json'))return {exitCode:result.ok?0:1,text:`${JSON.stringify(result,null,2)}\n`};
  const lines=[`grammar knowledge vs ${result.version} (${result.renderers} renderers): ${result.ok?'no drift':`${result.findings.length} drift finding(s)`}`];
  for(const f of result.findings.slice(0,60))lines.push(`  ${f.file} ${f.what}: ${f.detail}`);
  if(result.findings.length>60)lines.push(`  ... ${result.findings.length-60} more`);
  if(!result.ok)lines.push('  refresh the measured blocks with: node scripts/checks/grammar-knowledge.mjs --write');
  return {exitCode:result.ok?0:1,text:`${lines.join('\n')}\n`};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {exitCode,text}=await main();
  process.stdout.write(text);
  process.exitCode=exitCode;
}
