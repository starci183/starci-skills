import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../../engine/yaml.mjs';
import {skillRoot} from '../../engine/runtime-root.mjs';
import {grammarDistRefusal} from './grammar-dist.mjs';

/**
 * The brand is proven, not stated. A brand record says what the product's colour, mascot and icon law is;
 * this module re-derives each of those claims from the artefacts that actually ship - the frontend's CSS
 * custom properties, the asset bytes under the tree, the import lines of the source, the grammar family's
 * DNA - and reports every claim it could not reproduce.
 *
 * Nothing here renders, installs, commits or edits: every check reads, and the colour mathematics is
 * implemented in this file so a brand is never proven by a dependency that may not be installed.
 *
 * A check that cannot be performed is `skip` with the reason, never `pass`: a missing source root, an
 * absent grammar snapshot or a source file this repository does not carry leaves the claim unproven, and an
 * unproven claim must not read as a proven one.
 */
export const BRAND_CHECKS='starci/brand-checks@1';
export const CHECK_IDS=['tokens-match-source','contrast-aa','primary-danger-distinct','mascot-assets-present','icon-set-only','tokens-in-grammar'];
/** WCAG 2.x: text needs 4.5:1, a non-text indicator (primary on its surface) needs 3:1. */
export const DEFAULT_MIN_CONTRAST=4.5;
export const NON_TEXT_MIN_CONTRAST=3;
/**
 * Every OKLab distance in this module is reported on the x100 scale (Euclidean distance in OKLab times
 * 100), so black against white is 100 and a just-noticeable difference is roughly 2. A destructive colour
 * must be 20 apart from the primary - a fifth of the whole perceptual range - or a user reads "delete" as
 * "continue". The match tolerance is half a unit: below perception, wide enough for hex/oklch rounding.
 */
export const MIN_PRIMARY_DANGER_DELTA=20;
export const TOKEN_TOLERANCE=0.5;
export const ASSET_EXTENSIONS=['.png','.svg','.webp','.jpg','.jpeg'];
export const OFFENDER_CAP=20;
const SCAN_EXCLUDED=new Set(['node_modules','dist','.next','.git','.dist','coverage','build','out','.turbo','.cache']);
const SCAN_FILE_LIMIT=5000;
const SCAN_BYTES_LIMIT=512*1024;
const SOURCE_BYTES_LIMIT=4*1024*1024;
/** Packages whose name advertises icons; used only to decide what counts as an icon import to judge. */
const ICON_HINT=/icon|lucide|phosphor|feather|font-?awesome|material-symbols|tabler|remixicon|boxicons|ionicons|bootstrap-icons/i;

const slash=value=>String(value??'').replaceAll('\\','/');
const round=(value,places=4)=>Number.parseFloat(Number(value).toFixed(places));
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
const listOf=value=>(Array.isArray(value)?value:[]).filter(item=>item&&typeof item==='object');

// ---------------------------------------------------------------------------
// Colour mathematics: sRGB <-> linear <-> OKLab <-> oklch, and WCAG contrast.
// ---------------------------------------------------------------------------

const clamp01=value=>value<0?0:value>1?1:value;
/** sRGB transfer function and its inverse; the piecewise form, not the 2.2 approximation. */
export const srgbToLinear=channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
export const linearToSrgb=channel=>channel<=0.0031308?channel*12.92:1.055*channel**(1/2.4)-0.055;

/** Linear-light sRGB (0..1 each) to OKLab. */
export function linearRgbToOklab([red,green,blue]){
  const long=Math.cbrt(0.4122214708*red+0.5363325363*green+0.0514459929*blue);
  const medium=Math.cbrt(0.2119034982*red+0.6806995451*green+0.1073969566*blue);
  const short=Math.cbrt(0.0883024619*red+0.2817188376*green+0.6299787005*blue);
  return {L:0.2104542553*long+0.7936177850*medium-0.0040720468*short,
    a:1.9779984951*long-2.4285922050*medium+0.4505937099*short,
    b:0.0259040371*long+0.7827717662*medium-0.8086757660*short};
}

/** OKLab to linear-light sRGB (unclamped: a value outside 0..1 is outside the sRGB gamut). */
export function oklabToLinearRgb({L,a,b}){
  const long=(L+0.3963377774*a+0.2158037573*b)**3;
  const medium=(L-0.1055613458*a-0.0638541728*b)**3;
  const short=(L-0.0894841775*a-1.2914855480*b)**3;
  return [4.0767416621*long-3.3077115913*medium+0.2309699292*short,
    -1.2684380046*long+2.6097574011*medium-0.3413193965*short,
    -0.0041960863*long-0.7034186147*medium+1.7076147010*short];
}

export const rgbToOklab=([red,green,blue])=>linearRgbToOklab([srgbToLinear(red/255),srgbToLinear(green/255),srgbToLinear(blue/255)]);
/** Out-of-gamut OKLab clips per channel; `clipped` says so rather than hiding it. */
export function oklabToRgb(lab){
  const linear=oklabToLinearRgb(lab);
  const clipped=linear.some(channel=>channel<-1e-6||channel>1+1e-6);
  return {rgb:linear.map(channel=>Math.round(clamp01(linearToSrgb(clamp01(channel)))*255)),clipped};
}

export function oklabToOklch({L,a,b}){
  const chroma=Math.hypot(a,b);
  const hue=chroma<1e-7?0:(Math.atan2(b,a)*180/Math.PI+360)%360;
  return {L,C:chroma,h:hue};
}
export const oklchToOklab=({L,C,h})=>({L,a:C*Math.cos(h*Math.PI/180),b:C*Math.sin(h*Math.PI/180)});
export const formatHex=rgb=>`#${rgb.map(channel=>Math.max(0,Math.min(255,Math.round(channel))).toString(16).padStart(2,'0')).join('')}`;

