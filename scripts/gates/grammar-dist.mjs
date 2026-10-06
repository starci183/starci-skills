// grammar-dist.mjs - is packages/grammar/dist the build of the source beside it? The judge every grammar dist reader asks
// (gates, work, the reconciler and land); scripts/checks/check-grammar-dist.mjs is its self-check CLI.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {readJsonFile as readJson} from '../lib/json.mjs';
import {slash} from '../lib/path-key.mjs';
import {DIGEST_ALGORITHM,STAMP_FILE,STAMP_SCHEMA,distDigest,sourceDigest} from '../../packages/grammar/scripts/build-stamp.mjs';

/**
 * A built `packages/grammar/dist` is what products actually get: `file:` consumers link the package
 * directory, and the brand check reads the exported CSS. `dist/` is not tracked, so nothing but a build
 * refreshes it, and a merge that changes the source leaves the previous build in place. This module
 * decides whether a dist is the build of the source beside it, and every reader of grammar dist asks it
 * first and refuses a dist it does not call fresh.
 *
 * Fresh means: `dist/.build-stamp.json` exists, names the manifest's version, was made with this
 * digest algorithm from the current source digest, the built files still hash to the stamp's dist
 * digest, and every `--*` custom property the source CSS declares has the same value in the copied dist
 * CSS. A package that does not carry its source (a registry install) cannot be rebuilt or compared, so
 * it is `unverifiable` and allowed; if it carries a stamp, the version and dist digest still bind.
 */

export const GRAMMAR_PACKAGE='@starci/grammar';
export const GRAMMAR_DIST_FIX='run npm run build in packages/grammar';
const GRAMMAR_DIST_CHECK='starci/grammar-dist-check@1';
const TOKEN_DIFF_CAP=20;


export const defaultGrammarPackageRoot=()=>path.join(skillRoot,'packages','grammar');

/** Every `--name: value` declaration outside a comment, in document order, whitespace collapsed. */
export function cssTokenDeclarations(text){
  const code=String(text).replace(/\/\*[\s\S]*?\*\//g,'');
  return [...code.matchAll(/(--[A-Za-z0-9_-]+)\s*:([^;{}]*)/g)].map(m=>({name:m[1],value:m[2].trim().replace(/\s+/g,' ')}));
}

/** The families `packages/grammar/scripts/copy-css.mjs` copies: every `src/<family>` that has a `styles.css`. */
function cssFamilies(packageRoot){
  const src=path.join(packageRoot,'src');
  if(!fs.existsSync(src))return [];
  return fs.readdirSync(src,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(src,entry.name,'styles.css')))
    .map(entry=>entry.name).sort();
}

/**
 * Compares every family's `--*` token declarations in dist CSS with the source CSS they were copied from.
 * Returns the differing tokens (capped) and how many declarations were compared.
 */
function compareCssTokens(packageRoot){
  const differences=[];let compared=0;
  for(const family of cssFamilies(packageRoot)){
    const dir=path.join(packageRoot,'src',family);
    for(const name of fs.readdirSync(dir).filter(file=>file.endsWith('.css')).sort()){
      const file=`${family}/${name}`;
      const built=path.join(packageRoot,'dist',family,name);
      const source=cssTokenDeclarations(fs.readFileSync(path.join(dir,name),'utf8'));
      if(!fs.existsSync(built)){differences.push({file,token:null,src:`${source.length} declarations`,dist:'file missing'});continue;}
      const dist=cssTokenDeclarations(fs.readFileSync(built,'utf8'));
      compared+=source.length;
      const group=list=>list.reduce((map,{name:token,value})=>map.set(token,[...(map.get(token)??[]),value]),new Map());
      const [want,have]=[group(source),group(dist)];
      for(const token of [...new Set([...want.keys(),...have.keys()])].sort(byCodeUnit)){
        const [a,b]=[want.get(token)??[],have.get(token)??[]];
        if(a.join('\0')!==b.join('\0'))differences.push({file,token,src:a.join(' | ')||null,dist:b.join(' | ')||null});
      }
    }
  }
  return {compared,differences:differences.slice(0,TOKEN_DIFF_CAP),differenceCount:differences.length};
}

/**
 * The nearest package that owns `file` when it is `@starci/grammar`, with whether the file is under its
 * `dist/`. Symlinks are resolved first, so `node_modules/@starci/grammar` of a `file:` consumer lands on
 * the linked package directory.
 */
export function grammarPackageOf(file){
  let real;
  try{real=fs.realpathSync(path.resolve(file));}catch{return null;}
  for(let cursor=path.dirname(real);path.dirname(cursor)!==cursor;cursor=path.dirname(cursor)){
    const manifest=path.join(cursor,'package.json');
    if(!fs.existsSync(manifest))continue;
    if(readJson(manifest)?.name!==GRAMMAR_PACKAGE)return null;
    const relative=slash(path.relative(cursor,real));
    return {root:cursor,file:real,inDist:relative==='dist'||relative.startsWith('dist/')};
  }
  return null;
}

/**
 * The freshness of one grammar package's dist. `state` is one of fresh, unverifiable (no source carried,
 * nothing to compare), missing, unstamped, stale, tampered; `ok` is true only for the first two.
 */
/** The `; <token summary>` tail of a detail string, empty when no token differs. */
const tokenTail=tokens=>tokens.differenceCount?'; '+tokenSummary(tokens):'';

