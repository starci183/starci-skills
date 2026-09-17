import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';

import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml} from '../core/yaml.mjs';
import {PLAN_OP_KINDS} from '../models/functions.mjs';
import {
  createWorkflowReceipt,
  recordOperationReceipt,
  validateExecutionRequest,
  validateWorkflowRequest
} from '../execution/contracts.mjs';

const workflow = () => ({
  apiVersion: 'starci.workflow/v1',
  kind: 'WorkflowRequest',
  metadata: {workflowId: 'workflow-1', project: 'academy'},
  spec: {
    mode: 'orchestrated',
    controlPlane: 'orca',
    source: {repository: 'starci-academy-backend', baseRef: 'main'},
    operations: [
      {id: 'design', operation: 'architecture.decide', dependsOn: [], gate: 'approved-goal', capabilities: ['read']},
      {id: 'implement', operation: 'backend.implement', dependsOn: ['design'], gate: 'design-done', capabilities: ['read', 'write']}
    ]
  }
});

test('execution request and receipt schemas compile in strict draft-2020 mode', () => {
  const ajv = new Ajv2020({strict: true,formats:{'date-time':true}});
  for (const name of ['execution-request.schema.yaml', 'execution-receipt.schema.yaml', 'profile-registry-v3.schema.yaml', 'orca-call.schema.yaml', 'workflow-amendment.schema.yaml', 'workflow-state.schema.yaml', 'ledger-db.schema.yaml']) {
    assert.doesNotThrow(() => ajv.compile(parseYaml(fs.readFileSync(new URL(`../schemas/${name}`, import.meta.url), 'utf8'))));
  }
});

// goal.md §8 Persistence: `engine.journalFile` is deprecated-but-allowed only while `ledgerFile` is
// absent (the `ledger-unmigrated` boundary); a state naming neither is not a recognized engine record.
test('workflow-state schema accepts engine.ledgerFile/machineFile and a deprecated journalFile-only state, refuses neither', () => {
  const schema = parseYaml(fs.readFileSync(new URL('../schemas/workflow-state.schema.yaml', import.meta.url), 'utf8'));
  const validate = new Ajv2020({strict: true}).compile(schema);
  const base = {schema: 'starci/engine@1', version: '1.0.4', generation: 1};
  assert.equal(validate({...base, ledgerFile: '/repo/.starciwork/runtime.sqlite', machineFile: '/machine.sqlite'}), true, JSON.stringify(validate.errors));
  assert.equal(validate({...base, journalFile: '/repo/.starciwork/_local/journal.sqlite'}), true, 'a pre-1.0.4 record naming only journalFile is the ledger-unmigrated shape, not an invalid one');
  assert.equal(validate(base), false, 'an engine record naming neither store is not recognized');
});

// docs/ledger-db.md §4/§5 name the exact tables kernel/ledger-db.mjs creates; the schema catalog must
// never drift from either without the mismatch failing here first.
test('ledger-db schema catalog names exactly the tables kernel/ledger-db.mjs creates', () => {
  const schema = parseYaml(fs.readFileSync(new URL('../schemas/ledger-db.schema.yaml', import.meta.url), 'utf8'));
  const validate = new Ajv2020({strict: true}).compile(schema);
  const source = fs.readFileSync(new URL('../kernel/ledger-db.mjs', import.meta.url), 'utf8');
  const created = [...source.matchAll(/CREATE TABLE (\w+)/g)].map(match => match[1]);
  const ledgerTables = created.slice(0, created.indexOf('ledgers'));
  const machineTables = created.slice(created.indexOf('ledgers'));
  const catalog = {schema: 'starci/ledger-db-catalog@1', ledgerVersion: 1,
    ledgerTables: Object.fromEntries(ledgerTables.map(name => [name, {columns: ['*']}])),
    machineTables: Object.fromEntries(machineTables.map(name => [name, {columns: ['*']}]))};
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
  assert.deepEqual(schema.properties.ledgerTables.required.sort(), [...new Set(ledgerTables)].sort());
  assert.deepEqual(schema.properties.machineTables.required.sort(), [...new Set(machineTables)].sort());
});