const number=(text,{percentOf=1}={})=>{
  const value=String(text).trim();
  if(/^[-+]?\d*\.?\d+%$/.test(value))return Number.parseFloat(value)/100*percentOf;
  if(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(value))return Number.parseFloat(value);
  if(/^none$/i.test(value))return 0;
  return null;
};

/**
 * Parses the colour notations a brand record and a stylesheet actually use: `#rgb`/`#rgba`/`#rrggbb`/
 * `#rrggbbaa`, `oklch(L C H[/a])` and `rgb()/rgba()`. Alpha is read and reported but never compared:
 * a token's identity is its colour. Anything else - a named colour, `var()`, `color-mix()`, `calc()` -
 * returns null so the caller fails loudly instead of guessing a value.
 */
export function parseColor(input){
  const value=String(input??'').trim().replace(/\s*!important$/i,'');
  if(!value)return null;
  const hex=/^#([0-9a-f]{3,8})$/i.exec(value);
  if(hex){
    const body=hex[1];
    if(![3,4,6,8].includes(body.length))return null;
    const pairs=body.length<=4?[...body].map(char=>char+char):body.match(/../g);
    const [red,green,blue,alpha]=pairs.map(pair=>Number.parseInt(pair,16));
    return color({notation:'hex',rgb:[red,green,blue],alpha:alpha===undefined?1:alpha/255,raw:value});
  }
  const call=/^(oklch|rgba?)\(\s*([^)]*)\)$/i.exec(value);
  if(!call)return null;
  const kind=call[1].toLowerCase();
  const [head,tail]=call[2].split('/');
  const parts=head.trim().split(/[\s,]+/).filter(Boolean);
  if(parts.length<3)return null;
  const alpha=tail===undefined?1:number(tail,{percentOf:1});
  if(kind==='oklch'){
    const lightness=number(parts[0],{percentOf:1});
    const chroma=number(parts[1],{percentOf:0.4});
    const hue=number(parts[2]==='none'?'0':String(parts[2]).replace(/deg$/i,''));
    if([lightness,chroma,hue].some(part=>part===null))return null;
    const lab=oklchToOklab({L:lightness,C:chroma,h:hue});
    const {rgb,clipped}=oklabToRgb(lab);
    return color({notation:'oklch',rgb,alpha:alpha??1,raw:value,lab,clipped});
  }
  const channels=parts.slice(0,3).map(part=>number(part,{percentOf:255}));
  if(channels.some(channel=>channel===null))return null;
  return color({notation:'rgb',rgb:channels.map(channel=>Math.round(channel)),alpha:alpha??1,raw:value});
}

function color({notation,rgb,alpha,raw,lab=null,clipped=false}){
  const oklab=lab??rgbToOklab(rgb);
  return {notation,raw,rgb,alpha,clipped,oklab,oklch:oklabToOklch(oklab),hex:formatHex(rgb)};
}

/** Euclidean OKLab distance on the x100 scale: black against white is 100. */
export const deltaEOk=(first,second)=>100*Math.hypot(first.oklab.L-second.oklab.L,first.oklab.a-second.oklab.a,first.oklab.b-second.oklab.b);
/** WCAG 2.x relative luminance of a parsed colour. */
export const relativeLuminance=({rgb:[red,green,blue]})=>0.2126*srgbToLinear(red/255)+0.7152*srgbToLinear(green/255)+0.0722*srgbToLinear(blue/255);
/** WCAG 2.x contrast ratio: 21 for black against white, 1 for a colour against itself. */
export function contrastRatio(first,second){
  const one=relativeLuminance(first),two=relativeLuminance(second);
  return (Math.max(one,two)+0.05)/(Math.min(one,two)+0.05);
}

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
    const match=/^(--[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)$/.exec(declaration);
    if(!match)return;
    const selector=stack.filter(Boolean).join(' ');
    const value=match[2].trim().replace(/\s*!important$/i,'').replace(/;+$/,'').trim();
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
  const exact=new Map(),derived=new Map();
  const put=(map,name,value)=>{if(typeof name==='string'&&name&&!map.has(name))map.set(name,String(value));};
  const leaf=value=>typeof value==='string'||typeof value==='number';
  const walk=(node,trail)=>{
    if(Array.isArray(node)){
      for(const item of node){
        if(item&&typeof item==='object'&&leaf(item.value)){
          const name=item.name??item.token;
          if(typeof name==='string')put(name.startsWith('--')?exact:derived,name,item.value);
        } else if(item&&typeof item==='object')walk(item,trail);
      }
      return;
    }
    if(!node||typeof node!=='object')return;
    for(const [key,value] of Object.entries(node)){
      const next=[...trail,key];
      if(leaf(value)){
        if(key.startsWith('--'))put(exact,key,value);
        else {put(derived,key,value);put(derived,`--${next.join('-')}`,value);}
        continue;
      }
      walk(value,key.startsWith('--')?trail:next);
    }
  };
  walk(data,[]);
  return {exact,derived};
}

const readText=file=>{
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||!stat.isFile()||stat.size>SOURCE_BYTES_LIMIT)throw Error('A brand source must be a bounded real file.');
  return fs.readFileSync(file,'utf8');
};

