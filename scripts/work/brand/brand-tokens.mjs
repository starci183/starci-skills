// brand-tokens.mjs - reading the real tokens out of the real source for the brand checks (brand.mjs): css custom
// properties by scope, JSON/YAML token files, and the lookup that follows a `var(--other)` through the declared sources.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {grammarDistRefusal} from '../../gates/grammar-dist.mjs';
import {slash} from '../../lib/path-key.mjs';
import {stripImportant} from './brand-colour.mjs';

const SOURCE_BYTES_LIMIT=4*1024*1024;
const REGEX=Object.freeze({declaration:new RegExp(['^(--[A-Za-z0-9_-]+)',String.raw`\s*:\s*`,String.raw`([\s\S]+)$`].join('')),semicolons:new RegExp([';+','$'].join(''))});

// ---------------------------------------------------------------------------
// Reading the real tokens out of the real source.
// ---------------------------------------------------------------------------

/**
 * Every `--name: value` declaration of a stylesheet, with the selector that carries it. Declarations are
 * split by scope because a brand's `color.tokens[].value` is the default (light) value: a dark override is
 * reported as context, never accepted as a match for it.
 */
export function parseCssCustomProperties(text){
  const source=String(text??'').replace(/\/\*[\s\S]*?\*\//g,' ');
  const base=new Map(),dark=new Map(),all=[];
  const stack=[];
  let buffer='';
  const flush=()=>{
    const declaration=buffer.trim();
    buffer='';
    const match=REGEX.declaration.exec(declaration);
    if(!match)return;
    const selector=stack.filter(Boolean).join(' ');
    const value=stripImportant(match[2].trim()).replace(REGEX.semicolons,'').trim();
    // `:root:not([data-theme="light"])` inside a dark media query is a dark scope: a negated light theme is not a light one.
    const asserted=selector.replace(/:not\([^)]*\)/g,' ');
    const isDark=/dark/i.test(selector)&&!/data-theme\s*=\s*["']?light/i.test(asserted);
    const entry={name:match[1],value,selector,scope:isDark?'dark':'base'};
    all.push(entry);
    const target=isDark?dark:base;
    if(!target.has(entry.name))target.set(entry.name,entry);
  };
  for(const character of source){
    if(character==='{'){stack.push(buffer.trim());buffer='';continue;}
    if(character==='}'){flush();stack.pop();continue;}
    if(character===';'){flush();continue;}
    buffer+=character;
  }
  flush();
  return {base,dark,all};
}

/**
 * A JSON/YAML token file, flattened by key. Three authored shapes are accepted: a `tokens: [{name,value}]`
 * list (the shape the grammar DNA uses), flat `--token: value` keys, and a nested object whose key path
 * spells the token (`starci.core.primary` is `--starci-core-primary`).
 */
export function parseTokenData(data){
  const maps={exact:new Map(),derived:new Map()};
  walkTokens(data,[],maps);
  return maps;
}

const putToken=(map,name,value)=>{if(typeof name==='string'&&name&&!map.has(name))map.set(name,String(value));};
const isTokenLeaf=value=>typeof value==='string'||typeof value==='number';

function walkTokens(node,trail,maps){
  if(Array.isArray(node)){
    for(const item of node){
      if(item&&typeof item==='object')walkTokenItem(item,trail,maps);
    }
    return;
  }
  if(node&&typeof node==='object')walkTokenEntries(node,trail,maps);
}

function walkTokenEntries(node,trail,maps){
  for(const [key,value] of Object.entries(node)){
    const next=[...trail,key];
    if(!isTokenLeaf(value)){walkTokens(value,key.startsWith('--')?trail:next,maps);continue;}
    if(key.startsWith('--'))putToken(maps.exact,key,value);
    else {putToken(maps.derived,key,value);putToken(maps.derived,`--${next.join('-')}`,value);}
  }
}

/** One object of a `tokens: [{name,value}]` list: a named leaf, else a nested structure. */
function walkTokenItem(item,trail,maps){
  if(!isTokenLeaf(item.value)){walkTokens(item,trail,maps);return;}
  const name=item.name??item.token;
  if(typeof name==='string')putToken(name.startsWith('--')?maps.exact:maps.derived,name,item.value);
}

export const readText=file=>{
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size>SOURCE_BYTES_LIMIT)throw new Error('A brand source must be a bounded real file.');
  return fs.readFileSync(file,'utf8');
};

