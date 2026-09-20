import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';

/**
 * Coverage matrices, kept honest by discovery rather than by hand.
 *
 * A. knowledge/patterns/{fe,be}/ records: every authored rule maps to an executable check
 *    (a script obligation routed into scripts/checks/code-patterns/, an ESLint obligation or an
 *    architecture obligation of modules/models/code-patterns.yaml) or carries an explicit manual
 *    marker with a reason (an authored `check: manual`, a nonempty verification.manual
 *    list, or a profile semanticOnly entry with rationale+guidance).
 * B. .starciwork record classes (modules/models/records.yaml): every class maps to a schema file
 *    plus a runnable validator, or is marked external/embedded with the reason.
 * C. .stacks env/service files: every file under a repository .stacks/ is the manifest,
 *    referenced by the manifest (scripts/checks/stacks.mjs bounds-checks each reference), or a
 *    documented artifact. An env/service file nothing references is uncovered.
 * D. run-state layout (.starciwork/_local/workflows/<id>/): every persisted artifact class
 *    binds a schema const (or a declared internal format), an owning writer/validator, and
 *    a declared store path. Undeclared writes under _local quarantine the candidate; the
 *    declared housekeeping set is tolerated.
 * E. feature record layout (features/<feature>/ record trees): every records.yaml class
 *    binds a schema def, a validator and its declared path; a record written outside that
 *    path fails validateWorkspace with a named issue code.
 *
 * The expected gap sets are asserted exactly: closing a gap or adding a new one both
 * change these lists, so the matrix cannot silently drift.
 */

const root=path.resolve(import.meta.dirname,'..');
const read=relpath=>fs.readFileSync(path.join(root,relpath),'utf8');
const yaml=relpath=>parseYaml(read(relpath));

const catalog=yaml('modules/models/code-patterns.yaml');
const scriptSource=read('scripts/checks/check-scoped-lint.mjs');

// The adapter table of check-scoped-lint.mjs routes script ruleIds into scripts/checks/code-patterns/.
const adapters=[...scriptSource.matchAll(/\{profile:'(\w+)',module:'([\w-]+)',entry:'(\w+)',rules:\[([^\]]*)\]\}/g)]
  .map(match=>({profile:match[1],module:match[2],entry:match[3],rules:[...match[4].matchAll(/[A-Z][A-Z0-9_]+/g)].map(item=>item[0])}));
const scriptModuleFor=(profile,ruleIds)=>{
  const hit=adapters.filter(adapter=>adapter.profile===profile&&ruleIds.some(id=>adapter.rules.includes(id)));
  return hit[0]?.module??(profile==='nest'?'nest':profile==='next'?'next':null);
};

// ---------------------------------------------------------------- A. pattern records

const profileForFamily={};
for(const [name,p] of Object.entries(catalog.profiles))
  for(const dir of p.sourceRuleRoots??[])profileForFamily[path.basename(dir)]={name,profile:p};

