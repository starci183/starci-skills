import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {parseYaml} from '../../engine/yaml.mjs';
import {addWorkCommon} from '../../scripts/lib/work-schemas.mjs';
import {openLedger,ledgerFileFor,projectsRootFor} from '../../engine/db/ledger.mjs';
import {writeAskReceipt} from '../../scripts/machine/ask-receipts.mjs';
import { OWNER_ANSWER_SCHEMA, checkTokensMatchSource, checkValueSource } from '../../scripts/work/brand/brand.mjs';

/*
 * Nivo brand.decide blocked BRAND_TOKEN_UNTRACEABLE: the owner (through the autopilot's standing ruling) had ruled the ink colour
 * #040d1c in an ask, but no file declared it - the app theme still used the grammar default - and the contract had no way to trace a
 * token to that ruling. A token may now name {ruling, token, value}: the check reads the ledger's recorded answer, and the
 * declaration in the app theme is owed to interface.implement, which review.verify enforces.
 */
const ASK='ctx_398c5d4ea8da';
const INK='#040d1c';
const OPTION=`A. Declare the ink in the interface first: add --accent: ${INK} and --accent-foreground: #fff to the app globals.css (a small change in fe), then rerun the brand step.`;
const APP='fe/apps/app/src/app/globals.css';
const APP_CSS=':root {\n  --surface: #ffffff;\n  --muted: #6b7280;\n}\n';
// The project ledgers answer() opens live under the test projects root; removed with the spec.
test.after(()=>fs.rmSync(projectsRootFor(),{recursive:true,force:true,maxRetries:20,retryDelay:25}));