/** The result for a dist with no valid stamp: unstamped when source exists, unverifiable when it does not. */
const unstampedResult=(hasSource,result,tokens,evidence,stampFile)=>
  hasSource
    ?result('unstamped',`dist/${STAMP_FILE} is ${fs.existsSync(stampFile)?'not a valid build stamp':'missing'}, so this dist was not produced by the current build script${tokenTail(tokens)}`,evidence)
    :result('unverifiable','the package carries neither source nor a build stamp (a registry install from before stamps); nothing to compare',evidence);

/** The result when the stamp's algorithm or source digest no longer binds the current source, or null. */
const sourceStaleness=(root,stamp,tokens,evidence,result)=>{
  if(stamp.algorithm!==DIGEST_ALGORITHM)
    return result('stale',`the stamp was made with digest ${stamp.algorithm ?? '(none)'}, this check computes ${DIGEST_ALGORITHM}`,evidence);
  const current=sourceDigest(root);
  if(stamp.sourceDigest!==current)
    return result('stale',`dist was built from source ${short(stamp.sourceDigest)} (${stamp.version}, ${stamp.builtAt}) but the source is now ${short(current)}${tokenTail(tokens)}`,{...evidence,sourceDigest:current});
  return null;
};

/** The result when the stamp's version/dist digest no longer binds the package, or null. */
const bindingStaleness=(root,manifest,stamp,tokens,evidence,result)=>{
  if(stamp.version!==manifest.version)
    return result('stale',`dist was built as version ${stamp.version} but package.json is ${manifest.version}`,evidence);
  const built=distDigest(root);
  if(stamp.distDigest!==built)
    return result('tampered',`dist files changed after the build (stamp ${short(stamp.distDigest)}, now ${short(built)})${tokenTail(tokens)}`,{...evidence,distDigest:built});
  if(tokens.differenceCount)return result('tampered',tokenSummary(tokens),evidence);
  return null;
};

export function grammarDistStatus(packageRoot=defaultGrammarPackageRoot()){
  const root=path.resolve(packageRoot);
  const manifest=readJson(path.join(root,'package.json'));
  const base={schema:GRAMMAR_DIST_CHECK,root:slash(root),package:manifest?.name??null,version:manifest?.version??null,fix:GRAMMAR_DIST_FIX};
  const result=(state,detail,extra={})=>({...base,state,ok:state==='fresh'||state==='unverifiable',detail,...extra});
  if(!manifest)return result('missing',`${slash(root)}/package.json is missing or unreadable`);
  const hasSource=fs.existsSync(path.join(root,'src'));
  const distDir=path.join(root,'dist');
  if(!fs.existsSync(distDir)||!fs.statSync(distDir).isDirectory())
    return hasSource?result('missing','dist/ does not exist; the package has never been built here'):result('unverifiable','no dist/ and no source: nothing to verify');
  const stampFile=path.join(distDir,STAMP_FILE);
  const stamp=readJson(stampFile);
  const tokens=hasSource?compareCssTokens(root):{compared:0,differences:[],differenceCount:0};
  const evidence={stamp,tokens};
  if(!stamp||stamp.schema!==STAMP_SCHEMA)return unstampedResult(hasSource,result,tokens,evidence,stampFile);
  if(hasSource){
    const stale=sourceStaleness(root,stamp,tokens,evidence,result);
    if(stale)return stale;
  }
  const bound=bindingStaleness(root,manifest,stamp,tokens,evidence,result);
  if(bound)return bound;
  return hasSource
    ?result('fresh',`${manifest.name}@${manifest.version} built from source ${short(stamp.sourceDigest)} at ${stamp.builtAt}; ${tokens.compared} token declarations match src`,evidence)
    :result('unverifiable',`${manifest.name}@${manifest.version} carries no source; its stamp and built files agree`,evidence);
}

const short=digest=>typeof digest==='string'?digest.replace(/^sha256:/,'').slice(0,12):'(none)';
function tokenSummary(tokens){
  const shown=tokens.differences.slice(0,3).map(d=>d.token?`${d.file} ${d.token} src=${d.src??'(absent)'} dist=${d.dist??'(absent)'}`:`${d.file} ${d.dist}`);
  return `${tokens.differenceCount} dist CSS token value(s) differ from src: ${shown.join('; ')}${tokens.differenceCount>3?'; ...':''}`;
}

/** One line a reader throws or reports when it refuses a dist. Ends with the exact fix. */
export function grammarDistMessage(status){
  return `${status.package??GRAMMAR_PACKAGE} dist at ${status.root}/dist is ${status.state}: ${status.detail}. Fix: ${GRAMMAR_DIST_FIX}.`;
}

/**
 * The refusal for a file a reader is about to read: null when the file is not in a grammar dist or the
 * dist is fresh (or unverifiable), otherwise the status with its message.
 */
export function grammarDistRefusal(file){
  const owner=grammarPackageOf(file);
  if(!owner?.inDist)return null;
  const status=grammarDistStatus(owner.root);
  return status.ok?null:{...status,message:grammarDistMessage(status)};
}

/** Throws the fix message when `packageRoot` is a grammar package whose dist is not fresh. */
export function assertGrammarDistFresh(packageRoot){
  if(readJson(path.join(packageRoot,'package.json'))?.name!==GRAMMAR_PACKAGE)return null;
  const status=grammarDistStatus(packageRoot);
  if(!status.ok)throw new Error(grammarDistMessage(status));
  return status;
}