const matrix=[],uncovered=[],uncorroborated=[];
const recordMatrix=[];
for(const family of ['fe','be']){
  const dir=`knowledge/patterns/${family}`;
  const {name:profileName,profile}=profileForFamily[family]??{};
  assert.ok(profile,`no code-pattern profile claims ${dir}`);
  const obligationOf=new Map(),manualOf=new Map(),boundCheckIds=new Set();
  for(const obligation of profile.obligations??[]){
    for(const id of obligation.sourceRuleIds??[])obligationOf.set(id,obligation);
    for(const id of obligation.mechanical?.check?.ruleIds??[])boundCheckIds.add(id);
  }
  for(const entry of profile.semanticOnly??[])
    for(const id of entry.sourceRuleIds??[])manualOf.set(id,entry);
  for(const file of fs.readdirSync(path.join(root,dir)).filter(name=>name.endsWith('.yaml')).sort()){
    const doc=yaml(`${dir}/${file}`);
    const rules=(doc.rules??[]).filter(rule=>rule&&typeof rule==='object'&&typeof rule.id==='string');
    const rows=[];
    for(const rule of rules){
      const obligation=obligationOf.get(rule.id),semantic=manualOf.get(rule.id);
      const authoredCheck=rule.check==='manual'||rule.check?.kind==='manual'||doc.check==='manual'||doc.check?.kind==='manual';
      const authoredManual=(rule.verification?.manual??[]).length>0;
      let coverage,detail;
      if(obligation){
        const kind=obligation.mechanical?.check?.kind;
        if(kind==='script'){
          const module=scriptModuleFor(profileName,obligation.mechanical.check.ruleIds??[]);
          coverage='script';detail=`${obligation.id} -> scripts/checks/code-patterns/${module}.mjs`;
        }else{coverage=kind??'unbound';detail=obligation.id;}
      }else if(semantic){
        assert.ok(semantic.rationale&&semantic.guidance,`${rule.id}: semanticOnly entry ${semantic.id} must carry rationale and guidance`);
        coverage='manual';detail=`${semantic.id}: ${String(semantic.rationale).slice(0,80)}`;
      }else if(authoredCheck||authoredManual){
        coverage='manual';detail=authoredCheck?'check:manual marker':`verification.manual (${rule.verification.manual.length} entries)`;
      }else{
        coverage='uncovered';detail='no obligation, no manual marker';
        uncovered.push(`${family}/${file}:${rule.id}`);
      }
      // An authored automated claim is a promise: it must name a check the profile actually binds.
      for(const claim of rule.verification?.automated??[]){
        const bound=[...boundCheckIds].some(id=>id===claim||id.endsWith(`/${claim}`));
        if(!bound)uncorroborated.push(`${rule.id}:${claim}`);
      }
      rows.push({rule:rule.id,coverage,detail});
      matrix.push(`${family}/${file}\t${rule.id}\t${coverage}\t${detail}`);
    }
    const kindsCovered=new Set(rows.map(row=>row.coverage));
    recordMatrix.push({record:`${family}/${file}`,rules:rules.length,
      dedicatedScript:kindsCovered.has('script'),manual:rules.length===0?'index':kindsCovered.has('manual'),
      uncovered:rows.filter(row=>row.coverage==='uncovered').length});
  }
}

test('every authored pattern rule maps to an executable check or a named manual marker',t=>{
  for(const line of matrix)t.diagnostic(line);
  for(const row of recordMatrix)t.diagnostic(`${row.record}\trules=${row.rules}\tdedicatedScript=${row.dedicatedScript}\tmanual=${row.manual}\tuncovered=${row.uncovered}`);
  assert.deepEqual(uncovered,[],'every rule must be bound by a profile obligation or an explicit manual marker');
});

test('the script-coverage gap is exactly the known set - comment/folder/function/imports/typing records with no dedicated script',async t=>{
  const withoutScript=recordMatrix.filter(row=>row.rules>0&&!row.dedicatedScript).map(row=>row.record).sort();
  assert.deepEqual(withoutScript,[
    'be/architecture-check.yaml','be/folder.yaml','be/function.yaml','be/naming.yaml','be/typing.yaml',
    'fe/architecture-check.yaml','fe/comment.yaml','fe/folder.yaml','fe/function.yaml','fe/imports.yaml'
  ],'a record gaining or losing its dedicated script check updates this list deliberately');
  // The five authored automated claims no profile obligation binds by name stay visible.
  assert.deepEqual([...uncorroborated].sort(),[
    'BE-COMMENT-7:no-ai-symbol','BE-COMMENT-7:no-emoji','BE-COMMENT-7:no-vietnamese',
    'BE-IMPORTS-1:no-self-module-alias','BE-IMPORTS-6:no-nest-logger']);
  // Every script obligation routes to a checker module that exists and exports its adapter.
  for(const adapter of adapters){
    const file=path.join(root,'scripts/checks/code-patterns',`${adapter.module}.mjs`);
    assert.ok(fs.existsSync(file),`scripts/checks/code-patterns/${adapter.module}.mjs is missing`);
    const loaded=await import(`${new URL(`../scripts/checks/code-patterns/${adapter.module}.mjs`,import.meta.url)}`);
    assert.equal(typeof loaded[adapter.entry],'function',`${adapter.module}.mjs must export ${adapter.entry}`);
  }
});

// ---------------------------------------------------------------- B. .starciwork record classes

const records=yaml('modules/models/records.yaml');
const workSchema=yaml('schemas/work.schema.yaml');
const schemaFile=relpath=>fs.existsSync(path.join(root,relpath));
const hasDef=name=>Boolean(workSchema?.$defs?.[name]);