/** One declared source file, read into a token lookup. Never throws: an unreadable source is reported. */
export function readSourceTokens(sourceRoot,source){
  const declared=slash(source?.path??'');
  const entry={repository:source?.repository??null,path:declared,kind:source?.kind??null,found:false,declarations:0,scope:null};
  if(!declared||path.isAbsolute(declared)||declared.split('/').includes('..'))return {...entry,error:'the declared path escapes its repository root'};
  const file=path.resolve(sourceRoot,declared);
  const relative=path.relative(path.resolve(sourceRoot),file);
  if(relative.startsWith('..'))return {...entry,error:'the declared path escapes its repository root'};
  if(!fs.existsSync(file))return {...entry,error:'this repository does not carry the declared file'};
  // A source inside a built @starci/grammar dist is read only when that dist is the build of its source:
  // a stale dist would bind the brand to tokens the package no longer ships.
  const refusal=grammarDistRefusal(file);
  if(refusal)return {...entry,found:true,error:refusal.message,staleGrammarDist:{state:refusal.state,root:refusal.root,fix:refusal.fix}};
  let text;
  try{text=readText(file);}catch(error){return {...entry,found:true,error:String(error.message??error)};}
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

/** The first declaration of this token across the declared sources, preferring the default scope. */
function lookupToken(sources,token,seen=new Set()){
  if(seen.has(token))return null;
  const nextSeen=new Set(seen).add(token);
  const bare=token.replace(/^--/,'');
  for(const scope of ['base','dark']){
    for(const source of sources){
      const css=source.lookup?.css;
      if(css){
        const found=css[scope].get(token);
        if(found){
          const reference=String(found.value).trim().match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/)?.[1]??null;
          if(reference){
            const resolved=lookupToken(sources,reference,nextSeen);
            if(resolved)return {...resolved,file:source.path,selector:found.selector,scope,declaredValue:found.value,resolvedFrom:reference};
          }
          return {value:found.value,file:source.path,selector:found.selector,scope};
        }
      }
      if(scope!=='base')continue;
      const tokens=source.lookup?.tokens;
      if(!tokens)continue;
      const found=tokens.exact.get(token)??tokens.derived.get(token)??tokens.derived.get(bare);
      if(found!==undefined)return {value:found,file:source.path,selector:null,scope:'base'};
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The brand record and the grammar canon.
// ---------------------------------------------------------------------------

/** The grammar canon the host installs: authored YAML under `knowledge/grammars`, read directly. */
export function defaultGrammarRoot(){
  return path.join(skillRoot,'knowledge','grammars');
}

/**
 * Reads `<tree>/brand/index.yaml` (or `<tree>/.starciwork/brand/index.yaml`, so a repository root is also a
 * usable argument). A missing or wrong-kind record throws: that is a broken input, not a failed check, and
 * reporting it as a check would make "no brand" look like a brand with nothing wrong.
 */
export function readBrandRecord(tree){
  const root=path.resolve(tree);
  const candidates=[path.join(root,'brand','index.yaml'),path.join(root,'.starciwork','brand','index.yaml')];
  const file=candidates.find(candidate=>fs.existsSync(candidate)&&fs.lstatSync(candidate).isFile());
  if(!file)throw Error(`No brand record: expected ${candidates.map(candidate=>slash(path.relative(root,candidate))).join(' or ')}.`);
  const source=readText(file);
  const record=parseYaml(source);
  // work/brand@1 is the family modules/schemas/work-layout.yaml requires for the brand record; the
  // node families stay readable for records written before it (mia-mia inc-79bea285865d).
  const supportedNodeSchemas=new Set(['work/brand@1','work/node@1','work/node@2']);
  if(!supportedNodeSchemas.has(record?.schema)||record?.kind!=='brand')throw Error('A brand record must be a work/brand@1 record (or a legacy work/node@1|@2 node) of kind brand.');
  if(!record.brand||typeof record.brand!=='object'||Array.isArray(record.brand))throw Error('The brand record carries no brand specification.');
  const declared=record.rev??record.revision??record.brand.rev;
  return {file,dir:path.dirname(file),record,brand:record.brand,
    rev:declared===undefined?digest(source).slice(0,12):String(declared),
    revSource:declared===undefined?'content-digest':'declared',
    family:typeof record.brand.identity?.family==='string'?record.brand.identity.family:null};
}

/** The token names one grammar family's DNA declares. `.yaml` authored, `.json` built - both are the canon. */
export function grammarTokenNames({family,grammarRoot=defaultGrammarRoot()}){
  if(!family)return {file:null,names:[],error:'the brand declares no identity.family'};
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(family))return {file:null,names:[],error:'the declared family is not a usable directory name'};
  const candidates=['DNA.yaml','DNA.yml','DNA.json'].map(name=>path.join(grammarRoot,family,name));
  const file=candidates.find(candidate=>fs.existsSync(candidate)&&fs.lstatSync(candidate).isFile());
  if(!file)return {file:null,names:[],error:`the host carries no DNA snapshot for grammar family \`${family}\``};
  try{
    const text=readText(file);
    const dna=path.extname(file).toLowerCase()==='.json'?JSON.parse(text):parseYaml(text);
    const names=(Array.isArray(dna?.tokens)?dna.tokens:[]).map(token=>token?.name).filter(name=>typeof name==='string');
    return {file,names,error:names.length?null:'the DNA snapshot declares no tokens'};
  }catch(error){return {file,names:[],error:`unreadable DNA snapshot: ${String(error.message??error)}`};}
}

// ---------------------------------------------------------------------------
// The six checks. Each takes a plain context and returns one check result.
// ---------------------------------------------------------------------------

const check=(id,outcome,detail,evidence={})=>({id,outcome,detail,evidence});
const brandTokens=brand=>listOf(brand?.color?.tokens).filter(token=>typeof token.token==='string');
const byRole=(tokens,role)=>tokens.find(token=>token.role===role)??null;

/**
 * 1. The brand is bound to the source, not copied from it. Every colour token the brand declares must exist
 * in a declared source file with the same colour, compared in OKLab so `#7547ff` and its oklch spelling are
 * one colour and a near-miss is still a miss.
 */
export function checkTokensMatchSource({brand,sourceRoot}){
  const id='tokens-match-source';
  const tokens=brandTokens(brand);
  const declared=listOf(brand?.sources).filter(source=>['css','tokens'].includes(source.kind));
  if(!sourceRoot)return check(id,'skip','No --source repository root was given, so the brand\'s colour claims were not compared against shipped source.',{tokens:tokens.length,sources:declared.length});
  if(!tokens.length)return check(id,'skip','The brand declares no colour tokens to bind.',{sourceRoot:slash(sourceRoot)});
  if(!declared.length)return check(id,'skip','The brand names no source file of kind css or tokens, so nothing binds its colours.',{sourceRoot:slash(sourceRoot),tokens:tokens.length});
  const sources=declared.map(source=>readSourceTokens(sourceRoot,source));
  const readable=sources.filter(source=>source.lookup);
  const files=sources.map(({lookup,...rest})=>rest);
  const refused=files.filter(source=>source.staleGrammarDist);
  if(refused.length)return check(id,'fail',`Refusing to bind the brand to a stale grammar build: ${refused.map(source=>source.error).join(' ')}`,
    {sourceRoot:slash(sourceRoot),files});
  if(!readable.length)return check(id,'skip','Not one declared colour source could be read from this repository root, so no token was compared.',
    {sourceRoot:slash(sourceRoot),files});
  const findings=tokens.map(token=>{
    const expected=parseColor(token.value);
    const found=lookupToken(readable,token.token);
    if(!expected)return {token:token.token,expected:token.value??null,actual:found?.value??null,status:'unparseable-brand-value'};
    if(!found)return {token:token.token,expected:token.value,actual:null,status:'absent'};
    const actual=parseColor(found.value);
    if(!actual)return {token:token.token,expected:token.value,actual:found.value,file:found.file,scope:found.scope,status:'unparseable-source-value'};
    const delta=round(deltaEOk(expected,actual),3);
    return {token:token.token,expected:token.value,actual:found.value,sourceValue:found.declaredValue??found.value,resolvedFrom:found.resolvedFrom??null,expectedHex:expected.hex,actualHex:actual.hex,
      file:found.file,selector:found.selector,scope:found.scope,deltaE:delta,
      status:found.scope==='dark'?'only-in-dark-scope':delta<=TOKEN_TOLERANCE?'match':'differs'};
  });
  const bad=findings.filter(finding=>finding.status!=='match');
  const evidence={sourceRoot:slash(sourceRoot),tolerance:TOKEN_TOLERANCE,files,tokens:findings};
  return bad.length
    ?check(id,'fail',`${bad.length} of ${findings.length} brand colour tokens do not match the shipped source: ${bad.map(finding=>`${finding.token} (${finding.status})`).join(', ')}.`,evidence)
    :check(id,'pass',`All ${findings.length} brand colour tokens are present in the shipped source with the declared colour.`,evidence);
}

/**
 * An owner-accepted contrast exception is bound to the ratio measured when the owner accepted it. Two
 * decimals of WCAG ratio move by about 0.01 between a hex and its oklch spelling; a twentieth is below any
 * visible change and far above that rounding, so a colour that moved after the answer is a new question.
 */
export const CONTRAST_EXCEPTION_TOLERANCE=0.05;
/** The receipt serve-ask writes when an ask is answered (scripts/kernel/serve-ask.mjs). */
export const OWNER_ANSWER_SCHEMA='starci/ask-answer@1';
const OWNER_ANSWERER='owner';
const RECEIPT_FILE=/^answer-(\d+)\.json$/;

/** `<work>/brand` -> the Work root and the repository root the record's receipt paths are relative to. */
function workRootsOf(brandDir){
  if(!brandDir)return null;
  const work=path.dirname(path.resolve(brandDir));
  return {work,repoRoot:path.basename(work)==='.starciwork'?path.dirname(work):work};
}
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative));};
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};