test('workflow amendment schema and runtime validator accept the same bounded overlay shape', async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-amendment-schema-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/workflow-amendment.schema.yaml',import.meta.url),'utf8'));
  const validate=new Ajv2020({strict:true,formats:{'date-time':true}}).compile(schema);
  const record={schema:'starci/workflow-amendment@1',workflowId:'wf',baseGoalIdentity:'goal',
    authority:{actor:'owner',source:{threadId:'owner',messageId:null,messageIdAvailability:'not-exposed',quote:'repair',assurance:'conversation-context-not-authenticated',at:null},statement:'repair'},
    coordinator:{actor:'coordinator',source:{threadId:'run',messageId:'m1',messageIdAvailability:'available',quote:'apply',assurance:'conversation-context-not-authenticated',at:'2026-09-16T00:01:00Z'},decision:'apply-same-id',rationale:'bounded'},
    changes:{clarifications:['repair the selected index'],addScope:['features/login/index.yaml'],scopeBindings:{'features/login/index.yaml':['.starciwork/features/login/index.yaml']},addDefinitionOfDone:[],
      supersedeDefinitionOfDone:[{from:'No index writes',to:'Only the owned login index may be repaired'}],operationFindings:{login:['repair']},
      addOperations:[{id:'audit-login',kind:'review.verify',goal:'Audit the bounded login repair.',ledgerIds:['login-ledger'],
        allowlist:['.starciwork/features/login/index.yaml'],references:['.starciwork/features/login/index.yaml'],
        checks:[{name:'validate-login',command:'node bin/starci.mjs validate .starciwork'}],acceptance:['The login repair is independently checked.'],dependsOn:[]}],
      operationDependencies:{login:['audit-login']},
      operationEffects:{login:{paths:['.starciwork/features/login/index.yaml'],resources:[],external:[]}},effectCeiling:{paths:['.starciwork/features/login/index.yaml'],resources:[],external:[]}}};
  assert.equal(validate(record),true,JSON.stringify(validate.errors));
  assert.deepEqual(schema.$defs.operation.properties.kind.enum,[...PLAN_OP_KINDS]);
  const {stringifyYaml}=await import('../core/yaml.mjs'),{readWorkflowAmendment}=await import('../kernel/amendment.mjs');const file=path.join(dir,'valid.yaml');fs.writeFileSync(file,stringifyYaml(record));
  assert.equal(readWorkflowAmendment(file).record.changes.operationEffects.login.paths[0],'.starciwork/features/login/index.yaml');
  const invalid=structuredClone(record);invalid.changes.operationEffects.login.paths=['.starciwork/features/outside/index.yaml'];
  assert.equal(validate(invalid),true,'JSON Schema validates shape; the runtime enforces directional cross-field ceilings');fs.writeFileSync(file,stringifyYaml(invalid));
  assert.throws(()=>readWorkflowAmendment(file),/exceeds changes.effectCeiling/);
});

test('profile registry keeps the user coordinator, deterministic kernel and operation-agent boundary', () => {
  const ajv = new Ajv2020({strict: true});
  const schema = parseYaml(fs.readFileSync(new URL('../schemas/profile-registry-v3.schema.yaml', import.meta.url), 'utf8'));
  const registry = parseYaml(fs.readFileSync(new URL('../model/registry.yaml', import.meta.url), 'utf8'));
  const validate = ajv.compile(schema);
  assert.equal(validate(registry), true, JSON.stringify(validate.errors));
  assert.equal(registry.agentArchitecture.isolationBoundary, 'operation');
  assert.deepEqual(registry.agentArchitecture.levels, ['user-coordinator','workflow-kernel','operation-agent']);
  assert.equal(registry.executionModes.solo.maxConcurrentOperationAgents, 3);
});

