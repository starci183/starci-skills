import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../core/yaml.mjs';

// Operator validation must run while bootstrapping a source package before .dist exists.
// Keep these authoring identities explicit here and regression-check them against the
// published specification contracts; importing runtime readers would create a build cycle.
const AUTHORING_POLICIES=Object.freeze({
  'business.decide':Object.freeze({
    contractSchema:'starci/srs-sections@1',payloadField:'extensions.work3.srs',aggregateSchema:'starci/srs-aggregate@1',
    sections:Object.freeze(['functional-requirements','non-functional-requirements','business-rules','policy-decisions','data','customer-journeys']),
    sectionSchemas:Object.freeze(['starci/srs-functional-requirement@1','starci/srs-non-functional-requirement@1','starci/srs-business-rule@1','starci/srs-policy-decision@1','starci/srs-data-definition@1','starci/srs-customer-journey@1']),
    compatibilitySchemas:Object.freeze(['starci/specification@2','starci/srs@3'])
  }),
  'architecture.decide':Object.freeze({
    contractSchema:'starci/sds-map@1',payloadField:'extensions.work3.sds',aggregateSchema:'starci/sds-aggregate@1',
    sections:Object.freeze(['flows','code-map','contracts','data','quality','deployment','decisions','verification']),
    sectionSchemas:Object.freeze(['starci/sds-overview@1','starci/sds-flow@1','starci/sds-code-unit@1','starci/sds-contract@1','starci/sds-data-model@1','starci/sds-quality@1','starci/sds-deployment@1','starci/sds-decision@1','starci/sds-verification@1']),
    compatibilitySchemas:Object.freeze(['starci/specification@3','starci/sds@4'])
  })
});

const nonempty = value=>typeof value==='string'&&value.trim().length>0;
const safeRelative = value=>nonempty(value)&&!path.posix.isAbsolute(value)&&!path.win32.isAbsolute(value)&&!value.split(/[\\/]/).some(p=>p==='..'||p==='.')&&!value.includes('\\');
const unique = values=>new Set(values).size===values.length;
const pair = value=>value&&nonempty(value.en)&&!Object.hasOwn(value,'vi');
const issue = (errors,code,subject,message)=>errors.push({code,subject,message});

/** Public knowledge refs stay knowledge/*.json; authored YAML or .dist JSON may satisfy them. */
export function domainReferenceExists(repositoryRoot, refPath) {
  if (!repositoryRoot || !safeRelative(refPath)) return false;
  const direct = path.resolve(repositoryRoot, refPath);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return true;
  const dist = path.resolve(repositoryRoot, '.dist', refPath);
  if (fs.existsSync(dist) && fs.statSync(dist).isFile()) return true;
  if (refPath.startsWith('knowledge/') && refPath.endsWith('.json')) {
    const base = refPath.slice('knowledge/'.length, -'.json'.length);
    const yamlName = /(?:^|\/)INDEX$/i.test(base)
      ? `${base.replace(/INDEX$/i, 'index')}.yaml`
      : `${base}.yaml`;
    const yaml = path.resolve(repositoryRoot, 'knowledge', yamlName);
    if (fs.existsSync(yaml) && fs.statSync(yaml).isFile()) return true;
  }
  return false;
}