const PATH_ESCAPES='the declared path escapes its repository root';
/** Why a declared source path cannot be read inside `sourceRoot`, or null. */
function sourcePathError(sourceRoot,declared){
  if(!declared||path.isAbsolute(declared)||declared.split('/').includes('..'))return PATH_ESCAPES;
  const file=path.resolve(sourceRoot,declared);
  if(path.relative(path.resolve(sourceRoot),file).startsWith('..'))return PATH_ESCAPES;
  return fs.existsSync(file)?null:'this repository does not carry the declared file';
}

/** The token lookup of a read source file: css custom properties, or a JSON/YAML token file. */
function parseSourceText(file,source,text,entry){
  if(source.kind==='css'||path.extname(file).toLowerCase()==='.css'){
    const parsed=parseCssCustomProperties(text);
    return {...entry,found:true,declarations:parsed.all.length,lookup:{css:parsed}};
  }
  try{
    const data=path.extname(file).toLowerCase()==='.json'?JSON.parse(text):parseYaml(text);
    const parsed=parseTokenData(data);
    return {...entry,found:true,declarations:parsed.exact.size+parsed.derived.size,lookup:{tokens:parsed}};
  }catch(error){return {...entry,found:true,error:`unreadable token file: ${String(error.message??error)}`};}
}

/** One declared source file, read into a token lookup. Never throws: an unreadable source is reported. */
export function readSourceTokens(sourceRoot,source){
  const declared=slash(source?.path??'');
  const entry={repository:source?.repository??null,path:declared,kind:source?.kind??null,found:false,declarations:0,scope:null};
  const pathError=sourcePathError(sourceRoot,declared);
  if(pathError)return {...entry,error:pathError};
  const file=path.resolve(sourceRoot,declared);
  // A source inside a built @starci/grammar dist is read only when that dist is the build of its source:
  // a stale dist would bind the brand to tokens the package no longer ships.
  const refusal=grammarDistRefusal(file);
  if(refusal)return {...entry,found:true,error:refusal.message,staleGrammarDist:{state:refusal.state,root:refusal.root,fix:refusal.fix}};
  let text;
  try{text=readText(file);}catch(error){return {...entry,found:true,error:String(error.message??error)};}
  return parseSourceText(file,source,text,entry);
}

/** The first declaration of this token across the declared sources, preferring the default scope. */
export function lookupToken(sources,token,seen=new Set()){
  if(seen.has(token))return null;
  const nextSeen=new Set(seen).add(token);
  for(const scope of ['base','dark']){
    for(const source of sources){
      const hit=lookupInSource(sources,source,token,scope,nextSeen);
      if(hit)return hit;
    }
  }
  return null;
}

/** A css declaration of the token in `scope`, its `var(--other)` followed through the declared sources. */
function resolveCssDeclaration(sources,source,found,scope,seen){
  const reference=/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/.exec(String(found.value).trim())?.[1]??null;
  if(reference){
    const resolved=lookupToken(sources,reference,seen);
    if(resolved)return {...resolved,file:source.path,selector:found.selector,scope,declaredValue:found.value,resolvedFrom:reference};
  }
  return {value:found.value,file:source.path,selector:found.selector,scope};
}

/** The token as one source declares it in `scope` (a token file only answers the base scope), or null. */
function lookupInSource(sources,source,token,scope,seen){
  const found=source.lookup?.css?.[scope].get(token);
  if(found)return resolveCssDeclaration(sources,source,found,scope,seen);
  const tokens=scope==='base'?source.lookup?.tokens:null;
  if(!tokens)return null;
  const value=tokens.exact.get(token)??tokens.derived.get(token)??tokens.derived.get(token.replace(/^--/,''));
  return value===undefined?null:{value,file:source.path,selector:null,scope:'base'};
}
