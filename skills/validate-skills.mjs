import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nextState } from './route-machine.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(root, '..');
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
  'starci-frontend-surface-reconcile',
  'starci-quality-readiness',
  'starci-quality-debt-repay',
  'starci-deployment',
  'starci-deployment-monitor',
  'starci-deployment-recover'
]);
const productMissionSkills = new Set([
  'starci-frontend-block-reconcile',
  'starci-frontend-maintenance-apply',
  'starci-frontend-surface-reconcile'
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

  const analysisEdges = machine.states['analyze-input'].on;
  if (analysisEdges.length !== 1 || Object.keys(analysisEdges[0].when ?? {}).length !== 0) fail(`${skillId}: one-flow analysis must have one unconditional entry edge`);
  if (inputSchema.properties.selection.properties.mode !== undefined) fail(`${skillId}: one-flow selection must not expose a secondary mode`);
  const target = nextState(machine, 'analyze-input', {}, { selection: { skillId }, options: {} });
  if (!machine.states[target]) fail(`${skillId}: fixed analysis selected an unknown target`);

  if (productMissionSkills.has(skillId)) {
    const refs = new Set(Object.values(machine.states).map((state) => state.ref).filter(Boolean));
    for (const requiredRef of [
      'delivery/impact-classify',
      'architecture/decision-frame',
      'architecture/boundary-plan',
      'be/implementation',
      'quality/delivery-proof',
      'delivery/mission-resume',
      'delivery/mission-proof',
      'business/reconcile'
    ]) {
      if (!refs.has(requiredRef)) fail(`${skillId}: product mission is missing shared full-stack operator ${requiredRef}`);
    }
    const impact = machine.states['mission-impact'];
    const decisions = new Map((impact?.on ?? []).map((edge) => [edge.when?.decision, edge.target]));
    if (!decisions.has('frontend-only') || !decisions.has('backend-required')) {
      fail(`${skillId}: product mission must classify frontend-only and backend-required impact`);
    }
    if (machine.states[decisions.get('backend-required')]?.ref !== 'architecture/decision-frame') {
      fail(`${skillId}: backend-required impact must enter the shared architecture lane`);
    }
    const proof = machine.states['mission-proof'];
    if (proof?.ref !== 'delivery/mission-proof') fail(`${skillId}: product mission must join cross-role proof`);
    const reconcile = machine.states['mission-business-reconcile'];
    if (reconcile?.ref !== 'business/reconcile') fail(`${skillId}: product mission must reconcile joined proof with business truth`);
  }
}

async function assertValidators(skillDir) {
  const skillId = path.basename(skillDir);
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const outputSchema = readJson(path.join(skillDir, 'output.schema.json'));
  const inputValidator = await import(pathToFileURL(path.join(skillDir, 'validate-input.mjs')).href);
  const outputValidator = await import(pathToFileURL(path.join(skillDir, 'validate-output.mjs')).href);
  const options = Object.fromEntries(Object.entries(inputSchema.properties.options.properties).map(([name, rule]) => [
    name,
    rule.enum?.[0] ?? (rule.type === 'boolean' ? true : 'value')
  ]));
  const validInput = {
    schemaVersion: 6,
    runId: 'run-1',
    project: 'starci',
    selection: {
      analyzerVersion: 1,
      skillId,
      confidence: 'exact',
      activeInputRefs: ['request:1'],
      passiveContextRefs: []
    },
    requestRef: 'request:1',
    artifactRefs: Array.from({ length: inputSchema.properties.artifactRefs.minItems ?? 0 }, (_, index) => `artifact:${index + 1}`),
    evidenceRefs: ['evidence:1'],
    scope: {
      targetRefs: ['target:1'],
      writeRoots: Array.from({ length: inputSchema.properties.scope.properties?.writeRoots?.minItems ?? 0 }, (_, index) => `src-${index + 1}`),
      externalMutation: false,
      approvalRef: null
    },
    options
  };
  const terminalBranch = outputSchema.allOf.flatMap((item) => item.oneOf ?? []).find((item) => item.properties?.result?.const === 'complete') ?? outputSchema.allOf[0].oneOf[0];
  const finalState = terminalBranch.properties.finalState.const;
  const terminalState = terminalBranch.properties.state.properties;
  const validOutput = {
    schemaVersion: 6,
    runId: 'run-1',
    skillId,
    result: terminalBranch.properties.result.const,
    finalState,
    state: { status: terminalState.status.const, code: terminalState.code.const, retryable: false, terminalState: finalState },
    handoffRef: terminalBranch.properties.result.const === 'handoff' ? 'session://tasks/run-1/handoff.json' : null,
    receiptRefs: [`receipt:sha256:${'a'.repeat(64)}`],
    findings: [],
    cleanup: { scratchRefs: [], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' }
  };
  const inputResult = inputValidator.validateInput(validInput);
  if (!inputResult.valid) fail(`${skillId}: input validator rejects canonical input: ${JSON.stringify(inputResult.errors)}`);
  const outputResult = outputValidator.validateOutput(validOutput);
  if (!outputResult.valid) fail(`${skillId}: output validator rejects canonical output: ${JSON.stringify(outputResult.errors)}`);
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
  const implicitInvocation = source.match(/^\s*allow_implicit_invocation:\s*(true|false)\s*$/m)?.[1];
  if (!displayName) fail(`${skillId}: openai.yaml needs a quoted display_name`);
  if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 64) {
    fail(`${skillId}: short_description must contain 25-64 characters`);
  }
  if (!defaultPrompt?.includes(`$${skillId}`)) fail(`${skillId}: default_prompt must mention $${skillId}`);
  if (implicitInvocation !== 'true') fail(`${skillId}: automatic prompt-based selection must remain enabled`);
}

const skillDirs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name))
  .sort();