// The declared mapping: record class -> schema artifact(s) and the runnable validator that
// enforces it. `external` marks records that live outside .starciwork by design; `embedded`
// marks records the parent node's own schema carries because no path maps to the class.
const RECORD_CLASS_COVERAGE={
  record:{schemas:['schemas/work.schema.yaml:$defs.node'],validator:'core/index.mjs:validateWorkspace'},
  srs:{schemas:['schemas/work.schema.yaml:$defs.businessSpec','specifications/srs-v3.schema.yaml','specifications/srs-sections.yaml'],validator:'specifications/validate.mjs:validateSpecification + core/index.mjs:validateWorkspace (SRS_BINDING, SRS_GRAPH)'},
  sds:{schemas:['schemas/work.schema.yaml:$defs.architectureSpec','specifications/sds.schema.yaml','specifications/sds-map.yaml'],validator:'specifications/validate.mjs:validateSpecification + core/index.mjs:validateWorkspace (SDS_BINDING, SDS_MAP)'},
  decision:{schemas:['schemas/work.schema.yaml:$defs.businessSpec','specifications/srs-sections.yaml (starci/srs-policy-decision@1)'],validator:'kernel/decision-inputs.mjs:canonicalDecisionInput + specifications/validate.mjs'},
  brand:{schemas:['schemas/work.schema.yaml:$defs.brandSpec'],validator:'core/index.mjs:validateWorkspace (BRAND_REV)'},
  design:{schemas:['schemas/work.schema.yaml:$defs.uiSpec'],validator:'core/index.mjs:validateWorkspace'},
  asset:{schemas:['schemas/work.schema.yaml:$defs.asset','schemas/work.schema.yaml:$defs.nodeAsset'],validator:'core/index.mjs:validateWorkspace'},
  code:{schemas:[],validator:null,external:'repository-bound product source (layout repository:**), verified by the operations of its lane, never a .starciwork file'},
  grammar:{schemas:['schemas/knowledge-source.schema.yaml','schemas/knowledge-rule.schema.yaml'],validator:'legacy/builders/compile-knowledge.mjs (knowledge/grammars/**)',external:'grammar:** package files are product-bound; only the authored knowledge side is tree-checked'},
  evidence:{schemas:['schemas/work.schema.yaml:$defs.evidence'],validator:'core/index.mjs:validateWorkspace'},
  runtime:{schemas:['schemas/work.schema.yaml:$defs.node'],validator:'core/index.mjs:validateWorkspace',embedded:'declared, never written as a file: carried inside the operations node record (records.yaml)'},
  integration:{schemas:['schemas/work.schema.yaml:$defs.integrationDeclaration'],validator:'core/index.mjs:validateWorkspace + integration.verify op'}
};

test('every .starciwork record class maps to a schema and a runnable validator',async t=>{
  const {validateWorkspace}=await import('../core/index.mjs');
  const {validateSpecification}=await import('../specifications/validate.mjs');
  assert.equal(typeof validateWorkspace,'function','the Work tree validator is importable');
  const probe=validateSpecification({});
  assert.equal(probe.ok,false,'the specification validator runs and rejects a malformed spec');
  const rows=[],flagged=[];
  for(const [kind,entry] of Object.entries(records.records)){
    const cover=RECORD_CLASS_COVERAGE[kind];
    if(!cover){rows.push(`${kind}\tUNCOVERED\tno mapping declared in the spec`);flagged.push(`${kind}: no schema/validator mapping declared`);continue;}
    const missingSchema=(cover.schemas??[]).filter(ref=>{
      const [file,def]=ref.split(':');
      if(!schemaFile(file.split(' ')[0]))return true;
      if(def&&!hasDef(def.replace(/^\$defs\./,'')))return true;
      return false;
    });
    const status=cover.external?'external':cover.embedded?'embedded':missingSchema.length?'flagged':'covered';
    const detail=cover.external??cover.embedded??`${(cover.schemas??[]).join(', ')} | ${cover.validator}`;
    rows.push(`${kind}\t${status}\t${detail}`);
    if(status==='flagged')flagged.push(`${kind}: missing ${missingSchema.join(', ')}`);
    if(status!=='external'&&status!=='embedded'&&!cover.validator)flagged.push(`${kind}: schema without a runnable validator`);
  }
  for(const row of rows)t.diagnostic(row);
  assert.deepEqual(flagged,[],'every record class needs a schema and a runnable validator, or an explicit external/embedded marker');
});

// ---------------------------------------------------------------- C. .stacks env/service files

const STACK_SERVICE=/\.(ya?ml|env|enc|json|toml|conf|conf\.template)$/i;
const stackDirs=[];
const findStacks=dir=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const at=path.join(dir,entry.name);
    if(entry.name==='.stacks'&&entry.isDirectory()){stackDirs.push(at);continue;}
    if(entry.isDirectory()&&!['.git','node_modules','.dist','_local','worktrees'].includes(entry.name))findStacks(at);
  }
};
findStacks(root);

