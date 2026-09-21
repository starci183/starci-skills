import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {stringifyYaml} from '../engine/yaml.mjs';
import {
  BRAND_CHECKS,CHECK_IDS,MIN_PRIMARY_DANGER_DELTA,TOKEN_TOLERANCE,
  checkContrastAa,checkIconSetOnly,checkMascotAssetsPresent,checkPrimaryDangerDistinct,checkTokensInGrammar,checkTokensMatchSource,
  contrastRatio,deltaEOk,formatBrandChecks,importSpecifiers,parseColor,parseCssCustomProperties,parseTokenData,
  readBrandRecord,readSourceTokens,runBrandChecks
} from '../scripts/checks/brand.mjs';

const ACCENT='#7547ff';
const ACCENT_OKLCH='oklch(56.50% 0.2534 286.60)';
const DANGER='#b3261e';
const DANGER_OKLCH='oklch(50.13% 0.1783 28.70)';

function temporary(t,label){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`starci-brand-${label}-`));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
const write=(root,relative,body)=>{
  const file=path.join(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
  return file;
};

/** A brand specification that passes every check, so each test can break exactly one thing. */
const brandSpec=()=>({
  identity:{name:'StarCi',family:'starci'},
  color:{tokens:[
    {token:'--starci-core-accent',value:ACCENT,foreground:'#ffffff',role:'primary'},
    {token:'--starci-core-danger',value:DANGER,foreground:'#ffffff',role:'danger'},
    {token:'--starci-core-surface',value:'#ffffff',role:'surface'}],
    policy:{dangerMayMatchPrimary:false,minContrast:4.5}},
  typography:{family:'Inter'},
  mascot:{assets:[{path:'brand/assets/mascot.svg',purpose:'Empty state companion'}],allowedIn:['empty states'],forbiddenIn:['error states']},
  logo:{wordmark:'StarCi'},
  iconography:{set:['@heroicons/react'],custom:['@starci/heroicons'],forbidden:['@iconify']},
  imagery:{mood:'calm'},
  forbidden:['gradient text'],
  sources:[{repository:'starci-fe',path:'styles/globals.css',kind:'css'}]
});

/** A Work tree carrying one brand record, plus the mascot bytes the record names. */
function tree(t,{brand=brandSpec(),rev='brand-1',mascot='<svg xmlns="http://www.w3.org/2000/svg"/>',label='tree',schema='work/node@1'}={}){
  const root=temporary(t,label);
  const work=path.join(root,'.starciwork');
  write(work,'brand/index.yaml',stringifyYaml({schema,id:'brand',kind:'brand',required:true,state:'todo',
    ...(rev===null?{}:{rev}),description:'Product brand record.',brand}));
  if(mascot!==null)write(work,'brand/assets/mascot.svg',mascot);
  return {repoRoot:root,work,mascotSha:mascot===null?null:crypto.createHash('sha256').update(mascot).digest('hex')};
}

const CSS=`:root{
  /* the product's real tokens */
  --starci-core-accent: ${ACCENT_OKLCH};
  --starci-core-danger: ${DANGER_OKLCH} !important;
  --starci-core-surface: #fff;
  --starci-core-foreground: oklch(20% 0.01 286);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --starci-core-surface: #101014; }
}
[data-theme="dark"]{ --starci-core-accent: #9b7bff; }
`;

/** A frontend repository: the stylesheet the brand binds to, plus source that imports icons. */
function frontend(t,{css=CSS,bad=true,label='fe'}={}){
  const root=temporary(t,label);
  write(root,'styles/globals.css',css);
  write(root,'src/app/page.tsx',`import {Fragment} from 'react';\nimport {StarIcon} from '@heroicons/react/24/outline';\nimport {RankMedal} from '@starci/heroicons';\nimport {Local} from './local';\nexport default function Page(){return <Fragment><StarIcon/><RankMedal/><Local/></Fragment>;}\n`);
  write(root,'node_modules/vendor/sneaky.tsx','import {Icon} from "@iconify/react";\n');
  write(root,'.next/cached.tsx','import {Icon} from "@iconify/react";\n');
  if(bad)write(root,'src/bad.tsx',`import {Icon} from '@iconify/react';\nconst lazy=()=>import('react-icons/fa');\nexport {Icon,lazy};\n`);
  return root;
}

/** A grammar canon fixture: the same authored shape as knowledge/grammars/<family>/DNA.yaml. */
function grammar(t,names=['--starci-core-accent','--starci-core-danger','--starci-core-surface','--starci-core-foreground']){
  const root=temporary(t,'grammar');
  write(root,'starci/DNA.yaml',stringifyYaml({schema:'starci/knowledge-source@1',id:'grammar.starci.dna',family:'starci',
    tokens:names.map(name=>({name,value:'#000000'}))}));
  return root;
}

test('the colour mathematics round trips and reproduces the known contrast pairs',()=>{
  for(const hex of ['#000000','#ffffff','#7547ff','#3b82f6','#b3261e','#767676']){
    const parsed=parseColor(hex);
    assert.equal(parsed.hex,hex,`${hex} did not survive sRGB -> OKLab -> oklch -> sRGB`);
    const spelled=`oklch(${(parsed.oklch.L*100).toFixed(2)}% ${parsed.oklch.C.toFixed(4)} ${parsed.oklch.h.toFixed(2)})`;
    assert.ok(deltaEOk(parsed,parseColor(spelled))<TOKEN_TOLERANCE,`${hex} spelled as ${spelled} drifted`);
  }
  assert.equal(parseColor('#fff').hex,'#ffffff');
  assert.equal(parseColor('rgb(117, 71, 255)').hex,ACCENT);
  assert.equal(parseColor('#7547ff80').alpha,128/255);
  assert.equal(contrastRatio(parseColor('#000'),parseColor('#fff')),21);
  assert.equal(contrastRatio(parseColor('#7547ff'),parseColor('#7547ff')),1);
  assert.equal(Number(contrastRatio(parseColor('#767676'),parseColor('#ffffff')).toFixed(2)),4.54);
  assert.ok(Math.abs(deltaEOk(parseColor('#000'),parseColor('#fff'))-100)<1e-5);
  assert.equal(deltaEOk(parseColor('#7547ff'),parseColor(ACCENT_OKLCH))<TOKEN_TOLERANCE,true);
  assert.ok(deltaEOk(parseColor(ACCENT),parseColor(DANGER))>=MIN_PRIMARY_DANGER_DELTA);
  assert.ok(parseColor('oklch(65.32% 0.2335 37.78)').clipped,'an out-of-gamut oklch must report its clipping');
  for(const value of ['white','var(--starci-core-accent)','color-mix(in oklab, #fff, #000)','','#12345'])assert.equal(parseColor(value),null,String(value));
});

test('custom properties are read per scope, and token files by key',()=>{
  const parsed=parseCssCustomProperties(CSS);
  assert.equal(parsed.base.get('--starci-core-accent').value,ACCENT_OKLCH);
  assert.equal(parsed.base.get('--starci-core-danger').value,DANGER_OKLCH,'!important must not leak into the value');
  assert.equal(parsed.base.get('--starci-core-surface').value,'#fff');
  assert.equal(parsed.dark.get('--starci-core-surface').value,'#101014');
  assert.equal(parsed.dark.get('--starci-core-accent').value,'#9b7bff');
  assert.equal(parsed.base.has('--starci-core-does-not-exist'),false);
  const flat=parseTokenData({'--starci-core-accent':ACCENT});
  assert.equal(flat.exact.get('--starci-core-accent'),ACCENT);
  const nested=parseTokenData({starci:{core:{accent:ACCENT}}});
  assert.equal(nested.derived.get('--starci-core-accent'),ACCENT);
  const listed=parseTokenData({tokens:[{name:'--starci-core-danger',value:DANGER}]});
  assert.equal(listed.exact.get('--starci-core-danger'),DANGER);
});

test('a CSS token source is parsed by extension even when its semantic kind is tokens',t=>{
  const source=temporary(t,'css-token-source');
  write(source,'family.css',`:root{--starci-core-accent:${ACCENT_OKLCH};--focus:var(--starci-core-accent);}`);
  const result=readSourceTokens(source,{repository:'starci-fe',path:'family.css',kind:'tokens'});
  assert.equal(result.error,undefined);
  assert.equal(result.declarations,2);
  assert.equal(result.lookup.css.base.get('--starci-core-accent').value,ACCENT_OKLCH);
  const checked=checkTokensMatchSource({sourceRoot:source,brand:{sources:[{repository:'starci-fe',path:'family.css',kind:'tokens'}],color:{tokens:[{token:'--focus',value:ACCENT_OKLCH}]}}});
  assert.equal(checked.outcome,'pass',JSON.stringify(checked,null,2));
  assert.equal(checked.evidence.tokens[0].sourceValue,'var(--starci-core-accent)');
  assert.equal(checked.evidence.tokens[0].resolvedFrom,'--starci-core-accent');
});

test('tokens-match-source binds every brand colour to the shipped stylesheet across notations',t=>{
  const {work}=tree(t);
  const source=frontend(t);
  const brand=brandSpec();
  const pass=checkTokensMatchSource({brand,sourceRoot:source});
  assert.equal(pass.outcome,'pass',JSON.stringify(pass));
  assert.equal(pass.evidence.tokens.every(finding=>finding.status==='match'),true);
  assert.ok(readBrandRecord(work).brand.color.tokens.length,'the record under the tree is the same shape the check reads');

  const drifted=frontend(t,{css:CSS.replace(ACCENT_OKLCH,'#7b4dff'),label:'fe-drift'});
  const fail=checkTokensMatchSource({brand,sourceRoot:drifted});
  assert.equal(fail.outcome,'fail');
  const accent=fail.evidence.tokens.find(finding=>finding.token==='--starci-core-accent');
  assert.equal(accent.status,'differs');
  assert.equal(accent.expected,ACCENT);
  assert.equal(accent.actual,'#7b4dff');
  assert.ok(accent.deltaE>TOKEN_TOLERANCE);

  const absent=frontend(t,{css:CSS.replace(/--starci-core-danger:[^;]+;/,''),label:'fe-absent'});
  const missing=checkTokensMatchSource({brand,sourceRoot:absent});
  assert.equal(missing.outcome,'fail');
  assert.equal(missing.evidence.tokens.find(finding=>finding.token==='--starci-core-danger').status,'absent');

  const onlyDark=frontend(t,{css:'[data-theme="dark"]{--starci-core-accent:'+ACCENT+';--starci-core-danger:'+DANGER+';--starci-core-surface:#fff;}',label:'fe-dark'});
  assert.equal(checkTokensMatchSource({brand,sourceRoot:onlyDark}).evidence.tokens[0].status,'only-in-dark-scope');
});

test('tokens-match-source skips rather than passing when it cannot read the source',t=>{
  const brand=brandSpec();
  const withoutRoot=checkTokensMatchSource({brand,sourceRoot:null});
  assert.equal(withoutRoot.outcome,'skip');
  assert.match(withoutRoot.detail,/--source/);
  const empty=temporary(t,'empty-fe');
  const unread=checkTokensMatchSource({brand,sourceRoot:empty});
  assert.equal(unread.outcome,'skip');
  assert.equal(unread.evidence.files[0].error,'this repository does not carry the declared file');
  const escaping=checkTokensMatchSource({brand:{...brand,sources:[{repository:'fe',path:'../outside.css',kind:'css'}]},sourceRoot:empty});
  assert.equal(escaping.evidence.files[0].error,'the declared path escapes its repository root');
});

test('contrast-aa measures declared text pairs and the primary on its surface',()=>{
  const brand=brandSpec();
  const pass=checkContrastAa({brand});
  assert.equal(pass.outcome,'pass',JSON.stringify(pass));
  assert.equal(pass.evidence.pairs.length,3);
  assert.equal(pass.evidence.pairs.find(pair=>pair.kind==='non-text').minimum,3);

  const illegible=brandSpec();
  illegible.color.tokens[0].foreground='#b0a0ff';
  const fail=checkContrastAa({brand:illegible});
  assert.equal(fail.outcome,'fail');
  assert.equal(fail.evidence.pairs.find(pair=>pair.token==='--starci-core-accent').outcome,'fail');

  const strict=brandSpec();
  strict.color.policy.minContrast=7;
  assert.equal(checkContrastAa({brand:strict}).outcome,'fail','a raised floor is the brand\'s own policy, not a constant');

  const paleSurface=brandSpec();
  paleSurface.color.tokens[0].value='#efeaff';
  paleSurface.color.tokens[0].foreground='#17112b';
  const nonText=checkContrastAa({brand:paleSurface}).evidence.pairs.find(pair=>pair.kind==='non-text');
  assert.equal(nonText.outcome,'fail','a primary indistinguishable from its surface is not a 3:1 indicator');

  assert.equal(checkContrastAa({brand:{color:{tokens:[{token:'--starci-core-accent',value:ACCENT,role:'primary'}]}}}).outcome,'skip');
});

test('primary-danger-distinct fails a danger that reads as primary and passes with a note when the owner allows it',()=>{
  const brand=brandSpec();
  const distinct=checkPrimaryDangerDistinct({brand});
  assert.equal(distinct.outcome,'pass');
  assert.ok(distinct.evidence.deltaE>=MIN_PRIMARY_DANGER_DELTA);

  const shared=brandSpec();
  shared.color.tokens[1].value='#7b4dff';
  const fail=checkPrimaryDangerDistinct({brand:shared});
  assert.equal(fail.outcome,'fail');
  assert.ok(fail.evidence.deltaE<MIN_PRIMARY_DANGER_DELTA);

  const allowed=brandSpec();
  allowed.color.tokens[1].value='#7b4dff';
  allowed.color.policy.dangerMayMatchPrimary=true;
  const note=checkPrimaryDangerDistinct({brand:allowed});
  assert.equal(note.outcome,'pass');
  assert.equal(note.evidence.note,'the owner allows danger to share the primary hue; destructive actions must carry an icon and a verb');
  assert.match(note.detail,/destructive actions must carry an icon and a verb/);
  assert.equal(note.evidence.deltaE,fail.evidence.deltaE,'the permitted case still reports the distance');

  const incomplete=brandSpec();
  incomplete.color.tokens=incomplete.color.tokens.filter(token=>token.role!=='danger');
  assert.equal(checkPrimaryDangerDistinct({brand:incomplete}).outcome,'skip');
});

test('mascot-assets-present verifies the bytes under the tree',t=>{
  const {work,mascotSha}=tree(t);
  const brand=brandSpec();
  const unpinned=checkMascotAssetsPresent({brand,tree:work,brandDir:path.join(work,'brand')});
  assert.equal(unpinned.outcome,'pass');
  assert.equal(unpinned.evidence.assets[0].status,'present-unpinned');
  assert.equal(unpinned.evidence.assets[0].computedSha256,mascotSha);

  const pinned=brandSpec();
  pinned.mascot.assets[0].sha256=mascotSha;
  assert.equal(checkMascotAssetsPresent({brand:pinned,tree:work,brandDir:path.join(work,'brand')}).evidence.assets[0].status,'verified');

  const wrong=brandSpec();
  wrong.mascot.assets[0].sha256='0'.repeat(64);
  const mismatch=checkMascotAssetsPresent({brand:wrong,tree:work,brandDir:path.join(work,'brand')});
  assert.equal(mismatch.outcome,'fail');
  assert.equal(mismatch.evidence.assets[0].status,'sha256-mismatch');

  const gone=brandSpec();
  gone.mascot.assets[0].path='brand/assets/absent.svg';
  assert.equal(checkMascotAssetsPresent({brand:gone,tree:work,brandDir:path.join(work,'brand')}).evidence.assets[0].status,'absent');

  fs.writeFileSync(path.join(work,'brand/assets/mascot.txt'),'not an image');
  const wrongFormat=brandSpec();
  wrongFormat.mascot.assets[0].path='brand/assets/mascot.txt';
  assert.equal(checkMascotAssetsPresent({brand:wrongFormat,tree:work,brandDir:path.join(work,'brand')}).evidence.assets[0].status,'unsupported-format');

  const escaping=brandSpec();
  escaping.mascot.assets[0].path='../../outside.svg';
  assert.equal(checkMascotAssetsPresent({brand:escaping,tree:work,brandDir:path.join(work,'brand')}).evidence.assets[0].status,'escapes-tree');
  assert.equal(checkMascotAssetsPresent({brand:{mascot:{assets:[]}},tree:work,brandDir:path.join(work,'brand')}).outcome,'skip');
});

test('icon-set-only lists imports outside the declared glyph set and ignores vendored trees',t=>{
  assert.deepEqual(importSpecifiers("import {A} from '@heroicons/react/24/outline';\nconst x=()=>import('react-icons/fa');\nimport './side-effect.css';\n").map(found=>found.specifier),
    ['@heroicons/react/24/outline','react-icons/fa','./side-effect.css']);
  const brand=brandSpec();
  const offending=frontend(t,{label:'fe-icons'});
  const fail=checkIconSetOnly({brand,sourceRoot:offending});
  assert.equal(fail.outcome,'fail');
  assert.equal(fail.evidence.offenderCount,2);
  assert.deepEqual(fail.evidence.offenders.map(offender=>offender.specifier).sort(),['@iconify/react','react-icons/fa']);
  assert.equal(fail.evidence.offenders.every(offender=>offender.file==='src/bad.tsx'),true,'node_modules, dist and .next are not the product\'s source');
  const clean=frontend(t,{bad:false,label:'fe-clean'});
  assert.equal(checkIconSetOnly({brand,sourceRoot:clean}).outcome,'pass');
  assert.equal(checkIconSetOnly({brand,sourceRoot:null}).outcome,'skip');
  assert.equal(checkIconSetOnly({brand,sourceRoot:temporary(t,'fe-bare')}).outcome,'skip','nothing scanned is nothing proven');
});

test('tokens-in-grammar refuses token names the grammar canon does not declare',t=>{
  const grammarRoot=grammar(t);
  const brand=brandSpec();
  assert.equal(checkTokensInGrammar({brand,family:'starci',grammarRoot}).outcome,'pass');
  const invented=brandSpec();
  invented.color.tokens.push({token:'--starci-brand-hero',value:ACCENT,role:'other'});
  const fail=checkTokensInGrammar({brand:invented,family:'starci',grammarRoot});
  assert.equal(fail.outcome,'fail');
  assert.deepEqual(fail.evidence.missing,['--starci-brand-hero']);
  const absent=checkTokensInGrammar({brand,family:'nobody',grammarRoot});
  assert.equal(absent.outcome,'skip');
  assert.match(absent.detail,/no DNA snapshot/);
  assert.equal(checkTokensInGrammar({brand,family:null,grammarRoot}).outcome,'skip');
});

test('runBrandChecks reports every check, resolves the record from a repository root, and refuses a broken input',t=>{
  const {repoRoot,work}=tree(t,{label:'run'});
  const source=frontend(t,{bad:false,label:'fe-run'});
  const grammarRoot=grammar(t);
  const result=runBrandChecks({tree:work,sourceRoot:source,grammarRoot});
  assert.equal(result.schema,BRAND_CHECKS);
  assert.deepEqual(result.checks.map(entry=>entry.id),CHECK_IDS);
  assert.equal(result.ok,true,JSON.stringify(result.checks.filter(entry=>entry.outcome!=='pass'),null,2));
  assert.equal(result.checks.every(entry=>entry.outcome==='pass'),true);
  assert.deepEqual(result.brand,{rev:'brand-1',family:'starci',revSource:'declared',record:'brand/index.yaml'});
  assert.match(formatBrandChecks(result),/\[pass\] tokens-match-source/);

  const fromRepository=runBrandChecks({tree:repoRoot,sourceRoot:source,grammarRoot});
  assert.equal(fromRepository.brand.record,'.starciwork/brand/index.yaml');
  assert.equal(fromRepository.ok,true,JSON.stringify(fromRepository.checks.filter(entry=>entry.outcome!=='pass'),null,2));

  const current=tree(t,{label:'run-node-2',schema:'work/node@2'});
  const fromNode2=runBrandChecks({tree:current.work,sourceRoot:source,grammarRoot});
  assert.equal(fromNode2.ok,true,JSON.stringify(fromNode2.checks.filter(entry=>entry.outcome!=='pass'),null,2));

  const withoutSource=runBrandChecks({tree:work,grammarRoot});
  assert.equal(withoutSource.ok,true);
  assert.deepEqual(withoutSource.checks.filter(entry=>entry.outcome==='skip').map(entry=>entry.id),['tokens-match-source','icon-set-only']);

  const broken=tree(t,{brand:brandSpec(),label:'broken'});
  const failing=runBrandChecks({tree:broken.work,sourceRoot:frontend(t,{label:'fe-broken'}),grammarRoot});
  assert.equal(failing.ok,false);
  assert.deepEqual(failing.checks.filter(entry=>entry.outcome==='fail').map(entry=>entry.id),['icon-set-only']);

  const undigested=temporary(t,'no-record');
  assert.throws(()=>runBrandChecks({tree:undigested}),/No brand record/);
  write(undigested,'brand/index.yaml',stringifyYaml({schema:'work/node@1',id:'brand',kind:'ui',required:true,state:'todo'}));
  assert.throws(()=>runBrandChecks({tree:undigested}),/kind brand/);
  fs.writeFileSync(path.join(undigested,'brand/index.yaml'),stringifyYaml({schema:'work/node@1',id:'brand',kind:'brand',required:true,state:'todo'}));
  assert.throws(()=>runBrandChecks({tree:undigested}),/no brand specification/);
});

test('a record with no declared rev is identified by the digest of its own bytes',t=>{
  const {work}=tree(t,{rev:null,label:'digest'});
  const identity=readBrandRecord(work);
  assert.equal(identity.revSource,'content-digest');
  assert.match(identity.rev,/^[0-9a-f]{12}$/);
  fs.appendFileSync(identity.file,'\n# an accepted change\n');
  assert.notEqual(readBrandRecord(work).rev,identity.rev);
});

test('the brand check formats one line per check and fails when a check fails',t=>{
  const {work}=tree(t,{label:'cli'});
  const clean=frontend(t,{bad:false,label:'fe-cli'});
  const offending=frontend(t,{label:'fe-cli-bad'});

  const text=formatBrandChecks(runBrandChecks({tree:work,sourceRoot:clean}));
  for(const id of CHECK_IDS)assert.match(text,new RegExp(`\\[pass\\] ${id}:`),id);

  const parsed=runBrandChecks({tree:work,sourceRoot:clean});
  assert.equal(parsed.schema,BRAND_CHECKS);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.brand.family,'starci');

  const failed=runBrandChecks({tree:work,sourceRoot:offending});
  assert.equal(failed.ok,false);
  assert.equal(failed.checks.find(entry=>entry.id==='icon-set-only').outcome,'fail');

  const alone=formatBrandChecks(runBrandChecks({tree:work}));
  assert.match(alone,/\[skip\] tokens-match-source/);

  assert.throws(()=>runBrandChecks({}),/needs a Work tree/);
  assert.throws(()=>runBrandChecks({tree:path.join(work,'nowhere')}),'a missing tree cannot be checked');
});