if (skillDirs.length === 0) fail('no state-machine skills found');

const catalog = readJson(path.join(root, 'catalog.json'));
const catalogIds = catalog.skills.map((skill) => skill.id).sort();
const directoryIds = skillDirs.map((skillDir) => path.basename(skillDir)).sort();
if (JSON.stringify(catalogIds) !== JSON.stringify(directoryIds)) fail('global skill catalog differs from materialized skill directories');
const globalAnalyzer = await import(pathToFileURL(path.join(repositoryRoot, 'validate-analyze-input.mjs')).href);
for (const entry of catalog.skills) {
  const selection = { analyzerVersion: 1, skillId: entry.id, confidence: 'exact', activeInputRefs: ['request:1'], passiveContextRefs: ['file:skills/catalog.json'] };
  if (!globalAnalyzer.validateAnalyzeInput(selection).valid) fail(`global analyzer rejects ${entry.id}`);
}
if (globalAnalyzer.validateAnalyzeInput({ analyzerVersion: 1, skillId: 'starci-missing', confidence: 'exact', activeInputRefs: [], passiveContextRefs: [] }).valid) {
  fail('global analyzer accepts an unknown skill');
}

for (const skillDir of skillDirs) {
  const skillId = path.basename(skillDir);
  const present = new Set(readdirSync(skillDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name));
  const missing = requiredFiles.filter((file) => !present.has(file));
  if (missing.length) fail(`${path.basename(skillDir)}: missing ${missing.join(', ')}`);
  const machine = readJson(path.join(skillDir, 'machine.json'));
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const outputSchema = readJson(path.join(skillDir, 'output.schema.json'));
  for (const document of ['SKILL.md', 'execute.md']) {
    const source = readFileSync(path.join(skillDir, document), 'utf8');
    if (/^## LOADS\s*$/mi.test(source) || /\|\s*Alias\s*\|\s*Target\s*\|\s*Kind\s*\|\s*Why\s*\|/i.test(source)) {
      fail(`${skillId}: ${document} duplicates canonical contracts in a LOADS table`);
    }
  }
  if (skillId === 'starci-frontend-surface-reconcile') {
    const analyzeInput = readFileSync(path.join(skillDir, 'analyze-input.md'), 'utf8');
    for (const requiredMotionPhrase of [
      'Framer Motion',
      'hero entrance',
      'staggered content',
      'reduced-motion proof',
      'bound display type',
      'purposeful route media',
      'full available content grid'
    ]) {
      if (!analyzeInput.includes(requiredMotionPhrase)) {
        fail(`${skillId}: analyze-input.md must retain landing motion authority phrase: ${requiredMotionPhrase}`);
      }
    }
  }
  assertStructure(skillDir, machine, inputSchema, outputSchema);
  assertOpenAiInterface(skillDir);
  await assertValidators(skillDir);
}

console.log(`validated ${skillDirs.length} state-machine skills`);