test('every .stacks env/service file is manifest-referenced or an accounted artifact',async t=>{
  const {checkApplicationStacks}=await import('../scripts/checks/stacks.mjs');
  assert.equal(typeof checkApplicationStacks,'function','scripts/checks/stacks.mjs must export checkApplicationStacks');
  const uncoveredFiles=[],referencedAbsent=[],rows=[];
  for(const dir of stackDirs){
    const manifestFile=path.join(dir,'application-stacks.yaml');
    const manifest=fs.existsSync(manifestFile)?parseYaml(fs.readFileSync(manifestFile,'utf8')):null;
    const refs=new Set();
    const walk=value=>{
      if(typeof value==='string'){if(/^\.stacks\//.test(value))refs.add(value.slice('.stacks/'.length));}
      else if(Array.isArray(value))value.forEach(walk);
      else if(value&&typeof value==='object')Object.values(value).forEach(walk);};
    walk(manifest);
    const files=[];
    const scan=at=>{for(const entry of fs.readdirSync(at,{withFileTypes:true})){const item=path.join(at,entry.name);entry.isDirectory()?scan(item):files.push(item);}};
    scan(dir);
    for(const file of files){
      const relative=path.relative(dir,file).split(path.sep).join('/');
      let coverage;
      if(relative==='application-stacks.yaml')coverage='manifest';
      else if(refs.has(relative))coverage='referenced';
      else if(!STACK_SERVICE.test(relative))coverage='artifact';
      else{coverage='uncovered';uncoveredFiles.push(`${path.relative(root,dir)}/${relative}`);}
      rows.push(`${path.relative(root,dir)}/${relative}\t${coverage}`);
    }
    for(const ref of refs)if(!fs.existsSync(path.join(dir,ref)))referencedAbsent.push(`${path.relative(root,dir)}/${ref}`);
    // Runnable proof: the checker loads and reports on this repository without throwing.
    const result=checkApplicationStacks({repoRoot:path.dirname(dir),environment:'dev'});
    assert.equal(result.schema,'starci/application-stacks-check@1');
  }
  for(const row of rows)t.diagnostic(row);
  for(const ref of referencedAbsent)t.diagnostic(`referenced-but-absent\t${ref}`);
  assert.deepEqual(uncoveredFiles,[],'every env/service file under .stacks/ must be referenced by the manifest (scripts/checks/stacks.mjs bounds-checks it) or be a non-service artifact');
});

// ----------------------------------------------------- D. run-state layout (.starciwork/runtime.sqlite ledger)

const posix=value=>String(value??'').split(path.sep).join('/');

/**
 * The .claude-owned runtime record. Run state is rows in `.starciwork/runtime.sqlite`, never files
 * under `_local/` - that tree is retired kernel authority. Every artifact class a workflow persists
 * declares its schema (a const, a rendered template or an internal format), the writer/validator that
 * owns it, and the module token proving the writer is still live. `outside` marks the one artifact
 * that legitimately stays a file: the public continuation projection at `workflows/<id>.md`. Retired
 * `_local` filenames survive only as housekeeping declarations in candidate-bridge.
 */
const RUN_STATE_ARTIFACTS=[
  {file:'state_snapshots rows',schema:'starci/workflow-state@1',validator:'store.saveState schema pin + loadState',source:['kernel/store.mjs','WORKFLOW_STATE']},
  {file:'events rows',schema:'append-only seq-numbered ledger rows',validator:'store.appendEvent assigns seq; readEvents replays',source:['kernel/store.mjs','appendEvent']},
  {file:'goals row',schema:'starci/workflow-goal@1',validator:'kernel/goal.mjs goal writers over store.setGoal',source:['kernel/goal.mjs','goalJson']},
  {file:'reports rows',schema:'starci/op-report@1 | starci/workflow-report@1',validator:'kernel/reports.mjs validateReport + store.writeReport/readReports',source:['kernel/reports.mjs','OP_REPORT']},
  {file:'reports/wait-state.json',schema:'internal wait-state record',validator:'housekeeping-declared runtime file',source:['kernel/candidate-bridge.mjs','wait-state.json']},
  {file:'contracts rows',schema:'rendered contract markdown',validator:'store.writeContract/readContract',source:['kernel/store.mjs','writeContract']},
  {file:'checks rows',schema:'worker check-result list',validator:'store.writeChecks/readChecks',source:['kernel/store.mjs','writeChecks']},
  {file:'kernel check result',schema:'starci/workflow-kernel-checks@1',validator:'kernel kernel-check writer',source:['kernel/kernel.mjs','workflow-kernel-checks@1']},
  {file:'audit measurement',schema:'starci/audit-measurement@1',validator:'kernel audit writer',source:['kernel/kernel.mjs','audit-measurement@1']},
  {file:'checks/<op>.credential-request.json',schema:'credential-request record',validator:'housekeeping-declared runtime file',source:['kernel/candidate-bridge.mjs','credential-request.json']},
  {file:'inbox rows',schema:'starci/job@1 owner-action or kernel command',validator:'kernel queueInbox/applyInbox over store.inbox',source:['kernel/kernel.mjs','queueInbox']},
  {file:'final report signal',schema:'starci/workflow-final-report@1',validator:'kernel finish writer; paths.final is a ledger URI',source:['kernel/common.mjs','FINAL_REPORT']},
  {file:'launch signal',schema:'launch hand-off record',validator:'kernel awaitLaunch reads the launch signal or a named file',source:['kernel/kernel.mjs','awaitLaunch']},
  {file:'kernel.lock + stop.flag',schema:'control files',validator:'kernel lock/stop protocol',source:['kernel/candidate-bridge.mjs','kernel.lock']},
  {file:'supervisor.lock/.log + runtime-loads.json + runtime-budget.json',schema:'shared supervisor ledgers',validator:'housekeeping-declared runtime files',source:['kernel/candidate-bridge.mjs','runtime-budget.json']},
  {file:'workflows/<id>.md (repository root)',schema:'managed continuation section',validator:'store.continuation + acknowledgeRuntimeFile',source:['kernel/store.mjs','continuation'],outside:true},
];

test('every workflow run-state artifact binds a schema and a live writer/validator in the ledger store',async t=>{
  const {createStore,WORKFLOW_STATE,RUNTIME_FILE_WRITE}=await import('../kernel/store.mjs');
  const {FINAL_REPORT,GOAL_RECORD}=await import('../kernel/common.mjs');
  const {OP_REPORT,WORKFLOW_REPORT,validateReport}=await import('../kernel/reports.mjs');
  const {queueInbox}=await import('../kernel/kernel.mjs');
  for(const [name,value] of Object.entries({WORKFLOW_STATE,GOAL_RECORD,FINAL_REPORT,OP_REPORT,WORKFLOW_REPORT,RUNTIME_FILE_WRITE}))
    assert.match(value,/^starci\//,`${name} must be a live schema const`);

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-runstate-'));
  t.after(()=>{try{fs.rmSync(dir,{recursive:true,force:true});}catch{}});
  const store=createStore({repoRoot:dir,id:'wf-coverage'});
  // No `_local` directory is created: the workflow record lives in `.starciwork/runtime.sqlite`.
  assert.equal(store.dir,null);
  assert.equal(posix(store.ledgerFile),posix(path.join(dir,'.starciwork','runtime.sqlite')));
  assert.equal(fs.existsSync(path.join(dir,'.starciwork','_local')),false);
  // `paths.*` is retired except the continuation projection (the one file that stays on disk, in the
  // repo not `_local`) and the final-report ledger URI; every other key fails loudly with its name.
  assert.equal(posix(store.paths.continuation),posix(path.join(dir,'workflows','wf-coverage.md')));
  assert.equal(store.paths.final,`ledger://final-report/wf-coverage`);
  for(const key of ['state','events','reports','contracts','checks','inbox','launch','goal'])
    assert.throws(()=>store.paths[key],/store-paths-removed/,key);
  for(const method of ['reportPath','contractPath','checksPath'])
    assert.throws(()=>store[method]('x'),/store-paths-removed/,method);

  // Writers validate. A state carrying any other schema is refused before it lands.
  assert.throws(()=>store.saveState({schema:'starci/bogus@1',id:'wf-coverage'}),new RegExp(WORKFLOW_STATE));
  store.saveState({schema:WORKFLOW_STATE,id:'wf-coverage',approved:false,finished:false});
  assert.equal(store.loadState().schema,WORKFLOW_STATE);
  // The event log is append-only and seq-ordered.
  store.appendEvent({event:'coverage-a'});store.appendEvent({event:'coverage-b'});
  const events=store.readEvents();
  assert.ok(events.length>=2&&events.at(-1).seq===events.at(-2).seq+1,'events must round-trip in seq order');
  // Inbox commands are ledger rows the kernel applies, never files.
  const queued=queueInbox(store,{kind:'approve'});
  assert.equal(store.inbox.pending().length,1);
  assert.ok(store.inbox.settle(queued.id,'applied'));
  assert.equal(store.inbox.pending().length,0);
  // Reports are schema-checked and round-trip through the ledger, not files.
  assert.ok(validateReport({schema:'starci/bogus@1',outcome:'done'}).errors.some(error=>error.includes('Unsupported report schema')));
  store.writeReport({dispatchId:'d1',report:{schema:OP_REPORT,outcome:'done',summary:'x',files:[],checks:[],open:[]}});
  assert.deepEqual(store.readReports().map(report=>report.schema),[OP_REPORT]);
  // Contracts and checks address their own ledger rows.
  store.writeContract({opId:'op1',markdown:'# contract'});
  assert.equal(store.readContract('op1').markdown,'# contract');
  store.writeChecks({opId:'op1',checks:[{name:'coverage-check'}]});
  assert.deepEqual(store.readChecks('op1'),[{name:'coverage-check'}]);

  const missing=[];
  for(const row of RUN_STATE_ARTIFACTS){
    const live=read(row.source[0]).includes(row.source[1]);
    t.diagnostic(`${row.file}\t${row.schema}\t${row.validator}\twriter ${row.source[0]}:${row.source[1]} ${live?'present':'GONE'}`);
    if(!row.schema||!row.validator||!live)missing.push(row.file);
  }
  assert.deepEqual(missing,[],'every run-state artifact class needs a schema, a validator and a live writer');
});

test('undeclared writes under _local quarantine the candidate; declared run-state files are housekeeping',async t=>{
  const {beginDetectionCandidate,freezeDetectionCandidate}=await import('../kernel/candidate-bridge.mjs');
  const git=(command,args,options)=>spawnSync(command,args,options);
  const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);};
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-boundary-'));
  t.after(()=>{try{fs.rmSync(repo,{recursive:true,force:true});}catch{}});
  run(repo,'init','--quiet','-b','main');run(repo,'config','user.email','coverage@starci.local');run(repo,'config','user.name','Coverage');run(repo,'config','commit.gpgsign','false');
  fs.mkdirSync(path.join(repo,'src'));fs.writeFileSync(path.join(repo,'src','app.js'),'one\n');
  run(repo,'add','-A');run(repo,'commit','--quiet','-m','base');
  const parent=path.dirname(repo),identity={workflowId:'wfc',opId:'opx',attempt:1,generation:1,jobId:'job'};
  const bridge=beginDetectionCandidate({identity,repoRoot:repo,workerRoot:path.join(parent,'wfc-candidate'),controlRoot:path.join(parent,'wfc-control'),
    allowlist:['src/**'],references:[],git,environmentDigest:'env'});
  t.after(()=>{try{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});}catch{}});
  const local=path.join(repo,'.starciwork','_local','workflows','wfc');
  fs.mkdirSync(path.join(local,'checks'),{recursive:true});
  fs.writeFileSync(path.join(local,'state.json'),'{}\n');
  fs.writeFileSync(path.join(local,'events.jsonl'),'');
  fs.writeFileSync(path.join(local,'checks','opx.json'),'[]\n');
  fs.writeFileSync(path.join(local,'rogue.json'),'{}\n');
  const frozen=freezeDetectionCandidate(bridge,{git,housekeeping:{workflowId:'wfc',opId:'opx'}});
  assert.equal(frozen.status,'quarantine','an undeclared _local write must quarantine the candidate');
  // Any `.starciwork` write outside the op's allowlist touches the workflow record's custody boundary:
  // it is `custody-path-touched`, never ordinary outside-allowlist scope drift.
  assert.ok(frozen.reasons.includes('custody-path-touched:.starciwork/_local/workflows/wfc/rogue.json'),frozen.reasons.join('\n'));
  for(const declared of ['state.json','events.jsonl','checks/opx.json']){
    assert.ok(frozen.housekeepingObserved.includes(`.starciwork/_local/workflows/wfc/${declared}`),`${declared} is declared run state - housekeeping, not a candidate change`);
    assert.equal(frozen.observedFiles.includes(`.starciwork/_local/workflows/wfc/${declared}`),false);
  }
});

