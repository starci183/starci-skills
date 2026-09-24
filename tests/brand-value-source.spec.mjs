import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import {
  BRAND_STAGES,TOKEN_PASS_STATUSES,brandMain,brandStage,checkTokensInGrammar,checkTokensMatchSource,checkValueSource,
  grammarTokenNames,runBrandChecks
} from '../scripts/checks/brand.mjs';

/*
 * starci-next inc-b077846a4012: the owner ruled a new brand token --starci-surface-tertiary (the Academy
 * render's oklch(93.73% 0.0012 354.13)) that the starci-next-fe theme does not declare yet - interface.implement
 * writes it later. tokens-in-grammar refused the name (no tertiary surface in the starci DNA) and
 * tokens-match-source refused the token (no app source declares it). The DNA now carries the tertiary face and a
 * brand token may bind to its reference render through valueSource until the app writes it.
 */
const root=fileURLToPath(new URL('..',import.meta.url));
const TERTIARY='oklch(93.73% 0.0012 354.13)';
const ACADEMY='starci-academy-fe/src/app/globals.css';
const APP='starci-next-fe/src/app/globals.css';
const ACADEMY_CSS=`:root,
.light,
[data-theme="light"] {
  --surface: oklch(100% 0.0008 354.13);
  --surface-secondary: oklch(95.24% 0.0012 354.13);
  --surface-tertiary:   ${TERTIARY};
  --muted: oklch(55.17% 0.003 354.13);
}
.dark, [data-theme="dark"] {
  --surface-tertiary: oklch(27.21% 0.0023 354.13);
  --only-dark: oklch(27.21% 0.0023 354.13);
}
`;
const APP_CSS=`:root {
  --surface: oklch(100% 0.0008 354.13);
  --muted: oklch(55.17% 0.003 354.13);
}
`;

function temporary(t,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`starci-value-source-${label}-`));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}
const write=(dir,relative,body)=>{
  const file=path.join(dir,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,body);
  return file;
};
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');

/** A --source root holding the reference render and the product's own (not yet tertiary) theme. */
function repositories(t,{academy=ACADEMY_CSS,app=APP_CSS,label='repos'}={}){
  const dir=temporary(t,label);
  write(dir,ACADEMY,academy);
  if(app!==null)write(dir,APP,app);
  return dir;
}
const planned=(fields={})=>({token:'--starci-surface-tertiary',value:TERTIARY,role:'surface-tertiary',
  valueSource:{path:ACADEMY,token:'--surface-tertiary',value:TERTIARY,line:6,...fields}});
const brandWith=(token=planned(),{sources=[{path:APP,kind:'css'},{path:ACADEMY,kind:'css'}]}={})=>({
  identity:{family:'starci'},
  color:{tokens:[{token:'--surface',value:'oklch(100% 0.0008 354.13)',role:'surface'},{token:'--muted',value:'oklch(55.17% 0.003 354.13)',role:'muted'},token],
    policy:{dangerMayMatchPrimary:false}},
  sources
});
const finding=(result,token='--starci-surface-tertiary')=>result.evidence.tokens.find(entry=>entry.token===token);

test('the stages are decide and verify, with the op names as aliases and nothing else',()=>{
  assert.deepEqual([...BRAND_STAGES],['decide','verify']);
  assert.deepEqual([...TOKEN_PASS_STATUSES],['match','planned-from-reference']);
  assert.equal(brandStage(undefined),'decide');
  assert.equal(brandStage('brand.decide'),'decide');
  assert.equal(brandStage('review.verify'),'verify');
  assert.throws(()=>brandStage('uat'),/Unknown brand check stage/);
});

test('decide: a token the app has not written passes as planned-from-reference when its reference declares exactly its value',t=>{
  const sourceRoot=repositories(t);
  const result=checkTokensMatchSource({brand:brandWith(),sourceRoot});
  assert.equal(result.outcome,'pass',JSON.stringify(result,null,2));
  assert.equal(result.evidence.stage,'decide');
  const entry=finding(result);
  assert.equal(entry.status,'planned-from-reference');
  assert.equal(entry.actual,null,'the app source does not declare it');
  assert.equal(entry.valueSource.path,ACADEMY);
  assert.equal(entry.valueSource.token,'--surface-tertiary');
  assert.equal(entry.valueSource.deltaE,0);
  assert.match(result.detail,/1 planned from their reference render/);
  assert.equal(finding(result,'--surface').status,'match','the other tokens still bind to the app source');
  // The digest pins the bytes read; the reference is never written.
  const pinned=checkTokensMatchSource({brand:brandWith(planned({sha256:sha(ACADEMY_CSS)})),sourceRoot});
  assert.equal(pinned.outcome,'pass');
  assert.equal(fs.readFileSync(path.join(sourceRoot,ACADEMY),'utf8'),ACADEMY_CSS);
});