// Validates authoring/catalogue referential integrity, NOT real-world execution or truth.
// Never executes an op, resolves a credential, fetches a URL or mutates a workspace.
export function validateCatalog(catalog,{root,repositoryRoot,profiles,documents=new Map()}={}) {
  const errors=[];
  if(!catalog||catalog.schema!=='work/ops@1'||!Array.isArray(catalog.ops)) return {ok:false,errors:[{code:'CATALOG_SCHEMA',subject:'catalog',message:'Expected work/ops@1 and ops array'}]};
  if(Object.keys(catalog).some(key=>!['schema','commonDocument','ops'].includes(key))) issue(errors,'CATALOG_FIELDS','catalog','Unknown catalogue root field');
  if(!catalog.ops.length) issue(errors,'CATALOG_EMPTY','catalog','At least one concrete operator is required');
  function fileRef(ref,subject,english=true) {
    if(!safeRelative(ref)||(english&&ref.endsWith('.vi.md'))) {issue(errors,'DOCUMENT_PATH',subject,'Unsafe/non-authority document path');return;}
    if(documents.has(ref)){if(!String(documents.get(ref)).trim())issue(errors,'DOCUMENT_EMPTY',subject,'Document is empty');return;}
    if(root) {
      const full=path.resolve(root,ref), relative=path.relative(root,full);
      if(relative.startsWith('..')||!fs.existsSync(full)||!fs.statSync(full).isFile()||fs.lstatSync(full).isSymbolicLink()) issue(errors,'DOCUMENT_MISSING',subject,'Document must be a regular file inside ops root');
      else if(!fs.readFileSync(full,'utf8').trim()) issue(errors,'DOCUMENT_EMPTY',subject,'Document is empty');
    }
  }
  fileRef(catalog.commonDocument,'common');
  if(!unique(catalog.ops.map(o=>o.id))) issue(errors,'DUPLICATE_OP','catalog','Operator IDs must be unique');
  if(!unique(catalog.ops.map(o=>o.document))) issue(errors,'DUPLICATE_DOCUMENT','catalog','Each op must own its document');
  for(const op of catalog.ops) {
    const at=op.id;
    if(!/^[a-z]+(?:\.[a-z]+)+$/.test(at??'')) issue(errors,'OP_ID',at,'Invalid operator ID');
    fileRef(op.document,at); if(Object.hasOwn(op,'mirror')) issue(errors,'RETIRED_MIRROR',at,'Operator contracts are English only');
    fileRef(op.authority,at);
    if (root && typeof op.authority === 'string' && safeRelative(op.authority) && (documents.has(op.authority)||fs.existsSync(path.join(root,op.authority)))) {
      try {
        const roles=JSON.parse(documents.has(op.authority)?documents.get(op.authority):fs.readFileSync(path.join(root,op.authority),'utf8'));
        if(roles.schema!=='starci/op-authority@1'||roles.op!==at||roles.primary?.maxSecondary!==3||roles.primary?.canAdvanceWorkflow!==false||!Array.isArray(roles.primary?.calls)||roles.primary.calls.length>3) issue(errors,'ROLE_AUTHORITY',at,'Primary role has at most three secondary jobs and cannot advance the workflow itself');
        if(Object.hasOwn(roles,'secondary')) issue(errors,'ROLE_AUTHORITY',at,'Secondary policy belongs to the caller, not the callee');
        for(const call of roles.primary.calls ?? []) {
          if(call.authority !== 'secondary.json') { issue(errors,'ROLE_AUTHORITY',at,'Caller must own secondary.json'); continue; }
          const yamlPath=path.join(root,at,'secondary.yaml');
          const jsonPath=path.join(root,at,call.authority);
          const source=fs.existsSync(yamlPath)?yamlPath:jsonPath;
          const text=fs.readFileSync(source,'utf8');
          const config=source.endsWith('.yaml')?parseYaml(text):JSON.parse(text);
          const policy=config.calls?.find(c=>c.op===call.op && c.role===call.role);
          if(config.schema!=='starci/op-secondary@1'||config.owner!==at||config.maxDefinitions!==3||!Array.isArray(config.calls)||config.calls.length>3||!unique(config.calls.map(c=>c.op))||config.maxJobs<1||config.maxJobs>3||!policy||policy.canCallOthers!==false||policy.canAdvanceWorkflow!==false||policy.canCompleteParent!==false) issue(errors,'ROLE_AUTHORITY',at,'Invalid caller-owned secondary permissions');
        }
      } catch { issue(errors,'ROLE_AUTHORITY',at,'Invalid role authority JSON'); }
    }
    for(const ref of op.supportingReferences??[]) {
      if(!safeRelative(ref.path)||!nonempty(ref.when)) issue(errors,'DOMAIN_REFERENCE',at,'Reference requires safe repo-relative source and English applicability');
      else if(repositoryRoot&&!domainReferenceExists(repositoryRoot,ref.path)) issue(errors,'DOMAIN_REFERENCE',at,'Referenced domain source does not exist');
    }
    if(!nonempty(op.goal)||!Array.isArray(op.nodeKinds)||!op.nodeKinds.includes(op.completionProfile)) issue(errors,'PROFILE',at,'Goal and compatible profile required');
    if(profiles&&!Object.hasOwn(profiles,op.completionProfile)) issue(errors,'UNKNOWN_PROFILE',at,'Completion profile is not supported by core');
    if(!Array.isArray(op.writeScope)||!op.writeScope.length||!Array.isArray(op.sideEffects)) issue(errors,'WRITE_SCOPE',at,'Write scope/effects declaration required');
    const c=op.contract;
    if(!c||c.id!==at||!pair(c.goal)||!Array.isArray(c.reads)||!Array.isArray(c.writes)||!Array.isArray(c.steps)||!Array.isArray(c.proofs)||!Array.isArray(c.blockers)) {issue(errors,'CONTRACT',at,'Detailed English contract required');continue;}
    if(!c.reads.length||!c.writes.length||!c.steps.length||!c.proofs.length||!c.blockers.length) issue(errors,'EMPTY_CONTRACT',at,'Reads/writes/steps/proofs/blockers cannot be empty');
    if(at==='task.execute'&&(c.adHocPolicy?.context!=='discover-from-request-and-observed-system'||c.adHocPolicy?.workTree!=='required-workflow-bootstrap'||c.adHocPolicy?.authority!=='read-only-request-analysis'||c.adHocPolicy?.successors!==false||c.sideEffects?.length!==0||c.writes.some(w=>w.id!=='evidence')||c.reads.some(r=>['business','architecture','target'].includes(r.id))))issue(errors,'DIRECT_TASK_POLICY',at,'Request analysis is read-only, discovers context and cannot execute a selected workflow');
    if(c.executionModes) {
      if(c.modePolicy?.selection!=='required-exactly-one'||c.modePolicy?.implicitChain!==false||c.modePolicy?.permissionUnion!==false||c.modePolicy?.completion!=='selected-mode-profile'||!Object.keys(c.executionModes).length) issue(errors,'MODE_POLICY',at,'Select one mode without union permissions or implicit chains');
      for(const [mode,selected] of Object.entries(c.executionModes)) {
        if(at==='workspace.manage'&&mode==='import'&&!selected?.migrationPolicy) issue(errors,'MODE_MIGRATION_POLICY',at,'Import must preserve the migration policy');
        if(at==='release.deliver'&&mode==='migrate') {
          const policy=selected?.dataCorrectionPolicy, expected={scope:'exact-authorized-records-or-source-owned-migration',schemaInspection:'required-before-mutation',preMutationReadback:'required',postMutationReadback:'required',recovery:'transaction-or-explicit-reviewed-recovery-plan',arbitraryCode:false,adHocSql:false,unknownOrPartial:'blocked'};
          if(!policy||Object.entries(expected).some(([key,value])=>policy[key]!==value)) issue(errors,'DATA_CORRECTION_POLICY',at,'Data correction requires exact scope, schema and before/after readback with recovery and no arbitrary code');
        }
        if(!/^[a-z]+$/.test(mode)||!selected||selected.id!==at||selected.executionModes) {issue(errors,'MODE_CONTRACT',at,'Invalid or recursive mode');continue;}
        const nested={...op,goal:selected.goal?.en,nodeKinds:selected.nodeKinds,completionProfile:selected.completionProfile,sideEffects:selected.sideEffects,writeScope:selected.writes?.map(w=>w.path),contract:selected};
        const checked=validateCatalog({schema:'work/ops@1',commonDocument:'common.yaml',ops:[nested]},{profiles});
        for(const error of checked.errors) issue(errors,'MODE_'+error.code,at+':'+mode,error.message);
      }
    }
    const graphLocation=at==='architecture.decide'?'Canonical .starciwork SRS/SDS owners and collocated assets':at==='business.decide'?'.starciwork node dependsOn/refs and collocated assets':'.starciwork node dependsOn/refs with direct sourceRefs and collocated assets';
    if(!c.graphPolicy||!['read-only','selected-scope-only'].includes(c.graphPolicy.mode)||c.graphPolicy.prerequisiteState!=='done'||c.graphPolicy.dispatch!=='never'||c.graphPolicy.location!==graphLocation) issue(errors,'GRAPH_POLICY',at,'Graph authority must live in .starciwork, require done prerequisites and never dispatch automatically');
    if(c.graphPolicy?.mode==='read-only'&&c.writes.some(w=>w.id==='node'&&w.fields?.some(f=>['dependsOn','refs','required'].includes(f)))) issue(errors,'CONSUMER_GRAPH_WRITE',at,'A consumer op cannot silently rewrite scope/input graph fields');
    if(c.migrationPolicy) {
      const expected={scope:'one-selected-business',importState:'uninvestigate',initialActivity:'idle',importCompletion:'forbidden',intentAuthority:'approved-intent-not-inferred-source',cleanup:'explicit-exact-preserved-inactive-only',registeredWorktreeRemoval:'git-without-force'};
      if(!c.migrationPolicy||Object.entries(expected).some(([key,value])=>c.migrationPolicy[key]!==value)||c.graphPolicy?.mode!=='selected-scope-only') issue(errors,'MIGRATION_POLICY',at,'Migration imports one unapproved uninvestigate scope and permits only exact preserved inactive authorized cleanup');
      if(!c.reads.some(r=>r.id==='inventory')||!c.reads.some(r=>r.id==='custody')||!c.writes.some(w=>w.id==='node'&&w.fields?.includes('activity')&&w.fields?.includes('blockers'))||!c.writes.some(w=>w.id==='resources'&&w.fields?.includes('files:[{path}]'))||!['source','preservation','investigation-state','cleanup'].every(id=>c.proofs.some(p=>p.id===id))) issue(errors,'MIGRATION_BINDING',at,'Migration requires actual inventory/custody, uninvestigate source scope and independent preservation/import/cleanup proofs');
    }
    if(['business.decide','architecture.decide'].includes(at)) {
      const architecture=at==='architecture.decide';
      const expected=AUTHORING_POLICIES[at],payloadField=expected.payloadField;
      const nodeWrite=c.writes.find(w=>w.id==='node'),policy=c.specificationPolicy;
      if(policy?.storage!=='.starciwork'||!policy?.payload?.includes(architecture?'architecture':'business')||!policy?.payload?.includes(payloadField)||!nodeWrite?.fields.includes(payloadField)||nodeWrite?.fields.includes('extensions.work3.specification')||nodeWrite?.fields.includes('sourceRefs')||policy?.payloadSchema!==expected.contractSchema||policy?.payloadField!==payloadField||policy?.aggregateSchema!==expected.aggregateSchema||JSON.stringify(policy?.requiredSections)!==JSON.stringify(expected.sections)||JSON.stringify(policy?.sectionSchemas)!==JSON.stringify(expected.sectionSchemas)||JSON.stringify(policy?.compatibilitySchemas)!==JSON.stringify(expected.compatibilitySchemas)||!c.proofs.some(p=>p.id==='impact-security-coverage')) issue(errors,'SPECIFICATION_POLICY',at,'Business must author split SRS section@1 payloads and Architecture must author split SDS code-map section@1 payloads; specification@2/@3 and srs@3/sds@4 are compatibility readers only');
    }
    if(at==='interface.draw'&&(!['repo','architecture','knowledge'].every(id=>c.reads.some(r=>r.id===id))||!c.writes.some(w=>w.id==='draws'))) issue(errors,'DRAW_HANDOFF',at,'Draw must read source/architecture/knowledge and always return draws');
    if(at==='architecture.decide'&&(c.specificationPolicy?.analysisPolicy!=='context-driven'||c.reads.some(r=>r.id==='source')||c.writes.some(w=>w.id==='source'||w.fields?.includes('sourceRefs')||/repository:<repo-id>/.test(w.path??'')))) issue(errors,'ARCHITECTURE_DEPTH',at,'Architecture requires a context-driven target code map without source observations, revisions or product-code effects');
    if(['interface.implement','backend.implement'].includes(at)) {
      const checks=at==='backend.implement'?['lint','typecheck','unit','backend-e2e','coverage','build','sonar']:['lint','typecheck','tests','coverage','build','sonar'];
      if(c.qualityPolicy?.owner!==at||JSON.stringify(c.qualityPolicy?.checks)!==JSON.stringify(checks)||c.qualityPolicy?.missingRunner!=='blocked'||c.qualityPolicy?.canDelegateResponsibility!==false||!c.proofs.some(p=>p.id==='implementation-quality')) issue(errors,'IMPLEMENT_QUALITY',at,'Implement owns all quality checks and blocks missing proof');
      if(at==='backend.implement'&&(c.qualityPolicy?.unitGate!=='scoped-unit-pass-for-tested-revision'||c.qualityPolicy?.backendE2EGate!=='scoped-backend-e2e-pass-for-tested-revision'||c.qualityPolicy?.handoffBinding!=='api-contract-runtime-quality-evidence-and-tested-commit')) issue(errors,'BACKEND_HANDOFF_QUALITY',at,'Backend handoff requires distinct unit/E2E gates and tested contract/runtime/commit binding');
      if(c.commitPolicy?.mode!=='scoped-local-commit'||c.commitPolicy?.push!==false) issue(errors,'IMPLEMENT_COMMIT',at,'Implement must return scoped real commits without push');
      if(at==='interface.implement'&&(c.deliveryPolicy?.flows!=='always-required'||!c.writes.some(w=>w.id==='flows'))) issue(errors,'FE_HANDOFF',at,'FE must always output UAT flows');
      if(at==='interface.implement'&&(c.assetPolicy?.strategy!=='reuse-then-create'||c.assetPolicy?.functionalAssetDeferral!==false||c.assetPolicy?.claudeFallback!=='blank-reserved-slot-with-brief'||!c.reads.some(r=>r.id==='assetSources')||!c.writes.some(w=>w.id==='assetManifest')||!c.proofs.some(p=>p.id==='asset-coverage'))) issue(errors,'FE_ASSETS',at,'FE owns complete asset inventory, reuse/create and explicit nonfunctional deferrals');
    }
    if(at==='uat.verify') {
      const expected={flowOrder:'request-sequential',uxAnswers:'yes-no-observed-only',appearanceScoring:false,accountSetup:'reuse-or-create-scoped',seed:'prerequisites-only',recording:'screenshots-and-real-video',cleanup:'finally-owned-and-verified',paidAI:'reuse-explicit-flow-authorization'};
      if(!c.uatPolicy||Object.entries(expected).some(([key,value])=>c.uatPolicy[key]!==value)||JSON.stringify(c.uatPolicy.scripts)!==JSON.stringify(['seed','delete','resource-management'])) issue(errors,'UAT_POLICY',at,'UAT must preserve sequential UX-only execution, real recordings and owned verified cleanup');
      if(!['flows','accounts','fixtures','scripts','effects'].every(id=>c.reads.some(r=>r.id===id))||!['source','resources','evidence'].every(id=>c.writes.some(w=>w.id===id))||!['sequence','journey','ux','recording','scripts','cleanup'].every(id=>c.proofs.some(p=>p.id===id))) issue(errors,'UAT_BINDING',at,'UAT requires setup/script/effect inputs and sequence, UX, recording and cleanup proof');
    }
    if(c.goal.en!==op.goal||c.completionProfile!==op.completionProfile||JSON.stringify(c.sideEffects)!==JSON.stringify(op.sideEffects)) issue(errors,'CATALOG_DRIFT',at,'Summary and contract differ');
    if(JSON.stringify(c.writes.map(w=>w.path))!==JSON.stringify(op.writeScope)) issue(errors,'WRITE_SCOPE_DRIFT',at,'Write scope must derive from write matrix');
    const readIds=c.reads.map(r=>r.id),writeIds=c.writes.map(w=>w.id);
    if(!unique(readIds)||!unique(writeIds)) issue(errors,'DUPLICATE_BINDING',at,'Read/write IDs must be unique');
    for(const row of [...c.reads,...c.writes]) {
      if(!nonempty(row.id)||!nonempty(row.path)||!pair(row.purpose??row.content)) issue(errors,'BINDING_SHAPE',at,'Every binding needs ID/path and English purpose');
      for(const match of (row.path??'').matchAll(/<([^>]+)>/g)) if(!nonempty(c.placeholders?.[match[1]])) issue(errors,'UNDEFINED_PLACEHOLDER',at,match[1]);
      if(/(?:^|[ /])\.\.(?:[ /]|$)|[A-Za-z]:[\\/]|~[\\/]/.test(row.path??'')) issue(errors,'UNSAFE_TEMPLATE',at,row.path);
    }
    for(const w of c.writes) {
      if(!Array.isArray(w.fields)||!w.fields.length||!w.fields.every(nonempty)) issue(errors,'WRITE_FIELDS',at,w.id+' has no field/content matrix');
      if(!/^(?:N\/(?:index\.yaml|assets\/)|E\/|\.starciwork\/|repository:<repo-id>\/)/.test(w.path??'')) issue(errors,'WRITE_DESTINATION',at,'Write must target explicit Work node/assets/evidence or bound source repository');
      if(w.path?.startsWith('repository:')&&w.id!=='source') issue(errors,'SOURCE_SCOPE',at,'Product source writes need explicit source binding');
    }
    const usedReads=new Set(),usedWrites=new Set();
    for(const [i,s] of c.steps.entries()) {
      if(!pair(s.action)||!Array.isArray(s.reads)||!Array.isArray(s.writes)) {issue(errors,'STEP_SHAPE',at,`Step ${i+1} incomplete`);continue;}
      for(const id of s.reads) {usedReads.add(id);if(!readIds.includes(id)) issue(errors,'UNDECLARED_READ',at,`Step ${i+1}: ${id}`);}
      for(const id of s.writes) {usedWrites.add(id);if(!writeIds.includes(id)) issue(errors,'UNDECLARED_WRITE',at,`Step ${i+1}: ${id}`);}
    }
    for(const id of readIds) if(!usedReads.has(id)) issue(errors,'UNUSED_READ',at,id);
    for(const id of writeIds) if(!usedWrites.has(id)) issue(errors,'UNREACHABLE_WRITE',at,id);
    if(writeIds.includes('source')&&(!readIds.includes('repo')||!op.sideEffects.length)) issue(errors,'SOURCE_AUTHORITY',at,'Source writes need repository grounding and declared effects');
    if(!unique(c.proofs.map(p=>p.id))||!c.proofs.every(p=>nonempty(p.id)&&pair(p.requirement))) issue(errors,'PROOF_SHAPE',at,'Proof identities and English requirements required');
    if(!unique(c.blockers.map(b=>b.code))||!c.blockers.every(b=>/^[A-Z][A-Z_]+$/.test(b.code)&&pair(b.condition))) issue(errors,'BLOCKER_SHAPE',at,'Concrete English blocker conditions required');
  }
  if(root) {
    const actualDocuments=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^[a-z]+(?:\.[a-z]+)+$/.test(e.name)&&(fs.existsSync(path.join(root,e.name,'operator.yaml'))||fs.existsSync(path.join(root,e.name,'operator.json')))).map(e=>fs.existsSync(path.join(root,e.name,'operator.yaml'))?e.name+'/operator.yaml':e.name+'/operator.json').sort();
    const declaredDocuments=catalog.ops.map(op=>op.document).sort();
    if(JSON.stringify(actualDocuments)!==JSON.stringify(declaredDocuments)) issue(errors,'DOCUMENT_COVERAGE','catalog','Catalogue must name each actual V3 operator document exactly once');
  }
  return {ok:errors.length===0,errors};
}