/**
 * The owner's answer an exception cites, read from the starci/ask-answer@1 receipt on disk: the named
 * `receipt` path (relative to the repository root or the Work root, never outside the repository), else the
 * newest `<work>/kernel-evidence/<workflow>/serve-ask/answer-<ms>.json` answering `acceptedBy`. Only an
 * answer the owner gave counts: an auto-accepted recommendation is not the owner accepting a sub-AA pair.
 */
export function findOwnerReceipt({acceptedBy,receipt=null,brandDir=null}){
  const roots=workRootsOf(brandDir);
  if(!roots)return {ok:false,why:'no Work tree was given, so no owner answer receipt could be read'};
  const judge=(file,answer)=>{
    const named=slash(path.relative(roots.repoRoot,file));
    if(answer?.schema!==OWNER_ANSWER_SCHEMA)return {ok:false,why:`${named} is not a ${OWNER_ANSWER_SCHEMA} receipt`};
    if(answer.dispatchId!==acceptedBy)return {ok:false,why:`${named} answers ${answer.dispatchId??'(no dispatch)'}, not ${acceptedBy}`};
    if(answer.answeredBy!==OWNER_ANSWERER)return {ok:false,why:`${acceptedBy} was answered by ${answer.answeredBy??'(nobody)'}, not the owner`};
    return {ok:true,file:named,dispatchId:answer.dispatchId,answeredBy:answer.answeredBy,at:answer.at??null,option:answer.option??null};
  };
  if(receipt!==null&&receipt!==undefined){
    if(typeof receipt!=='string'||!receipt.trim())return {ok:false,why:'receipt must be the path of the owner answer receipt'};
    const file=[path.resolve(roots.repoRoot,receipt),path.resolve(roots.work,receipt)]
      .filter(candidate=>inside(roots.repoRoot,candidate))
      .find(candidate=>fs.existsSync(candidate)&&fs.lstatSync(candidate).isFile());
    if(!file)return {ok:false,why:`the receipt ${slash(receipt)} is not a file inside this repository`};
    return judge(file,readJson(file));
  }
  const evidence=path.join(roots.work,'kernel-evidence');
  const files=[];
  let workflows=[];
  try{workflows=fs.readdirSync(evidence,{withFileTypes:true}).filter(entry=>entry.isDirectory());}catch{}
  for(const workflow of workflows){
    const dir=path.join(evidence,workflow.name,'serve-ask');
    let names=[];
    try{names=fs.readdirSync(dir);}catch{continue;}
    for(const name of names){const match=RECEIPT_FILE.exec(name);if(match)files.push({file:path.join(dir,name),at:Number(match[1])});}
  }
  files.sort((one,two)=>two.at-one.at);
  for(const {file} of files){
    const answer=readJson(file);
    if(answer?.dispatchId===acceptedBy)return judge(file,answer);
  }
  return {ok:false,why:`no receipt answers ${acceptedBy} under ${slash(path.relative(roots.repoRoot,evidence))||'kernel-evidence'}/*/serve-ask/`};
}