test('verify: a planned token still missing from the app source is refused, even though its reference holds',t=>{
  const sourceRoot=repositories(t);
  const result=checkTokensMatchSource({brand:brandWith(),sourceRoot,stage:'verify'});
  assert.equal(result.outcome,'fail');
  const entry=finding(result);
  assert.equal(entry.status,'planned-source-missing');
  assert.equal(entry.valueSource.referenceStatus,'planned-from-reference');
  assert.match(result.detail,/--starci-surface-tertiary \(planned-source-missing/);
});

test('once the app theme declares the token the normal source match applies, at both stages',t=>{
  const written=repositories(t,{app:`${APP_CSS}:root { --starci-surface-tertiary: ${TERTIARY}; }\n`,label:'written'});
  for(const stage of BRAND_STAGES){
    const result=checkTokensMatchSource({brand:brandWith(),sourceRoot:written,stage});
    assert.equal(result.outcome,'pass',`${stage}: ${JSON.stringify(result,null,2)}`);
    const entry=finding(result);
    assert.equal(entry.status,'match');
    assert.equal(entry.file,APP);
    assert.equal(entry.plannedTokenWritten,true);
  }
  // A written token with another value is a plain miss: the reference does not rescue it.
  const drifted=repositories(t,{app:`${APP_CSS}:root { --starci-surface-tertiary: oklch(90% 0.0012 354.13); }\n`,label:'drifted'});
  const result=checkTokensMatchSource({brand:brandWith(),sourceRoot:drifted});
  assert.equal(result.outcome,'fail');
  assert.equal(finding(result).status,'differs');
});

test('the reference file is never the app source, even when sources[] also lists it',t=>{
  // The reference declares the brand token under its own name; only the app theme may prove it at verify.
  const academy=ACADEMY_CSS.replace('--surface-tertiary:   ','--starci-surface-tertiary: ');
  const sourceRoot=repositories(t,{academy,label:'same-name'});
  const token=planned({token:undefined});
  delete token.valueSource.token;
  const decided=checkTokensMatchSource({brand:brandWith(token),sourceRoot});
  assert.equal(finding(decided).status,'planned-from-reference',JSON.stringify(finding(decided)));
  const verified=checkTokensMatchSource({brand:brandWith(token),sourceRoot,stage:'verify'});
  assert.equal(finding(verified).status,'planned-source-missing');
});

test('decide: a reference that does not hold the value refuses the planned token, with the reason',t=>{
  const sourceRoot=repositories(t,{label:'refusals'});
  const cases=[
    ['value-source-invalid','not an object',{token:'--starci-surface-tertiary',value:TERTIARY,role:'other',valueSource:'academy'}],
    ['value-source-invalid','no value',planned({value:''})],
    ['value-source-invalid','a token that is no custom property',planned({token:'surface-tertiary'})],
    ['reference-unreadable','a path outside the root',planned({path:'../elsewhere.css'})],
    ['reference-unreadable','a file the root does not carry',planned({path:'starci-academy-fe/missing.css'})],
    ['reference-digest-mismatch','a changed file',planned({sha256:sha('older bytes')})],
    ['reference-absent','a property the reference does not declare',planned({token:'--surface-quaternary'})],
    ['reference-only-in-dark-scope','a dark-only declaration',planned({token:'--only-dark',value:'oklch(27.21% 0.0023 354.13)'})],
    ['reference-differs','another value text',planned({value:'oklch(93.7% 0.0012 354.13)'})],
    ['reference-differs','a brand value that is not the reference value',{...planned(),value:'oklch(90% 0.0012 354.13)'}],
  ];
  for(const [status,label,token] of cases){
    const result=checkTokensMatchSource({brand:brandWith(token),sourceRoot});
    assert.equal(result.outcome,'fail',label);
    assert.equal(finding(result).status,status,`${label}: ${JSON.stringify(finding(result))}`);
    assert.ok(result.detail.includes(status),label);
  }
  // Whitespace and case in the reference declaration are not a different value.
  assert.equal(checkValueSource({sourceRoot,token:planned({value:'OKLCH(93.73%  0.0012 354.13)'})}).status,'planned-from-reference');
});

test('verify: a brand with planned tokens fails instead of skipping when no app source can be read',t=>{
  const empty=temporary(t,'empty');
  const unread=checkTokensMatchSource({brand:brandWith(planned(),{sources:[{path:APP,kind:'css'}]}),sourceRoot:empty,stage:'verify'});
  assert.equal(unread.outcome,'fail');
  assert.equal(unread.evidence.tokens[0].status,'planned-source-missing');
  const named=checkTokensMatchSource({brand:brandWith(planned(),{sources:[]}),sourceRoot:empty,stage:'verify'});
  assert.equal(named.outcome,'fail');
  // Decide, and a brand with nothing planned, keep the honest skip.
  assert.equal(checkTokensMatchSource({brand:brandWith(planned(),{sources:[{path:APP,kind:'css'}]}),sourceRoot:empty}).outcome,'skip');
  const plain=brandWith(planned());
  plain.color.tokens.pop();
  assert.equal(checkTokensMatchSource({brand:{...plain,sources:[{path:APP,kind:'css'}]},sourceRoot:empty,stage:'verify'}).outcome,'skip');
});

test('the starci grammar DNA declares the tertiary surface under the family name and leaves HeroUI\'s alone',()=>{
  const canon=grammarTokenNames({family:'starci'});
  assert.equal(canon.error,null);
  for(const name of ['--starci-surface-tertiary','--starci-surface-tertiary-foreground','--starci-core-surface-tertiary'])
    assert.ok(canon.names.includes(name),name);
  assert.ok(!canon.names.includes('--surface-tertiary'),'Core never re-binds HeroUI\'s --surface-tertiary');
  const dna=parseYaml(fs.readFileSync(path.join(root,'knowledge/grammars/starci/DNA.yaml'),'utf8'));
  assert.equal(dna.dna.STARCI_CORE_DNA.color.light.surfaceTertiary,TERTIARY);
  assert.equal(dna.dna.STARCI_CORE_TOKEN_NAMES.surfaceTertiary,'--starci-core-surface-tertiary');
  const row=dna.tokens.find(token=>token.name==='--starci-surface-tertiary');
  assert.equal(row.value,'var(--starci-core-surface-tertiary)');
  const coreCss=fs.readFileSync(path.join(root,'packages/grammar/src/core/styles.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/(^|[^-\w])--surface-tertiary\s*:/m.test(coreCss),'the Core sheet assigns no --surface-tertiary');
  assert.match(coreCss,/--starci-surface-tertiary: var\(--starci-core-surface-tertiary\);/);
  const brand=brandWith();
  assert.equal(checkTokensInGrammar({brand,family:'starci',grammarRoot:path.join(root,'knowledge/grammars')}).outcome,'pass');
});

test('runBrandChecks and the command line carry the stage through',t=>{
  const sourceRoot=repositories(t,{label:'run'});
  const work=temporary(t,'work');
  write(work,'brand/index.yaml',stringifyYaml({schema:'work/brand@1',id:'brand',kind:'brand',rev:5,brand:brandWith()}));
  const decided=runBrandChecks({tree:work,sourceRoot});
  assert.equal(decided.stage,'decide');
  assert.equal(decided.checks.find(entry=>entry.id==='tokens-match-source').outcome,'pass');
  assert.equal(decided.checks.find(entry=>entry.id==='tokens-in-grammar').outcome,'pass');
  const verified=runBrandChecks({tree:work,sourceRoot,stage:'review.verify'});
  assert.equal(verified.stage,'verify');
  assert.equal(verified.ok,false);
  assert.throws(()=>runBrandChecks({tree:work,sourceRoot,stage:'later'}),/Unknown brand check stage/);

  const decide=brandMain([work,'--source',sourceRoot,'--json']);
  assert.equal(JSON.parse(decide.text).checks.find(entry=>entry.id==='tokens-match-source').outcome,'pass');
  const verify=brandMain([work,'--stage','verify','--source',sourceRoot]);
  assert.equal(verify.exitCode,1);
  assert.match(verify.text,/\(verify stage\)/);
  assert.match(verify.text,/\[FAIL\] tokens-match-source: .*planned-source-missing/);
  assert.equal(brandMain([]).exitCode,1);
  assert.equal(brandMain([work,'--stage','later']).exitCode,1);
  const cli=spawnSync(process.execPath,[path.join(root,'scripts/checks/brand.mjs'),work,'--source',sourceRoot,'--stage','verify'],{encoding:'utf8'});
  assert.equal(cli.status,1,cli.stderr);
  assert.match(cli.stderr,/planned-source-missing/);
});