test('profile registry accepts only a nonempty explicit headless model override', () => {
  const schema = parseYaml(fs.readFileSync(new URL('../schemas/profile-registry-v3.schema.yaml', import.meta.url), 'utf8'));
  const registry = parseYaml(fs.readFileSync(new URL('../model/registry.yaml', import.meta.url), 'utf8'));
  const validate = new Ajv2020({strict: true}).compile(schema);
  assert.equal(validate(registry), true, JSON.stringify(validate.errors));
  assert.equal(registry.targets['claude-fable'].headlessModel, 'claude-fable-5-1');
  for (const invalid of ['', null]) {
    const candidate = structuredClone(registry);
    candidate.targets['claude-fable'].headlessModel = invalid;
    assert.equal(validate(candidate), false, `headlessModel ${JSON.stringify(invalid)} must fail`);
    assert.ok(validate.errors.some(error => error.instancePath.endsWith('/headlessModel')), JSON.stringify(validate.errors));
  }
});

test('WorkflowRequest is closed, ordered and has host-specific mode constraints', () => {
  const request = workflow();
  assert.equal(validateWorkflowRequest(request), true);
  const solo = workflow();
  solo.spec = {...solo.spec, mode: 'solo', soloHost: 'codex'};
  delete solo.spec.controlPlane;
  assert.equal(validateWorkflowRequest(solo), true);
  solo.spec.soloHost = 'orca';
  assert.equal(validateWorkflowRequest(solo), true);
  solo.spec.soloHost = 'qwen';
  assert.throws(() => validateWorkflowRequest(solo), /soloHost must be codex, claude or orca/);
  const wrongPlane = workflow();
  wrongPlane.spec.controlPlane = 'custom';
  assert.throws(() => validateWorkflowRequest(wrongPlane), /requires controlPlane orca/);
});

test('WorkflowRequest rejects missing dependencies, cycles and dependency order drift', () => {
  const missing = workflow();
  missing.spec.operations[1].dependsOn = ['unknown'];
  assert.throws(() => validateWorkflowRequest(missing), /missing dependency unknown/);
  const cycle = workflow();
  cycle.spec.operations[0].dependsOn = ['implement'];
  assert.throws(() => validateWorkflowRequest(cycle), /dependency cycle/);
  const outOfOrder = workflow();
  outOfOrder.spec.operations.reverse();
  assert.throws(() => validateWorkflowRequest(outOfOrder), /must follow dependency/);
});

test('ExecutionRequest keeps requested model explicit and validates its source binding', () => {
  const request = {
    apiVersion: 'starci.execution/v1',
    kind: 'ExecutionRequest',
    metadata: {workflowId: 'workflow-1', operationId: 'design', requestId: 'request-1'},
    spec: {
      operation: 'architecture.decide', environment: 'claude', profile: 'fable-5.1', requestedModel: null,
      source: {repository: 'starci-academy-backend', baseRef: 'main'}, gate: 'approved-goal', capabilities: ['read']
    }
  };
  assert.equal(validateExecutionRequest(request), true);
  request.spec.requestedModel = '';
  assert.throws(() => validateExecutionRequest(request), /requestedModel/);
});

test('workflow receipts preserve operation order and requested/observed models independently', () => {
  const request = workflow(), receipt = createWorkflowReceipt(request);
  assert.deepEqual(receipt.operations.map(value => value.operationId), ['design', 'implement']);
  const recorded = recordOperationReceipt(receipt, {
    operationId: 'design', operation: 'architecture.decide', status: 'completed',
    environment: 'codex', profile: 'gpt-6-astra', requestedModel: 'gpt-6-astra', observedModel: 'gpt-6-astra', observations: []
  });
  assert.equal(recorded.operations[0].requestedModel, 'gpt-6-astra');
  assert.equal(recorded.operations[0].observedModel, 'gpt-6-astra');
  assert.equal(recorded.status, 'running');
  assert.equal(receipt.operations[0].status, 'pending');
});