/**
 * `color.policy.contrastExceptions[]`: each entry names one pair by its two brand token names, the ratio the
 * owner accepted, why, and the owner answer that accepted it. An entry is `valid` only when both tokens are
 * declared, the pair still measures within CONTRAST_EXCEPTION_TOLERANCE of the recorded ratio, and the
 * owner's receipt for `acceptedBy` is on disk; anything else is `refused` with the reason.
 */
function readContrastExceptions({brand,tokens,brandDir}){
  const raw=brand?.color?.policy?.contrastExceptions;
  if(raw===undefined||raw===null)return [];
  if(!Array.isArray(raw))return [{index:0,status:'refused',why:'color.policy.contrastExceptions must be a list of exceptions'}];
  const byName=new Map(tokens.map(token=>[token.token,token]));
  const seen=new Set();
  return raw.map((entry,index)=>{
    const fields=entry&&typeof entry==='object'&&!Array.isArray(entry)?entry:{};
    const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
    const foregroundToken=byName.get(fields.foreground)??null,backgroundToken=byName.get(fields.background)??null;
    const fgColor=foregroundToken?parseColor(foregroundToken.value):null,bgColor=backgroundToken?parseColor(backgroundToken.value):null;
    const measured=fgColor&&bgColor?round(contrastRatio(bgColor,fgColor),2):null;
    const base={index,foreground:fields.foreground??null,background:fields.background??null,ratio:fields.ratio??null,measured,
      reason:fields.reason??null,acceptedBy:fields.acceptedBy??null,receipt:fields.receipt??null,fgColor,bgColor};
    const refuse=why=>({...base,status:'refused',why});
    if(!foregroundToken)return refuse(`foreground ${JSON.stringify(fields.foreground??null)} is not a colour token this brand declares`);
    if(!backgroundToken)return refuse(`background ${JSON.stringify(fields.background??null)} is not a colour token this brand declares`);
    if(fields.foreground===fields.background)return refuse('a token is not a contrast pair with itself');
    const key=`${fields.foreground}\u0000${fields.background}`;
    if(seen.has(key))return refuse('a second exception for the same pair; one pair carries one owner answer');
    seen.add(key);
    if(!(typeof fields.ratio==='number'&&Number.isFinite(fields.ratio)&&fields.ratio>=1))return refuse('ratio must be the contrast ratio the owner accepted, a number of at least 1');
    if(!text(fields.reason))return refuse('reason must say why the owner accepted this pair below the floor');
    if(!text(fields.acceptedBy))return refuse('acceptedBy names no owner answer; an exception without an owner receipt is refused');
    if(measured===null)return refuse('a token of the pair is not a colour this runtime can parse, so the pair cannot be measured');
    if(Math.abs(measured-fields.ratio)>CONTRAST_EXCEPTION_TOLERANCE)
      return refuse(`the pair measures ${measured}:1, not the ${fields.ratio}:1 the owner accepted (tolerance ${CONTRAST_EXCEPTION_TOLERANCE}); a changed colour needs a new owner answer`);
    const owner=findOwnerReceipt({acceptedBy:text(fields.acceptedBy),receipt:fields.receipt??null,brandDir});
    if(!owner.ok)return refuse(`no owner receipt: ${owner.why}`);
    return {...base,acceptedBy:text(fields.acceptedBy),receipt:owner.file,answeredBy:owner.answeredBy,answeredAt:owner.at,status:'valid'};
  });
}

/**
 * 2. A colour pair the brand itself declares must be legible. Text pairs are held to `policy.minContrast`
 * (WCAG AA, 4.5 by default); the primary against a declared surface is a non-text indicator and needs 3:1.
 * A pair below its floor passes only through `policy.contrastExceptions` - one owner-accepted pair, named by
 * its exact tokens and bound to its measured ratio and the owner's receipt; every other pair still fails and
 * a refused exception fails the check. An exception pair no token declares as a fill (muted text on a
 * surface, link ink on the canvas) is measured from its two tokens, so an accepted pair is never unmeasured.
 */
