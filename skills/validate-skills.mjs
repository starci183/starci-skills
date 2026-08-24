import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const operatorsRoot = path.resolve(root, '..', 'operators');
const requiredFiles = [
  'SKILL.md',
  'analyze-input.md',
  'execute.md',
  'input.md',
  'input.schema.json',
  'machine.json',
  'output.md',
  'output.schema.json',
  'validate-input.mjs',
  'validate-output.mjs'
];
const cycleRequired = new Set([
  'starci-architecture-decide',
  'starci-backend-delivery',
  'starci-frontend-design-delivery',
  'starci-quality-readiness',
  'starci-deployment'
]);

const fail = (message) => { throw new Error(message); };
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function reachableStates(machine) {
  const seen = new Set();
  const queue = [machine.start];
  while (queue.length) {
    const stateId = queue.shift();
    if (seen.has(stateId)) continue;
    seen.add(stateId);
    for (const edge of machine.states[stateId]?.on ?? []) queue.push(edge.target);
  }
  return seen;
}

function hasCycle(machine) {
  const active = new Set();
  const done = new Set();
  const visit = (stateId) => {
    if (active.has(stateId)) return true;
    if (done.has(stateId)) return false;
    active.add(stateId);
    for (const edge of machine.states[stateId]?.on ?? []) {
      if (visit(edge.target)) return true;
    }
    active.delete(stateId);
    done.add(stateId);
    return false;
  };
  return visit(machine.start);
}

function modesFrom(schema) {
  const modes = schema?.properties?.mode?.enum;
  if (!Array.isArray(modes) || modes.length === 0) fail('input schema must define a non-empty mode enum');
  return modes;
}

function exactValues(property) {
  if (!property) return [];
  if (Object.hasOwn(property, 'const')) return [property.const];
  return property.enum ?? [];
}

