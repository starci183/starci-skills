import fs from 'node:fs';
import path from 'node:path';
import {slash} from '../../lib/path-key.mjs';
import {byCodeUnit} from '../../lib/list.mjs';
import {lexSource,read,uniq} from './grammar-knowledge-lex.mjs';

/**
 * The Common renderer registry of the grammar knowledge census (grammar-knowledge.mjs): the registered
 * renderers, the rule-id catalog, and each renderer's census (kind, source, classes, rule ids, closed prop values).
 */

// An `as` word between whitespace, found where a whitespace run starts so a long run is read once.
const AS_WORD=/(?<!\s)\s+as\s+/;
// The tail `| undefined` of a type, found where its whitespace run starts.
const UNDEFINED_TAIL=/(?<!\s)\s*\|\s*undefined$/;
const LINE_TERMINATOR=/[\n\r\u2028\u2029]/;
const WORD='[a-z0-9]+';
const DASHED=`${WORD}(?:-${WORD})*`;
const LITERAL=String.raw`(?:"[^"]*"|\d+)`;
const LITERAL_UNION=String.raw`${LITERAL}(?:\s*\|\s*${LITERAL})*`;
const RULE_ID=/^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-(?:\d+|AUTO)$/;
const CLASS_LITERAL=new RegExp(String.raw`(?<![\w-])((?:starci-core|grammar)-${DASHED}(?:--${DASHED})?)(?![\w-])`,'g');
const LITERAL_ALIAS=new RegExp(String.raw`^(?:export\s+)?type\s+([A-Z]\w*)\s*=\s*(${LITERAL_UNION})\s*$`,'gm');
const LITERAL_UNION_ONLY=new RegExp(`^${LITERAL_UNION}$`);
const MEMBER_TYPE='(?:"[^"]*"|[^;{}"])+?';
const MEMBER=new RegExp(String.raw`readonly\s+(\w+)\??\s*:\s*(${MEMBER_TYPE})\s*(?=;|\}|,?\s*$)`,'g');

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
  if(!body)throw new Error('COMMON_GRAMMAR_COMPONENTS was not found in src/common/registry.tsx');
  const names=[];
  const groups=[];
  for(const part of body[1].split(',').map(item=>item.trim()).filter(Boolean)){
    const spread=/^\.\.\.([A-Z0-9_]+)$/.exec(part);
    if(!spread){names.push({name:part,group:'base'});continue;}
    const file=fs.readdirSync(commonDir).filter(name=>/^renderers-.+\.ts$/.test(name))
      .map(name=>path.join(commonDir,name)).find(candidate=>new RegExp(String.raw`export const ${spread[1]}\b`).test(read(candidate)));
    if(!file)throw new Error(`${spread[1]} is spread into COMMON_GRAMMAR_COMPONENTS but no renderers-*.ts defines it`);
    const group=/renderers-(.+)\.ts$/.exec(file)[1];
    groups.push({group,map:spread[1],file:slash(path.relative(packageRoot,file))});
    const map=new RegExp(String.raw`export const ${spread[1]}\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\s*as const\)`).exec(lexSource(read(file)).code);
    for(const name of map[1].split(',').map(item=>item.trim()).filter(Boolean))names.push({name,group});
  }
  return {names,groups};
}

/** Every value the Common barrel files re-export, mapped to the module file and the props type beside it. */
function barrelExports(packageRoot){
  const commonDir=path.join(packageRoot,'src','common');
  const files=['renderers.ts',...fs.readdirSync(commonDir).filter(name=>/^renderers-.+\.ts$/.test(name)).sort(byCodeUnit)];
  const exported=new Map();
  for(const name of files){
    const file=path.join(commonDir,name);
    for(const statement of exportStatements(read(file))){
      const moduleFile=resolveModule(file,statement.from);
      const types=new Set(statement.names.filter(part=>part.startsWith('type ')).map(part=>part.slice(5).trim()));
      for(const part of statement.names.filter(item=>!item.startsWith('type '))){
        const value=part.split(AS_WORD).pop().trim();
        exported.set(value,{moduleFile,propsType:types.has(`${value}Props`)?`${value}Props`:null,barrel:name});
      }
    }
  }
  return exported;
}

/** The canonical rule ids and the prefixes they use, from the generated catalog. */
export function ruleCatalog(packageRoot){
  const text=read(path.join(packageRoot,'src','common','rule-catalog.generated.ts'));
  const ids=uniq([...text.matchAll(/"([A-Z][A-Z0-9-]*-\d+)"/g)].map(m=>m[1]));
  const prefixes=new Set(ids.map(id=>id.replace(/-\d+$/,'')));
  return {ids,prefixes};
}