export function checkContrastAa({brand,brandDir=null}){
  const id='contrast-aa';
  const tokens=brandTokens(brand);
  const minimum=Number.isFinite(brand?.color?.policy?.minContrast)?Number(brand.color.policy.minContrast):DEFAULT_MIN_CONTRAST;
  const byName=new Map(tokens.map(token=>[token.token,token]));
  /** The declared token a fill's foreground value is: `<token>-foreground` or the `<role>-foreground` role. */
  const foregroundNameOf=(token,colour)=>{
    const names=[`${token.token}-foreground`,...tokens.filter(other=>token.role&&other.role===`${token.role}-foreground`).map(other=>other.token)];
    return names.find(name=>{const value=byName.has(name)?parseColor(byName.get(name).value):null;return value&&deltaEOk(value,colour)<=TOKEN_TOLERANCE;})??null;
  };
  const pairs=[];
  for(const token of tokens){
    if(token.foreground===undefined||token.foreground===null)continue;
    const background=parseColor(token.value),foreground=parseColor(token.foreground);
    if(!background||!foreground){
      pairs.push({kind:'text',token:token.token,background:token.value??null,foreground:token.foreground,minimum,outcome:'unparseable'});
      continue;
    }
    const ratio=round(contrastRatio(background,foreground),2);
    pairs.push({kind:'text',token:token.token,foregroundToken:foregroundNameOf(token,foreground),background:token.value,foreground:token.foreground,ratio,minimum,
      outcome:ratio>=minimum?'pass':'fail',_bg:token.token,_fg:foreground});
  }
  const primary=byRole(tokens,'primary'),surface=byRole(tokens,'surface');
  if(primary&&surface){
    const one=parseColor(primary.value),two=parseColor(surface.value);
    if(one&&two){
      const ratio=round(contrastRatio(one,two),2);
      pairs.push({kind:'non-text',token:primary.token,against:surface.token,ratio,minimum:NON_TEXT_MIN_CONTRAST,outcome:ratio>=NON_TEXT_MIN_CONTRAST?'pass':'fail',
        _bg:surface.token,_fg:one});
    } else pairs.push({kind:'non-text',token:primary.token,against:surface.token,minimum:NON_TEXT_MIN_CONTRAST,outcome:'unparseable'});
  }
  const exceptions=readContrastExceptions({brand,tokens,brandDir});
  const covers=(exception,pair)=>Boolean(pair._fg&&exception.fgColor&&exception.background===pair._bg&&deltaEOk(exception.fgColor,pair._fg)<=TOKEN_TOLERANCE);
  for(const exception of exceptions){
    if(!exception.fgColor||!exception.bgColor||pairs.some(pair=>covers(exception,pair)))continue;
    pairs.push({kind:'text',token:exception.background,foregroundToken:exception.foreground,declaredBy:'contrastExceptions',
      background:byName.get(exception.background).value,foreground:byName.get(exception.foreground).value,ratio:exception.measured,minimum,
      outcome:exception.measured>=minimum?'pass':'fail',_bg:exception.background,_fg:exception.fgColor});
  }
  const applied=[];
  for(const pair of pairs){
    const exception=exceptions.find(entry=>entry.status==='valid'&&covers(entry,pair));
    if(!exception)continue;
    if(pair.outcome==='fail'){
      pair.outcome='pass';
      pair.belowFloor=true;
      pair.exception={foreground:exception.foreground,background:exception.background,acceptedBy:exception.acceptedBy,ratio:exception.ratio,receipt:exception.receipt};
      exception.status='applied';
      applied.push(pair);
    } else if(exception.status==='valid')exception.status='unneeded';
  }
  for(const pair of pairs){delete pair._bg;delete pair._fg;}
  const refused=exceptions.filter(exception=>exception.status==='refused');
  const reported=exceptions.map(({fgColor,bgColor,...rest})=>rest);
  if(!pairs.length&&!refused.length)return check(id,'skip','No brand token declares a foreground and no surface is declared, so no contrast pair exists to measure.',{minimum});
  const bad=pairs.filter(pair=>pair.outcome!=='pass');
  const evidence={minimum,nonTextMinimum:NON_TEXT_MIN_CONTRAST,exceptionTolerance:CONTRAST_EXCEPTION_TOLERANCE,pairs,
    ...(exceptions.length?{exceptions:reported}:{})};
  const named=pair=>pair.declaredBy?`${pair.foregroundToken} on ${pair.token}`:`${pair.token}${pair.against?` on ${pair.against}`:''}`;
  const failures=[
    ...(bad.length?[`${bad.length} of ${pairs.length} declared colour pairs miss their contrast floor: ${bad.map(pair=>`${named(pair)} ${pair.ratio??'(unparseable)'}:1 < ${pair.minimum}:1`).join(', ')}.`]:[]),
    ...(refused.length?[`${refused.length} contrast exception${refused.length===1?' is':'s are'} refused: ${refused.map(entry=>`${entry.foreground??'?'} on ${entry.background??'?'} (${entry.why})`).join('; ')}.`]:[])];
  const accepted=applied.length?` ${applied.length} of them below it by an owner-accepted exception: ${applied.map(pair=>`${pair.exception.foreground} on ${pair.exception.background} ${pair.ratio}:1 (${pair.exception.acceptedBy})`).join(', ')}.`:'';
  return failures.length
    ?check(id,'fail',failures.join(' '),evidence)
    :check(id,'pass',`All ${pairs.length} declared colour pairs meet their contrast floor (text ${minimum}:1, non-text ${NON_TEXT_MIN_CONTRAST}:1).${accepted}`,evidence);
}

/**
 * 3. Destructive must not look like primary. The owner may overrule this - some brands are one hue - but
 * then the affordance has to carry the meaning, and the check says so instead of going quiet.
 */