function product(t,{css=APP_CSS}={}){
  const repoRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ruling-source-'));
  t.after(()=>fs.rmSync(repoRoot,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const file=path.join(repoRoot,APP);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,css);
  const brandDir=path.join(repoRoot,'.starciwork','brand');
  fs.mkdirSync(brandDir,{recursive:true});
  return {repoRoot,brandDir};
}

/** What serve-ask (or the autopilot) stores when an ask is answered: a blob and a decisions row in the project ledger. */
function answer({repoRoot},{dispatchId=ASK,answeredBy='autopilot',option=OPTION,note=null,at=1791378222702}={}){
  const ledger=openLedger({file:ledgerFileFor(repoRoot)});
  try{
    ledger.ensureWorkflow({workflowId:'wf-nivo'});
    writeAskReceipt(ledger,{workflowId:'wf-nivo',dispatchId,at,receipt:{schema:OWNER_ANSWER_SCHEMA,workflowId:'wf-nivo',dispatchId,opId:'brand.decide',
      option,optionIndex:0,answeredBy,...(answeredBy==='autopilot'?{provisional:true}:{}),note,at:new Date(at).toISOString()}});
  }finally{ledger.close();}
}

const ruled=(fields={})=>({token:'--accent',value:INK,role:'primary',valueSource:{ruling:ASK,token:'--accent',value:INK,...fields}});
const brandWith=(token=ruled())=>({identity:{family:'starci'},
  color:{tokens:[{token:'--surface',value:'#ffffff',role:'surface'},{token:'--muted',value:'#6b7280',role:'muted'},token],policy:{dangerMayMatchPrimary:false}},
  sources:[{path:APP,kind:'css'}]});
const checkIn=(p,stage,token)=>checkTokensMatchSource({brand:brandWith(token),sourceRoot:p.repoRoot,brandDir:p.brandDir,stage});
const entry=(result,token='--accent')=>result.evidence.tokens.find(found=>found.token===token);



test('decide: a token no file declares passes when the ledger holds the answer that ruled its value, with the declaration owed to interface.implement',t=>{
  const p=product(t);
  answer(p);
  const result=checkIn(p,'decide');
  assert.equal(result.outcome,'pass',JSON.stringify(result,null,2));
  const found=entry(result);
  assert.equal(found.status,'planned-from-ruling');
  assert.equal(found.actual,null,'the app theme does not declare it yet');
  assert.deepEqual([found.valueSource.ruling,found.valueSource.token,found.valueSource.value,found.valueSource.owedTo],[ASK,'--accent',INK,'interface.implement']);
  assert.deepEqual([found.valueSource.answeredBy,found.valueSource.provisional],['autopilot',true],'a provisional ruling says so');
  assert.equal(found.valueSource.deltaE,0);
  assert.match(result.detail,/1 planned from the ledger's recorded ruling and owed to interface\.implement/);
  assert.match(result.detail,new RegExp(`--accent \\(ruling ${ASK}, autopilot\\)`));
  assert.equal(entry(result,'--surface').status,'match','the other tokens still bind to the app source');
});

test('the owner herself and the config auto-accept are rulings too; any other answerer is not',t=>{
  for(const answeredBy of ['owner','auto-recommended']){
    const p=product(t);
    answer(p,{answeredBy});
    assert.equal(entry(checkIn(p,'decide')).status,'planned-from-ruling',answeredBy);
  }
  const stranger=product(t);
  answer(stranger,{answeredBy:'stranger'});
  assert.equal(entry(checkIn(stranger,'decide')).status,'ruling-unrecorded');
});

test('verify: the owed declaration is enforced, and the token binds to the app source once interface.implement wrote it',t=>{
  const p=product(t);
  answer(p);
  const owed=checkIn(p,'verify');
  assert.equal(owed.outcome,'fail');
  assert.equal(entry(owed).status,'planned-source-missing');
  assert.equal(entry(owed).valueSource.referenceStatus,'planned-from-ruling');
  assert.match(owed.detail,/--accent \(planned-source-missing/);

  fs.appendFileSync(path.join(p.repoRoot,APP),`:root { --accent: ${INK}; }\n`);
  for(const stage of ['decide','verify']){
    const written=checkIn(p,stage);
    assert.equal(written.outcome,'pass',`${stage}: ${JSON.stringify(written,null,2)}`);
    assert.equal(entry(written).status,'match');
    assert.equal(entry(written).plannedTokenWritten,true);
  }
});

test('a ruling that is not in the ledger, does not carry the value, or is for another token traces nothing',t=>{
  const p=product(t);
  answer(p);
  const statusOf=(token)=>entry(checkIn(p,'decide',token)).status;
  assert.equal(statusOf(ruled({ruling:'ctx_000000000000'})),'ruling-unrecorded','no answer under that dispatch id');
  assert.equal(statusOf({...ruled({value:'#ff0000'}),value:'#ff0000'}),'ruling-differs','the answer does not carry #ff0000');
  assert.equal(statusOf({...ruled(),value:'#111111'}),'ruling-differs','the brand value is not the ruled value');
  const result=checkIn(p,'decide',ruled({token:'--primary'}));
  assert.equal(entry(result).status,'value-source-invalid');
  assert.match(entry(result).valueSource.why,/must be this brand token, --accent/);
  assert.equal(result.outcome,'fail');
  const unrecorded=checkIn(p,'decide',ruled({ruling:'ctx_000000000000'}));
  assert.match(unrecorded.detail,/no receipt answers ctx_000000000000/);
});

test('the ruling and the file form do not mix, and a ruling needs a ledger to read',t=>{
  const p=product(t);
  answer(p);
  assert.equal(checkValueSource({sourceRoot:p.repoRoot,brandDir:p.brandDir,token:ruled({path:APP})}).status,'value-source-invalid');
  assert.equal(checkValueSource({sourceRoot:p.repoRoot,brandDir:p.brandDir,token:ruled({ruling:'  '})}).status,'value-source-invalid');
  assert.equal(checkValueSource({sourceRoot:p.repoRoot,brandDir:p.brandDir,token:ruled({value:''})}).status,'value-source-invalid');
  assert.equal(checkValueSource({sourceRoot:p.repoRoot,token:ruled()}).status,'ruling-unrecorded','without a Work tree no answer can be read');
  assert.equal(checkValueSource({sourceRoot:p.repoRoot,brandDir:p.brandDir,token:ruled()}).status,'planned-from-ruling');
});

test('the value may be carried by a note or a pick of the answer, spelled as another colour notation',t=>{
  const p=product(t);
  answer(p,{option:'B. Use the ink the owner named',note:'the ink is rgb(4, 13, 28) everywhere'});
  assert.equal(entry(checkIn(p,'decide')).status,'planned-from-ruling');
});

test('the brand schema accepts the ruling form and the file form of valueSource, and refuses a mix of them',()=>{
  const root=path.resolve(import.meta.dirname,'..','..');
  const Ajv2020=(()=>{const loaded=createRequire(path.join(root,'package.json'))('ajv/dist/2020.js');return loaded?.default??loaded;})();
  const ajv=addWorkCommon(new Ajv2020({strict:false,allErrors:true,logger:false}));
  const validate=ajv.compile(parseYaml(fs.readFileSync(path.join(root,'modules/schemas/work-brand.schema.yaml'),'utf8')));
  const record=(valueSource)=>({schema:'work/brand@1',id:'brand',kind:'brand',state:'todo',rev:1,
    brand:{color:{tokens:[{token:'--accent',value:INK,valueSource}]}}});
  const refused=(valueSource)=>{validate(record(valueSource));return (validate.errors??[]).some(error=>error.instancePath.includes('valueSource')||error.schemaPath.includes('valueSource'));};
  assert.equal(refused({ruling:ASK,token:'--accent',value:INK}),false,'ruling form');
  assert.equal(refused({path:APP,token:'--accent',value:INK,line:3}),false,'file form');
  assert.equal(refused({ruling:ASK,path:APP,token:'--accent',value:INK}),true,'both forms at once');
  assert.equal(refused({ruling:ASK,value:INK}),true,'a ruling names the token');
  assert.equal(refused({token:'--accent',value:INK}),true,'neither form');
});