const classesIn=value=>[...value.matchAll(CLASS_LITERAL)].map(m=>m[1]);

/** The text of one top-level exported declaration: from its line to the next top-level `export`. */
function declarationText(code,name){
  const start=new RegExp(String.raw`^export\s+(?:const|function|let|class)\s+${name}\b`,'m').exec(code);
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
      .map(part=>part.split(AS_WORD)[0].trim());
    imports.push({target,names});
  }
  return imports;
}

const literalValues=text=>text.split('|').map(part=>part.trim()).map(part=>part.startsWith('"')?part.slice(1,-1):part);
const isLiteralUnion=text=>LITERAL_UNION_ONLY.test(text);

/** Literal union aliases (`type X = "a" | "b"`) declared across the package source. */
function literalAliases(files){
  const aliases=new Map();
  for(const file of files){
    for(const m of read(file).matchAll(LITERAL_ALIAS)){
      aliases.set(m[1],{file,values:literalValues(m[2])});
    }
  }
  return aliases;
}

/** Whether the text between a type's name and its `=` is nothing but optional type parameters. */
const onlyTypeParameters=text=>{
  const head=text.trimEnd();
  return head===''||(head.length>=2&&head[0]==='<'&&head.endsWith('>'));
};

/** A `type Name<...> = body` line: `{name, body}`, else null. */
function typeDeclaration(line){
  const head=/^(?:export\s+)?type\s+(\w+)/.exec(line);
  if(!head)return null;
  const rest=line.slice(head[0].length);
  const equals=rest.indexOf('=');
  if(equals<0||!onlyTypeParameters(rest.slice(0,equals)))return null;
  const body=rest.slice(equals+1).trimStart();
  return LINE_TERMINATOR.test(body)?null:{name:head[1],body};
}

const bracketDelta=text=>(text.match(/[{(]/g)??[]).length-(text.match(/[})]/g)??[]).length;

/** The `type X = ...` declarations of a module, each as the lines that spell it. */
function typeDeclarations(lines){
  const declarations=new Map();
  for(let index=0;index<lines.length;index++){
    const declared=typeDeclaration(lines[index]);
    if(!declared)continue;
    const text=[declared.body];
    let open=bracketDelta(declared.body);
    for(let j=index+1;j<lines.length&&(open>0||/^\s*[|&]/.test(lines[j]));j++){
      text.push(lines[j]);
      open+=bracketDelta(lines[j]);
    }
    declarations.set(declared.name,text);
  }
  return declarations;
}

/** The local object type a member's type names, when its declaration opens a `{`. */
function localObjectRef(type,declarations){
  const ref=/^([A-Z]\w*)(?:\s*\|\s*undefined)?$/.exec(type);
  return ref&&/^\s*\{/.test(declarations.get(ref[1])?.[0]??'')?ref[1]:null;
}

/** Collect the `readonly` members of one declaration line, descending into the local types it names. */
function collectLine(state,line,depth){
  for(const member of line.matchAll(MEMBER)){
    state.members.push({prop:member[1],type:member[2].trim()});
    // A member typed as a local object type (an item record, say) publishes its own closed members.
    const nested=localObjectRef(member[2].trim(),state.declarations);
    if(nested)collectType(state,nested,depth+1);
  }
  const rest=line.replace(MEMBER,'').replace(/"[^"]*"/g,'');
  for(const ref of rest.matchAll(/\b([A-Z]\w*)\b/g))collectType(state,ref[1],depth+1);
}

function collectType(state,name,depth){
  if(state.visited.has(name)||depth>4)return;
  state.visited.add(name);
  for(const line of state.declarations.get(name)??[])collectLine(state,line,depth);
}

/** The closed entry one member type publishes, else null. */
function closedEntry(prop,type,aliases,moduleDir){
  const cleaned=type.replace(UNDEFINED_TAIL,'').trim();
  if(isLiteralUnion(cleaned))return {prop,values:literalValues(cleaned)};
  if(!/^[A-Z]\w*$/.test(cleaned)||cleaned.endsWith('Props'))return null;
  const alias=aliases.get(cleaned);
  if(alias&&path.dirname(path.resolve(alias.file))===moduleDir)return {prop,values:alias.values};
  if(alias||['IconSource','PresentationState'].includes(cleaned))return {prop,type:cleaned};
  return null;
}

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
  const state={declarations:typeDeclarations(lines),visited:new Set(),members:[]};
  collectType(state,propsType,0);
  const seen=new Set();
  const closed=[];
  const moduleDir=path.dirname(path.resolve(moduleFile));
  for(const {prop,type} of state.members){
    if(seen.has(prop))continue;
    const entry=closedEntry(prop,type,aliases,moduleDir);
    if(!entry)continue;
    seen.add(prop);
    closed.push(entry);
  }
  return closed;
}

