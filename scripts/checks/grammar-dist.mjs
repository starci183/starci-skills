import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {skillRoot} from '../../engine/runtime-root.mjs';
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
export const GRAMMAR_DIST_CHECK='starci/grammar-dist-check@1';
const TOKEN_DIFF_CAP=20;
const slash=value=>value.replaceAll('\\','/');
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};

export const defaultGrammarPackageRoot=()=>path.join(skillRoot,'packages','grammar');

/** Every `--name: value` declaration outside a comment, in document order, whitespace collapsed. */
export function cssTokenDeclarations(text){
  const code=String(text).replace(/\/\*[\s\S]*?\*\//g,'');
  return [...code.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]*)/g)].map(m=>({name:m[1],value:m[2].trim().replace(/\s+/g,' ')}));
}

/** The families `scripts/copy-css.mjs` copies: every `src/<family>` that has a `styles.css`. */
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
export function compareCssTokens(packageRoot){
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
      for(const token of [...new Set([...want.keys(),...have.keys()])].sort()){
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
  if(!stamp||stamp.schema!==STAMP_SCHEMA){
    if(!hasSource)return result('unverifiable','the package carries neither source nor a build stamp (a registry install from before stamps); nothing to compare',evidence);
    return result('unstamped',`dist/${STAMP_FILE} is ${fs.existsSync(stampFile)?'not a valid build stamp':'missing'}, so this dist was not produced by the current build script${tokens.differenceCount?`; ${tokenSummary(tokens)}`:''}`,evidence);
  }
  if(hasSource){
    if(stamp.algorithm!==DIGEST_ALGORITHM)
      return result('stale',`the stamp was made with digest ${stamp.algorithm ?? '(none)'}, this check computes ${DIGEST_ALGORITHM}`,evidence);
    const current=sourceDigest(root);
    if(stamp.sourceDigest!==current)
      return result('stale',`dist was built from source ${short(stamp.sourceDigest)} (${stamp.version}, ${stamp.builtAt}) but the source is now ${short(current)}${tokens.differenceCount?`; ${tokenSummary(tokens)}`:''}`,{...evidence,sourceDigest:current});
  }
  if(stamp.version!==manifest.version)
    return result('stale',`dist was built as version ${stamp.version} but package.json is ${manifest.version}`,evidence);
  const built=distDigest(root);
  if(stamp.distDigest!==built)
    return result('tampered',`dist files changed after the build (stamp ${short(stamp.distDigest)}, now ${short(built)})${tokens.differenceCount?`; ${tokenSummary(tokens)}`:''}`,{...evidence,distDigest:built});
  if(tokens.differenceCount)return result('tampered',tokenSummary(tokens),evidence);
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
  if(!owner||!owner.inDist)return null;
  const status=grammarDistStatus(owner.root);
  return status.ok?null:{...status,message:grammarDistMessage(status)};
}

/** Throws the fix message when `packageRoot` is a grammar package whose dist is not fresh. */
export function assertGrammarDistFresh(packageRoot){
  if(readJson(path.join(packageRoot,'package.json'))?.name!==GRAMMAR_PACKAGE)return null;
  const status=grammarDistStatus(packageRoot);
  if(!status.ok)throw Error(grammarDistMessage(status));
  return status;
}

export function grammarDistMain(argv=[]){
  if(argv.includes('--help'))return {exitCode:0,text:`Usage: node scripts/checks/grammar-dist.mjs [--root <packages/grammar>] [--json]\n\nFails unless the grammar dist is the build of the current source (build stamp + source digest + dist digest + --* tokens). Fix: ${GRAMMAR_DIST_FIX}.\n`};
  const at=argv.indexOf('--root');
  const status=grammarDistStatus(at>=0?argv[at+1]:defaultGrammarPackageRoot());
  if(argv.includes('--json'))return {exitCode:status.ok?0:1,text:`${JSON.stringify(status,null,2)}\n`};
  if(status.ok)return {exitCode:0,text:`grammar dist: ${status.state} (${status.detail})\n`};
  const lines=[`FAIL: ${grammarDistMessage(status)}`];
  for(const d of status.tokens?.differences??[])lines.push(`  ${d.file} ${d.token??''} src=${d.src??'(absent)'} dist=${d.dist??'(absent)'}`);
  return {exitCode:1,text:`${lines.join('\n')}\n`};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {exitCode,text}=grammarDistMain(process.argv.slice(2));
  (exitCode?process.stderr:process.stdout).write(text);
  process.exitCode=exitCode;
}