function resolveLocal(schema, value) {
  if (!value?.$ref?.startsWith('#/')) return value;
  return value.$ref.slice(2).split('/').reduce((node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function operatorOutcomes(operatorFile) {
  const operator = readJson(operatorFile);
  const output = readJson(path.join(path.dirname(operatorFile), 'output.schema.json'));
  const decisions = exactValues(output?.properties?.payload?.properties?.decision);
  const variants = (operator.emits ?? []).map((emission) => `${emission.stage}\u0000${emission.status}`);
  return { decisions, variants };
}

function assertOperatorRoutes(skillId, stateId, state, operatorFile) {
  const { decisions, variants } = operatorOutcomes(operatorFile);
  const decisionEdges = state.on.filter((edge) => edge.when?.decision !== undefined);
  const stageEdges = state.on.filter((edge) => edge.when?.stage !== undefined || edge.when?.status !== undefined);
  if (decisionEdges.length && stageEdges.length) fail(`${skillId}/${stateId}: do not mix decision and stage routing`);
  if (decisionEdges.length) {
    const routed = decisionEdges.map((edge) => edge.when.decision);
    const missing = decisions.filter((decision) => !routed.includes(decision));
    const unknown = routed.filter((decision) => !decisions.includes(decision));
    if (new Set(routed).size !== routed.length || missing.length || unknown.length) {
      fail(`${skillId}/${stateId}: decision routes differ from ${state.ref} contract; missing [${missing}], unknown [${unknown}]`);
    }
    return;
  }
  if (stageEdges.length) {
    const routed = stageEdges.map((edge) => `${edge.when.stage ?? '*'}\u0000${edge.when.status ?? '*'}`);
    const missing = variants.filter((variant) => !routed.includes(variant));
    const unknown = routed.filter((variant) => !variants.includes(variant));
    if (new Set(routed).size !== routed.length || missing.length || unknown.length) {
      fail(`${skillId}/${stateId}: stage routes differ from ${state.ref} contract; missing ${JSON.stringify(missing)}, unknown ${JSON.stringify(unknown)}`);
    }
    return;
  }
  fail(`${skillId}/${stateId}: operator routing must use its output decision or stage/status contract`);
}

function assertStructure(skillDir, machine, inputSchema, outputSchema) {
  const skillId = path.basename(skillDir);
  if (!skillId.startsWith('starci-')) fail(`${skillId}: every executable skill must use the starci- prefix`);
  if (machine.id !== skillId) fail(`${skillId}: machine id differs from directory`);
  if (machine.start !== 'analyze-input') fail(`${skillId}: start must be analyze-input`);
  if (machine.states[machine.start]?.kind !== 'analysis') fail(`${skillId}: first state must be analysis`);
  if (inputSchema.additionalProperties !== false || outputSchema.additionalProperties !== false) {
    fail(`${skillId}: input and output schemas must be closed`);
  }

  const stateIds = Object.keys(machine.states);
  for (const [stateId, state] of Object.entries(machine.states)) {
    if (state.kind !== 'terminal' && !Array.isArray(state.on)) fail(`${skillId}/${stateId}: missing routes`);
    if (state.kind === 'terminal' && state.on !== undefined) fail(`${skillId}/${stateId}: terminal cannot route`);
    if (state.kind === 'choice' && state.on.length < 2) fail(`${skillId}/${stateId}: choice needs at least two routes`);
    if (state.kind === 'operator') {
      const operatorFile = path.join(operatorsRoot, ...state.ref.split('/'), 'operator.json');
      if (!existsSync(operatorFile)) fail(`${skillId}/${stateId}: missing operator ${state.ref}`);
      assertOperatorRoutes(skillId, stateId, state, operatorFile);
    }
    for (const edge of state.on ?? []) {
      if (!stateIds.includes(edge.target)) fail(`${skillId}/${stateId}: unknown target ${edge.target}`);
    }
  }

  const reached = reachableStates(machine);
  const unreachable = stateIds.filter((stateId) => !reached.has(stateId));
  if (unreachable.length) fail(`${skillId}: unreachable states ${unreachable.join(', ')}`);
  if (![...reached].some((stateId) => machine.states[stateId].kind === 'terminal')) fail(`${skillId}: no reachable terminal`);
  if (cycleRequired.has(skillId) && !hasCycle(machine)) fail(`${skillId}: repair/review loop is required`);

  const inputModes = new Set(modesFrom(inputSchema));
  const analysisEdges = machine.states['analyze-input'].on;
  const routedModes = analysisEdges.map((edge) => edge.when?.inputEquals?.mode);
  if (routedModes.some((mode) => typeof mode !== 'string')) fail(`${skillId}: analysis routes must compare input mode`);
  if (new Set(routedModes).size !== routedModes.length) fail(`${skillId}: duplicate analysis mode route`);
  if (inputModes.size !== routedModes.length || routedModes.some((mode) => !inputModes.has(mode))) {
    fail(`${skillId}: analysis routes must exactly cover input mode enum`);
  }
  for (const mode of inputModes) {
    const target = nextState(machine, 'analyze-input', {}, { mode, options: {} });
    if (!machine.states[target]) fail(`${skillId}: mode ${mode} selected unknown target`);
  }
}

async function assertValidators(skillDir) {
  const skillId = path.basename(skillDir);
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const inputValidator = await import(pathToFileURL(path.join(skillDir, 'validate-input.mjs')).href);
  const outputValidator = await import(pathToFileURL(path.join(skillDir, 'validate-output.mjs')).href);
  const options = Object.fromEntries(Object.entries(inputSchema.properties.options.properties).map(([name, rule]) => [
    name,
    rule.enum?.[0] ?? (rule.type === 'boolean' ? false : 'value')
  ]));
  const validInput = {
    schemaVersion: 6,
    runId: 'run-1',
    project: 'starci',
    mode: inputSchema.properties.mode.enum[0],
    requestRef: 'request:1',
    artifactRefs: [],
    evidenceRefs: ['evidence:1'],
    scope: { targetRefs: ['target:1'], writeRoots: [], externalMutation: false, approvalRef: null },
    options
  };
  const validOutput = { schemaVersion: 6, runId: 'run-1', skillId, result: 'complete', finalState: 'complete', receiptRefs: ['receipt:1'], findings: [] };
  if (!inputValidator.validateInput(validInput).valid) fail(`${skillId}: input validator rejects canonical input`);
  if (!outputValidator.validateOutput(validOutput).valid) fail(`${skillId}: output validator rejects canonical output`);
  if (inputValidator.validateInput({ junk: true }).valid) fail(`${skillId}: input validator accepts junk`);
  if (outputValidator.validateOutput({ junk: true }).valid) fail(`${skillId}: output validator accepts junk`);
}

function assertOpenAiInterface(skillDir) {
  const skillId = path.basename(skillDir);
  const interfaceFile = path.join(skillDir, 'agents', 'openai.yaml');
  if (!existsSync(interfaceFile)) fail(`${skillId}: missing agents/openai.yaml`);
  const source = readFileSync(interfaceFile, 'utf8');
  const displayName = source.match(/^\s*display_name:\s*"([^"]+)"\s*$/m)?.[1];
  const shortDescription = source.match(/^\s*short_description:\s*"([^"]+)"\s*$/m)?.[1];
  const defaultPrompt = source.match(/^\s*default_prompt:\s*"([^"]+)"\s*$/m)?.[1];
  if (!displayName) fail(`${skillId}: openai.yaml needs a quoted display_name`);
  if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 64) {
    fail(`${skillId}: short_description must contain 25-64 characters`);
  }
  if (!defaultPrompt?.includes(`$${skillId}`)) fail(`${skillId}: default_prompt must mention $${skillId}`);
}

const skillDirs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name))
  .sort();

if (skillDirs.length === 0) fail('no state-machine skills found');

for (const skillDir of skillDirs) {
  const present = new Set(readdirSync(skillDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name));
  const missing = requiredFiles.filter((file) => !present.has(file));
  if (missing.length) fail(`${path.basename(skillDir)}: missing ${missing.join(', ')}`);
  const machine = readJson(path.join(skillDir, 'machine.json'));
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const outputSchema = readJson(path.join(skillDir, 'output.schema.json'));
  assertStructure(skillDir, machine, inputSchema, outputSchema);
  assertOpenAiInterface(skillDir);
  await assertValidators(skillDir);
}

console.log(`validated ${skillDirs.length} state-machine skills`);