/** Record the `data-contract` claims of one source file; the offsets of those literal strings are returned. */
function contractClaims(code,claims,isRuleId){
  const literalAt=new Set();
  for(const m of code.matchAll(/data-contract="([^"]*)"/g)){
    literalAt.add(m.index+'data-contract='.length);
    for(const token of m[1].split(/\s+/))if(isRuleId(token))claims.add(token);
  }
  return literalAt;
}

/** Record the classes and computed rule-id claims the strings of one source file state. */
function scanClaims(code,strings,facts,isRuleId){
  const literalAt=contractClaims(code,facts.claims,isRuleId);
  for(const string of strings){
    for(const cls of classesIn(string.value))facts.classes.add(cls);
    if(literalAt.has(string.start))continue;
    for(const token of string.value.split(/[\s,]+/))if(isRuleId(token))facts.computed.add(token);
  }
}

/** The classes of the strings inside one declaration of an imported helper module. */
function spanClasses(lexed,span,classes){
  for(const string of lexed.strings){
    if(string.start<span.start||string.start>=span.end)continue;
    for(const cls of classesIn(string.value))classes.add(cls);
  }
}

/** One hop: helpers (never other renderers) imported by name from another package module. */
function importedHelperClasses(file,code,{ownFiles,rendererNames,classes}){
  for(const {target,names} of valueImports(file,code)){
    if(ownFiles.includes(target))continue;
    const lexed=lexSource(read(target));
    for(const imported of names){
      if(rendererNames.has(imported))continue;
      const span=declarationText(lexed.code,imported);
      if(span)spanClasses(lexed,span,classes);
    }
  }
}

/** The classes and rule-id claims the files of one renderer state. */
function rendererFacts(moduleFile,flat,{catalog,rendererNames}){
  const moduleDir=path.dirname(moduleFile);
  const ownFiles=flat?[moduleFile]:fs.readdirSync(moduleDir)
    .filter(file=>/\.(tsx?|mts)$/.test(file)&&!/\.(spec|test)\./.test(file)).map(file=>path.join(moduleDir,file)).sort(byCodeUnit);
  const facts={classes:new Set(),claims:new Set(),computed:new Set()};
  const isRuleId=token=>RULE_ID.test(token)&&catalog.prefixes.has(token.replace(/-(?:\d+|AUTO)$/,''));
  for(const file of ownFiles){
    const {code,strings}=lexSource(read(file));
    scanClaims(code,strings,facts,isRuleId);
    importedHelperClasses(file,code,{ownFiles,rendererNames,classes:facts.classes});
  }
  return facts;
}

/** One renderer's census: kind, source, classes and rule ids, and closed prop values. */
function censusRenderer({name,group},{packageRoot,exported,catalog,rendererNames,aliases}){
  const entry=exported.get(name);
  if(!entry?.moduleFile)throw new Error(`${name} is registered in COMMON_GRAMMAR_COMPONENTS but no Common barrel re-exports it`);
  const moduleFile=entry.moduleFile;
  const relative=slash(path.relative(path.join(packageRoot,'src','core'),moduleFile));
  const flat=!relative.includes('/');
  const facts=rendererFacts(moduleFile,flat,{catalog,rendererNames});
  return {
    component:name,
    propsType:entry.propsType,
    kind:flat?'core':relative.split('/')[0],
    group,
    source:slash(path.relative(path.dirname(packageRoot),moduleFile)).replace(/^/,'packages/'),
    closedValues:closedValuesOf(moduleFile,entry.propsType,aliases),
    claims:[...facts.claims].sort(byCodeUnit),
    computedClaims:[...facts.computed].filter(id=>!facts.claims.has(id)).sort(byCodeUnit),
    classes:[...facts.classes].sort(byCodeUnit),
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
    .sort((a,b)=>byCodeUnit(a.component,b.component));
  return {renderers,groups,catalog};
}