// ---------------------------------------------------------------- E. feature record layout (features/<feature>/ record trees)

const NODE=(kind,meta='')=>`schema: work/node@2\nid: demo.coverage.${kind}\nkind: ${kind}\nrequired: true\n${meta}`;

/**
 * Every feature record class (modules/models/records.yaml) binds a schema def and the runnable
 * validator at its declared path. `cases` are executable: a record written outside the
 * declared layout must make core/index.mjs emit the named issue code. Classes with no
 * file path of their own carry external/embedded/custody with the reason.
 */
const FEATURE_LAYOUT_COVERAGE={
  record:{def:'node',declared:'features/<f>/**/index.yaml (work/node@2 canonical)',cases:[
    {name:'non-index node filename',file:'features/sales/implementation/frontend/rogue/node.yaml',at:'features/sales/implementation/frontend/rogue/node.yaml',node:NODE('implementation'),code:'CANONICAL_FORMAT'},
    {name:'implementation outside the frontend/backend lanes',file:'features/sales/implementation/receipt/index.yaml',at:'features/sales/implementation/receipt/index.yaml',node:NODE('implementation','implementation: {}\n'),code:'IMPLEMENTATION_LAYOUT'},
    {name:'undeclared underscore directory',dir:'_scratch',at:'_scratch',code:'RESERVED_DIRECTORY'}]},
  srs:{def:'businessSpec',declared:'features/<f>/business/srs/** beside business/index.yaml + business/overview/index.yaml',cases:[
    {name:'srs leaf without its required companions',file:'features/sales/business/srs/rules/index.yaml',at:'features/sales/business/srs/rules/index.yaml',node:NODE('business'),code:'SRS_LAYOUT'},
    {name:'business spec on a non-business node',file:'features/sales/business/index.yaml',at:'features/sales/business/index.yaml',node:NODE('implementation','business: {}\n'),code:'MODULE_SPEC_OWNER'}]},
  sds:{def:'architectureSpec',declared:'features/<f>/architecture/sds/** beside architecture/index.yaml + overview',cases:[
    {name:'sds leaf without its required companions',file:'features/sales/architecture/sds/api/index.yaml',at:'features/sales/architecture/sds/api/index.yaml',node:NODE('architecture'),code:'SDS_LAYOUT'}]},
  decision:{declared:'embedded inside SRS sections (starci/srs-policy-decision@1)',embedded:'no path of its own; rides in SRS records'},
  brand:{def:'brandSpec',declared:'brand/index.yaml at the tree root (product singleton)',cases:[
    {name:'brand inside a feature tree',file:'features/sales/brand/index.yaml',at:'features/sales/brand/index.yaml',node:NODE('brand','brand: {}\n'),code:'LAYOUT'}]},
  design:{def:'uiSpec',declared:'features/<f>/ui/**/index.yaml',cases:[
    {name:'ui spec outside ui/',file:'features/sales/screens/index.yaml',at:'features/sales/screens/index.yaml',node:NODE('ui','ui: {}\n'),code:'UI_LAYOUT'}]},
  asset:{def:'nodeAsset',declared:'<node>/assets/** node-owned custody',custody:'files bound through node assets:; index.yaml under assets/ is not a record and is ignored by design'},
  code:{declared:'repository-bound product source',external:'never a .starciwork file'},
  grammar:{declared:'grammar:** package files',external:'product-bound; the authored knowledge side is tree-checked'},
  evidence:{def:'evidence',declared:'<node>/evidence/** node-owned custody',cases:[
    {name:'node planted inside evidence custody',file:'features/sales/evidence/index.yaml',at:'features/sales/evidence/index.yaml',node:NODE('implementation'),code:'LAYOUT'}]},
  runtime:{declared:'embedded in the operations node record',embedded:'declared, never written as a file'},
  integration:{def:'integrationDeclaration',declared:'embedded in extensions.work3.integrations',embedded:'validated inside the parent node'},
};