export function checkPrimaryDangerDistinct({brand}){
  const id='primary-danger-distinct';
  const tokens=brandTokens(brand);
  const primary=byRole(tokens,'primary'),danger=byRole(tokens,'danger');
  const allowed=brand?.color?.policy?.dangerMayMatchPrimary===true;
  if(!primary||!danger)return check(id,'skip',`The brand declares no ${!primary&&!danger?'primary and no danger':!primary?'primary':'danger'} colour role, so the two cannot be compared.`,
    {threshold:MIN_PRIMARY_DANGER_DELTA,dangerMayMatchPrimary:allowed});
  const one=parseColor(primary.value),two=parseColor(danger.value);
  const evidence={primary:{token:primary.token,value:primary.value??null},danger:{token:danger.token,value:danger.value??null},
    threshold:MIN_PRIMARY_DANGER_DELTA,scale:'OKLab delta-E x100',dangerMayMatchPrimary:allowed};
  if(!one||!two)return check(id,'fail','The primary or danger colour is not a colour this runtime can parse, so their distance is unknown.',evidence);
  const delta=round(deltaEOk(one,two),2);
  const measured={...evidence,deltaE:delta};
  if(delta>=MIN_PRIMARY_DANGER_DELTA)return check(id,'pass',`Primary and danger are ${delta} apart in OKLab (floor ${MIN_PRIMARY_DANGER_DELTA}).`,measured);
  if(allowed)return check(id,'pass',`Primary and danger are only ${delta} apart in OKLab (floor ${MIN_PRIMARY_DANGER_DELTA}), but the owner allows danger to share the primary hue; destructive actions must carry an icon and a verb.`,
    {...measured,note:'the owner allows danger to share the primary hue; destructive actions must carry an icon and a verb'});
  return check(id,'fail',`Primary and danger are only ${delta} apart in OKLab (floor ${MIN_PRIMARY_DANGER_DELTA}), and the brand does not allow danger to share the primary hue.`,measured);
}

/**
 * 4. A mascot that is named but absent is a mascot nobody can draw with. Bytes are hashed: a declared
 * sha256 is verified, an undeclared one is reported so the owner can pin the asset they reviewed.
 */
export function checkMascotAssetsPresent({brand,tree,brandDir}){
  const id='mascot-assets-present';
  const assets=listOf(brand?.mascot?.assets).filter(asset=>typeof asset.path==='string'&&asset.path);
  const declared=listOf(brand?.mascot?.assets);
  if(!declared.length)return check(id,'skip','The brand declares no mascot asset.',{tree:slash(tree)});
  const root=path.resolve(tree);
  const findings=declared.map(asset=>{
    const relative=slash(asset.path??'');
    const entry={path:relative,purpose:asset.purpose??null,declaredSha256:asset.sha256??null};
    if(!relative||path.isAbsolute(relative)||relative.split('/').includes('..'))return {...entry,exists:false,status:'escapes-tree'};
    const workRoot=path.dirname(brandDir);
    const candidates=[path.resolve(brandDir,relative),path.resolve(workRoot,relative),path.resolve(root,relative)];
    const file=candidates.find(candidate=>fs.existsSync(candidate)&&fs.lstatSync(candidate).isFile());
    if(!file)return {...entry,exists:false,status:'absent',searched:candidates.map(candidate=>slash(path.relative(root,candidate)))};
    const resolved=slash(path.relative(root,file));
    const extension=path.extname(file).toLowerCase();
    const computed=digest(fs.readFileSync(file));
    const base={...entry,exists:true,resolved,extension,computedSha256:computed,bytes:fs.statSync(file).size};
    if(!ASSET_EXTENSIONS.includes(extension))return {...base,status:'unsupported-format'};
    if(asset.sha256&&String(asset.sha256).toLowerCase()!==computed)return {...base,status:'sha256-mismatch'};
    return {...base,status:asset.sha256?'verified':'present-unpinned'};
  });
  const bad=findings.filter(finding=>!['verified','present-unpinned'].includes(finding.status));
  const evidence={tree:slash(root),allowedFormats:ASSET_EXTENSIONS,assets:findings};
  if(bad.length)return check(id,'fail',`${bad.length} of ${findings.length} declared mascot assets are not usable: ${bad.map(finding=>`${finding.path} (${finding.status})`).join(', ')}.`,evidence);
  const unpinned=findings.filter(finding=>finding.status==='present-unpinned').length;
  return check(id,'pass',`All ${findings.length} declared mascot assets exist in a supported format${unpinned?`; ${unpinned} carry no declared sha256, so the computed hash is reported instead`:' and match their declared sha256'}.`,
    {...evidence,unpinned,assetsChecked:assets.length});
}

/** Every module specifier this file imports, with the line it sits on. */
export function importSpecifiers(text){
  const source=String(text??'');
  const found=new Map();
  const patterns=[/(?<![\w$.])(?:import|export)\b[\s\S]{0,400}?\bfrom\s*['"]([^'"\n]+)['"]/g,
    /(?<![\w$.])(?:import|require)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /(?<![\w$.])import\s*['"]([^'"\n]+)['"]/g];
  for(const pattern of patterns){
    for(const match of source.matchAll(pattern)){
      const at=match.index+match[0].lastIndexOf(match[1]);
      const line=source.slice(0,at).split('\n').length;
      found.set(`${line}:${match[1]}`,{specifier:match[1],line});
    }
  }
  return [...found.values()].sort((first,second)=>first.line-second.line||first.specifier.localeCompare(second.specifier));
}

const covers=(entry,specifier)=>specifier===entry||specifier.startsWith(`${entry}/`);

/**
 * 5. The glyph set is closed. A forbidden package is an offender wherever it appears; any other icon-looking
 * package is an offender unless `iconography.set` or `custom` names it. Relative imports are the product's
 * own files and are never judged here.
 */