// Layout bounds that belong to the tree rather than to one records.yaml class.
const TREE_LAYOUT_CASES=[
  {name:'business-overview outside business/overview/',file:'features/sales/business/detail/index.yaml',at:'features/sales/business/detail/index.yaml',node:NODE('business-overview','businessOverview: {}\n'),code:'MODULE_SPEC_OWNER'},
  {name:'uat accounts.yaml without an owning uat node',file:'features/sales/uat/accounts.yaml',at:'features/sales/uat/accounts.yaml',raw:'schema: work/disposable-accounts@1\ndisposable: true\naccounts: []\n',code:'ACCOUNTS_OWNER'},
  {name:'node planted inside _resources custody',file:'_resources/hidden/index.yaml',at:'_resources/hidden/index.yaml',node:NODE('implementation'),code:'LAYOUT'},
];
// Places the Work validator deliberately does not police; the reason is kept visible.
const EXCLUDED_CASES=[
  {name:'node planted inside _local run state',file:'_local/workflows/wf/x/index.yaml',node:NODE('implementation'),
    why:'_local is kernel-owned: Work validation excludes it; op writes there are refused by the candidate freeze above'},
  {name:'non-record file at the tree root',file:'notes.yaml',raw:'kind: note\n',
    why:'non-index.yaml files are not node records; the validator ignores them rather than failing'},
];
const LAYOUT_ISSUE_CODES=new Set(['LAYOUT','RESERVED_DIRECTORY','SRS_LAYOUT','SDS_LAYOUT','IMPLEMENTATION_LAYOUT','UI_LAYOUT','ACCOUNTS_OWNER','MODULE_SPEC_OWNER','CANONICAL_FORMAT','BRAND_SINGLETON','BRAND_SCHEMA','BRAND_SPEC']);