export function checkIconSetOnly({brand,sourceRoot}){
  const id='icon-set-only';
  const iconography=brand?.iconography??{};
  const allowed=[...(Array.isArray(iconography.set)?iconography.set:[]),...(Array.isArray(iconography.custom)?iconography.custom:[])].filter(entry=>typeof entry==='string'&&entry);
  const forbidden=(Array.isArray(iconography.forbidden)?iconography.forbidden:[]).filter(entry=>typeof entry==='string'&&entry);
  if(!sourceRoot)return check(id,'skip','No --source repository root was given, so the frontend\'s icon imports were not scanned.',{allowed,forbidden});
  if(!allowed.length&&!forbidden.length)return check(id,'skip','The brand declares no iconography set and nothing forbidden, so no icon law exists to enforce.',{sourceRoot:slash(sourceRoot)});
  const root=path.resolve(sourceRoot);
  const files=[];
  const walk=directory=>{
    if(files.length>=SCAN_FILE_LIMIT)return;
    let entries;
    try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{return;}
    for(const entry of entries){
      if(files.length>=SCAN_FILE_LIMIT)return;
      if(entry.isSymbolicLink())continue;
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()){if(!SCAN_EXCLUDED.has(entry.name)&&!entry.name.startsWith('.'))walk(file);continue;}
      if(entry.isFile()&&/\.tsx?$/i.test(entry.name)&&!/\.d\.ts$/i.test(entry.name)&&fs.statSync(file).size<=SCAN_BYTES_LIMIT)files.push(file);
    }
  };
  walk(root);
  const offenders=[];
  for(const file of files){
    let text;
    try{text=fs.readFileSync(file,'utf8');}catch{continue;}
    for(const {specifier,line} of importSpecifiers(text)){
      if(specifier.startsWith('.')||specifier.startsWith('/')||specifier.startsWith('~'))continue;
      const banned=forbidden.find(entry=>covers(entry,specifier)||specifier.includes(entry));
      const permitted=allowed.some(entry=>covers(entry,specifier));
      if(banned)offenders.push({file:slash(path.relative(root,file)),line,specifier,reason:`forbidden by the brand (${banned})`});
      else if(!permitted&&ICON_HINT.test(specifier))offenders.push({file:slash(path.relative(root,file)),line,specifier,reason:'an icon package outside iconography.set and custom'});
    }
  }
  const evidence={sourceRoot:slash(root),allowed,forbidden,filesScanned:files.length,
    offenderCount:offenders.length,offenders:offenders.slice(0,OFFENDER_CAP),capped:offenders.length>OFFENDER_CAP};
  if(!files.length)return check(id,'skip','No TypeScript source file was found under the given repository root, so no icon import was scanned.',evidence);
  return offenders.length
    ?check(id,'fail',`${offenders.length} icon imports sit outside the brand's glyph set across ${files.length} scanned files.`,evidence)
    :check(id,'pass',`Every icon import across ${files.length} scanned files comes from the brand's declared glyph set.`,evidence);
}

/**
 * 6. A brand overrides real tokens; it never invents names. A token name the grammar family's DNA does not
 * declare would style nothing, so the record would read as applied while the product looked untouched.
 */
export function checkTokensInGrammar({brand,family,grammarRoot}){
  const id='tokens-in-grammar';
  const tokens=brandTokens(brand);
  const canon=grammarTokenNames({family,grammarRoot});
  const evidence={family:family??null,dna:canon.file?slash(canon.file):null,declaredInDna:canon.names.length,tokens:tokens.length};
  if(!tokens.length)return check(id,'skip','The brand declares no colour token to look up in the grammar canon.',evidence);
  if(!canon.names.length)return check(id,'skip',`The grammar canon could not be read (${canon.error}), so no token name was verified against it.`,evidence);
  const names=new Set(canon.names);
  const missing=tokens.map(token=>token.token).filter(token=>!names.has(token));
  return missing.length
    ?check(id,'fail',`${missing.length} of ${tokens.length} brand tokens are not token names the \`${family}\` grammar declares: ${missing.join(', ')}.`,{...evidence,missing})
    :check(id,'pass',`All ${tokens.length} brand tokens are token names the \`${family}\` grammar declares.`,{...evidence,missing:[]});
}

// ---------------------------------------------------------------------------
// The run.
// ---------------------------------------------------------------------------

/**
 * Runs every check against one Work tree. `sourceRoot` is the frontend repository root the brand's
 * `sources[]` paths are relative to; without it the two source-reading checks skip and say so. The result
 * is `ok` only when no check failed - a skipped check never makes a brand proven.
 */
export function runBrandChecks({tree,sourceRoot=null,grammarRoot=defaultGrammarRoot()}={}){
  if(!tree)throw Error('runBrandChecks needs a Work tree.');
  const record=readBrandRecord(tree);
  const context={brand:record.brand,tree:path.resolve(tree),brandDir:record.dir,
    sourceRoot:sourceRoot?path.resolve(sourceRoot):null,family:record.family,grammarRoot};
  const checks=[checkTokensMatchSource(context),checkContrastAa(context),checkPrimaryDangerDistinct(context),
    checkMascotAssetsPresent(context),checkIconSetOnly(context),checkTokensInGrammar(context)];
  return {schema:BRAND_CHECKS,ok:checks.every(result=>result.outcome!=='fail'),checks,
    brand:{rev:record.rev,family:record.family,revSource:record.revSource,record:slash(path.relative(path.resolve(tree),record.file))}};
}

/** One line per check, for a person reading a terminal. */
export function formatBrandChecks(result){
  const mark={pass:'pass',fail:'FAIL',skip:'skip'};
  const lines=[`brand ${result.brand.family??'(no family)'} rev ${result.brand.rev}: ${result.ok?'no failing check':'failing checks'}`];
  for(const entry of result.checks)lines.push(`  [${mark[entry.outcome]}] ${entry.id}: ${entry.detail}`);
  return lines.join('\n');
}