test('every feature record class binds a schema def, a validator and a declared layout path; outside fails with a named code',async t=>{
  const {validateWorkspace}=await import('../core/index.mjs');
  const coreSource=read('core/index.mjs');
  const rows=[],flagged=[];
  const runCase=c=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-layout-'));
    try{
      fs.writeFileSync(path.join(dir,'workspace.yaml'),'schema: work/workspace@1\nid: demo\n');
      const anchor=path.join(dir,'features/sales/implementation/frontend/receipt');
      fs.mkdirSync(anchor,{recursive:true});
      fs.writeFileSync(path.join(anchor,'index.yaml'),NODE('implementation'));
      if(c.dir)fs.mkdirSync(path.join(dir,c.dir),{recursive:true});
      if(c.file){const at=path.join(dir,c.file);fs.mkdirSync(path.dirname(at),{recursive:true});fs.writeFileSync(at,c.node??c.raw);}
      return validateWorkspace(dir).errors;
    }finally{try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}
  };
  // Positive control: the declared placement produces no layout issue at all.
  const clean=runCase({}).filter(error=>LAYOUT_ISSUE_CODES.has(error.code));
  assert.deepEqual(clean,[],'a correctly-placed node must be layout-clean');

  for(const kind of Object.keys(records.records)){
    const entry=FEATURE_LAYOUT_COVERAGE[kind];
    if(!entry){rows.push(`${kind}\tUNDECLARED\tno layout mapping in this spec`);flagged.push(`${kind}: no declared layout`);continue;}
    const status=entry.external?'external':entry.embedded?'embedded':entry.custody?'custody':'bound';
    rows.push(`${kind}\t${status}\t${entry.external??entry.embedded??entry.custody??`${entry.declared} -> $defs.${entry.def}`}`);
    if(status==='custody'&&!entry.def)flagged.push(`${kind}: custody class without a schema def`);
    if(status!=='bound')continue;
    if(!hasDef(entry.def))flagged.push(`${kind}: schema def ${entry.def} missing from work.schema.yaml`);
    for(const c of entry.cases??[]){
      if(!coreSource.includes(c.code))flagged.push(`${kind}: the validator never names ${c.code}`);
      const errors=runCase(c),hit=errors.some(error=>error.code===c.code&&error.path===c.at);
      rows.push(`  outside ${c.at}\t${hit?c.code:`MISSED (${errors.map(error=>error.code).join(',')||'none'})`}`);
      if(!hit)flagged.push(`${kind}: ${c.code} did not fire for ${c.file??c.dir}`);
    }
  }
  for(const c of TREE_LAYOUT_CASES){
    const errors=runCase(c),hit=errors.some(error=>error.code===c.code&&error.path===c.at);
    rows.push(`tree\t${c.name}\t${hit?c.code:`MISSED (${errors.map(error=>error.code).join(',')||'none'})`}`);
    if(!hit)flagged.push(`${c.name}: ${c.code} did not fire for ${c.file??c.dir}`);
  }
  for(const c of EXCLUDED_CASES){
    const errors=runCase(c),leaked=errors.filter(error=>error.path===c.file||error.path===c.at);
    rows.push(`excluded\t${c.name}\t${leaked.length?'LEAKED':'ignored'}\t${c.why}`);
    if(leaked.length)flagged.push(`${c.name}: ${c.file} produced ${leaked.map(error=>error.code).join(',')} - it must stay outside Work validation`);
  }
  for(const row of rows)t.diagnostic(row);
  assert.deepEqual(flagged,[],'every feature record class needs a schema def, a validator and layout enforcement; writes outside must fail');
});
