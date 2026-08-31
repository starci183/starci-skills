import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatorFor } from '../operators/validation.mjs';
import { loadScopePolicy } from '../runtime/scope-policy.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(root, '..');
const operatorsRoot = path.join(runtimeRoot, 'operators');
const scopePolicy = loadScopePolicy();
const fail = (message) => { throw new Error(message); };
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const requiredFiles = [
  'SKILL.md', 'agents/openai.yaml', 'analyze-input.md', 'execute.md', 'input.md',
  'input.schema.json', 'machine.json', 'output.md', 'output.schema.json',
  'validate-input.mjs', 'validate-output.mjs'
];

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

function exactValues(rule) {
  if (!rule) return [];
  if (Object.hasOwn(rule, 'const')) return [rule.const];
  return rule.enum ?? [];
}

function resolveLocal(schema, value) {
  if (!value?.$ref?.startsWith('#/')) return value;
  return value.$ref.slice(2).split('/').reduce(
    (node, part) => node?.[part.replaceAll('~1', '/').replaceAll('~0', '~')],
    schema
  );
}

function operatorOutcomes(operatorRef) {
  const directory = path.join(operatorsRoot, ...operatorRef.split('/'));
  const manifestFile = path.join(directory, 'operator.json');
  const outputFile = path.join(directory, 'output.schema.json');
  if (!existsSync(manifestFile) || !existsSync(outputFile)) fail(`missing operator ${operatorRef}`);
  const manifest = readJson(manifestFile);
  const output = readJson(outputFile);
  const outputRoot = resolveLocal(output, output.properties?.output);
  const outcomes = exactValues(resolveLocal(output, outputRoot?.properties?.outcome));
  if (manifest.schemaVersion !== 7) fail(`${operatorRef}: public v7 skills may call only v7 operators`);
  if (!outcomes.length) fail(`${operatorRef}: output contract needs a closed output.outcome`);
  return outcomes;
}

function assertOperatorRoutes(skillId, stateId, state, inputSchema) {
  const outcomes = operatorOutcomes(state.ref);
  const routes = state.on ?? [];
  if (routes.some((edge) => !edge.when?.outputEquals || Object.keys(edge.when.outputEquals).length !== 1 || edge.when.outputEquals.outcome === undefined || Object.keys(edge.when).some((key) => !['outputEquals','inputEquals'].includes(key)))) {
    fail(`${skillId}/${stateId}: operator transitions must route on output.outcome with at most one exact input partition`);
  }
  const routed = routes.map((edge) => edge.when.outputEquals.outcome);
  const missing = outcomes.filter((outcome) => !routed.includes(outcome));
  const unknown = routed.filter((outcome) => !outcomes.includes(outcome));
  if (missing.length || unknown.length) {
    fail(`${skillId}/${stateId}: routes differ from ${state.ref}; missing [${missing}], unknown [${unknown}]`);
  }
  for (const outcome of outcomes) {
    const group = routes.filter((edge) => edge.when.outputEquals.outcome === outcome);
    if (group.length === 1 && !group[0].when.inputEquals) continue;
    if (group.some((edge) => !edge.when.inputEquals || Object.keys(edge.when.inputEquals).length !== 1)) {
      fail(`${skillId}/${stateId}/${outcome}: conditional routes must use one exact input field on every edge`);
    }
    const keys = new Set(group.map((edge) => Object.keys(edge.when.inputEquals)[0]));
    if (keys.size !== 1) fail(`${skillId}/${stateId}/${outcome}: conditional routes must partition the same input field`);
    const key = [...keys][0];
    const allowed = inputSchema.properties?.[key]?.enum;
    if (!Array.isArray(allowed) || allowed.length === 0) fail(`${skillId}/${stateId}/${outcome}: conditional field ${key} needs a closed top-level enum`);
    const actual = group.map((edge) => edge.when.inputEquals[key]);
    if (new Set(actual).size !== actual.length || JSON.stringify([...actual].sort()) !== JSON.stringify([...allowed].sort())) {
      fail(`${skillId}/${stateId}/${outcome}: conditional routes must cover ${key} exactly once`);
    }
  }
}

function assertSelection(skillId, inputSchema) {
  const selection = inputSchema.properties?.selection;
  const required = [
    'analyzerVersion', 'skillId', 'confidence', 'interactionPolicy',
    'activeInputRefs', 'passiveContextRefs'
  ];
  if (!selection || selection.additionalProperties !== false) fail(`${skillId}: selection must be closed`);
  if (JSON.stringify([...selection.required].sort()) !== JSON.stringify([...required].sort())) {
    fail(`${skillId}: selection fields differ from the v7 envelope`);
  }
  if (selection.properties.analyzerVersion?.const !== 2) fail(`${skillId}: analyzerVersion must be 2`);
  if (selection.properties.skillId?.const !== skillId) fail(`${skillId}: selection skillId must be local`);
  if (selection.properties.interactionPolicy?.const !== 'ask-only-when-stuck') {
    fail(`${skillId}: interactionPolicy must be ask-only-when-stuck`);
  }
  const confidence = selection.properties.confidence?.enum ?? [];
  if (JSON.stringify([...confidence].sort()) !== JSON.stringify(['clarified', 'exact'])) {
    fail(`${skillId}: confidence must be exact|clarified`);
  }
  if ('mode' in selection.properties) fail(`${skillId}: legacy approval mode is forbidden`);
}

function assertScope(skillId, inputSchema) {
  if (!inputSchema.required?.includes('scope')) fail(`${skillId}: input must require mission scope`);
  const scope = resolveLocal(inputSchema, inputSchema.properties?.scope);
  if (!scope || scope.additionalProperties !== false) fail(`${skillId}: scope must be a closed object`);
  const actual = [...(scope.required ?? [])].sort();
  const expected = [...scopePolicy.requiredCoreFields].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${skillId}: scope fields differ from scope.yaml`);
  if (scope.properties?.status?.const !== scopePolicy.frozenStatus) fail(`${skillId}: scope must be frozen`);
  if (scope.properties?.targetRefs?.minItems !== 1) fail(`${skillId}: scope needs at least one target`);
  if (scope.properties?.completionProofRefs?.minItems !== 1) fail(`${skillId}: scope needs completion proof`);
  if (scope.properties?.ambiguityRefs?.maxItems !== 0) fail(`${skillId}: ambiguous scope must be rejected`);
  const dimension = scope.properties?.dimensions?.items;
  if (!dimension || dimension.additionalProperties !== false) fail(`${skillId}: scope dimensions must be closed entries`);
}

function assertMachine(skillId, machine, inputSchema, outputSchema) {
  if (machine.schemaVersion !== 7 || inputSchema.properties?.schemaVersion?.const !== 7 || outputSchema.properties?.schemaVersion?.const !== 7) {
    fail(`${skillId}: machine/input/output must all be schemaVersion 7`);
  }
  if (machine.id !== skillId) fail(`${skillId}: machine id mismatch`);
  if (machine.start !== 'analyze-input' || machine.states['analyze-input']?.kind !== 'analysis') {
    fail(`${skillId}: start must be the analyze-input analysis state`);
  }
  const analysis = machine.states['analyze-input'];
  if (!analysis.on?.length || analysis.on.some((edge) => {
    const keys = Object.keys(edge.when ?? {});
    return keys.length > 1 || (keys.length === 1 && keys[0] !== 'inputEquals');
  })) {
    fail(`${skillId}: analyze-input may route only on normalized input fields`);
  }
  const stateIds = new Set(Object.keys(machine.states));
  for (const [stateId, state] of Object.entries(machine.states)) {
    if (state.kind === 'operator') assertOperatorRoutes(skillId, stateId, state, inputSchema);
    if (state.kind === 'terminal' && state.on !== undefined) fail(`${skillId}/${stateId}: terminal cannot route`);
    if (state.kind !== 'terminal' && !Array.isArray(state.on)) fail(`${skillId}/${stateId}: missing routes`);
    if (state.kind === 'wait') {
      if (!state.approval?.resumeTarget || !stateIds.has(state.approval.resumeTarget)) {
        fail(`${skillId}/${stateId}: wait needs an existing resumeTarget`);
      }
      if (state.approval.bypassTarget !== undefined) fail(`${skillId}/${stateId}: bypassTarget is forbidden`);
    }
    for (const edge of state.on ?? []) {
      if (!stateIds.has(edge.target)) fail(`${skillId}/${stateId}: unknown target ${edge.target}`);
    }
  }
  const reached = reachableStates(machine);
  const unreachable = [...stateIds].filter((stateId) => !reached.has(stateId));
  if (unreachable.length) fail(`${skillId}: unreachable states ${unreachable.join(', ')}`);
  if (![...reached].some((stateId) => machine.states[stateId].kind === 'terminal')) {
    fail(`${skillId}: no reachable terminal`);
  }
  const machineResult = validatorFor(new URL('./machine.schema.json', import.meta.url))(machine);
  if (!machineResult.valid) fail(`${skillId}: machine schema ${machineResult.errors.join('; ')}`);
  if (inputSchema.additionalProperties !== false || outputSchema.additionalProperties !== false) {
    fail(`${skillId}: input and output schemas must be closed`);
  }
  assertSelection(skillId, inputSchema);
  assertScope(skillId, inputSchema);
  for (const edge of analysis.on) {
    if (!stateIds.has(edge.target)) fail(`${skillId}: analyze-input selected an unknown state`);
  }
}

async function assertValidators(skillId, skillDir) {
  const inputModule = await import(pathToFileURL(path.join(skillDir, 'validate-input.mjs')).href);
  const outputModule = await import(pathToFileURL(path.join(skillDir, 'validate-output.mjs')).href);
  if (typeof inputModule.validateInput !== 'function' || typeof outputModule.validateOutput !== 'function') {
    fail(`${skillId}: validators must export validateInput and validateOutput`);
  }
  if (inputModule.validateInput({ junk: true }).valid) fail(`${skillId}: input validator accepts junk`);
  if (outputModule.validateOutput({ junk: true }).valid) fail(`${skillId}: output validator accepts junk`);
}

function assertOpenAiInterface(skillId, skillDir) {
  const source = readFileSync(path.join(skillDir, 'agents', 'openai.yaml'), 'utf8');
  const displayName = source.match(/^\s*display_name:\s*"([^"]+)"\s*$/m)?.[1];
  const shortDescription = source.match(/^\s*short_description:\s*"([^"]+)"\s*$/m)?.[1];
  const defaultPrompt = source.match(/^\s*default_prompt:\s*"([^"]+)"\s*$/m)?.[1];
  const implicit = source.match(/^\s*allow_implicit_invocation:\s*(true|false)\s*$/m)?.[1];
  if (!displayName) fail(`${skillId}: openai.yaml needs display_name`);
  if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 96) {
    fail(`${skillId}: short_description must contain 25-96 characters`);
  }
  if (!defaultPrompt?.includes(`$${skillId}`)) fail(`${skillId}: default_prompt must mention the skill`);
  if (implicit !== 'true') fail(`${skillId}: automatic selection must remain enabled`);
}

const catalog = readJson(path.join(root, 'catalog.json'));
if (catalog.schemaVersion !== 7 || catalog.systemVersion !== '7.5.0-alpha.1') fail('catalog must be v7.5.0-alpha.1');
if (catalog.skills.length !== 13) fail(`v7 catalog must expose 13 skills, found ${catalog.skills.length}`);
const catalogIds = catalog.skills.map((entry) => entry.id);
if (new Set(catalogIds).size !== catalogIds.length) fail('catalog skill IDs must be unique');

const publicIds = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('starci-'))
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify([...catalogIds].sort()) !== JSON.stringify(publicIds)) {
  fail('catalog differs from public skill directories');
}

const globalAnalyzer = await import(pathToFileURL(path.join(runtimeRoot, 'validate-analyze-input.mjs')).href);
for (const entry of catalog.skills) {
  if (!/^starci-[a-z0-9-]+-[a-z0-9]+$/.test(entry.id)) fail(`${entry.id}: name needs an owned object and action`);
  const selection = {
    analyzerVersion: 2,
    skillId: entry.id,
    confidence: 'exact',
    interactionPolicy: 'ask-only-when-stuck',
    activeInputRefs: ['request:current'],
    passiveContextRefs: ['skills:catalog.json']
  };
  if (!globalAnalyzer.validateAnalyzeInput(selection).valid) fail(`global analyzer rejects ${entry.id}`);
  const skillDir = path.join(root, entry.id);
  const present = new Set(readdirSync(skillDir, { withFileTypes: true }).filter((item) => item.isFile()).map((item) => item.name));
  const missing = requiredFiles.filter((file) => !existsSync(path.join(skillDir, ...file.split('/'))));
  if (missing.length) fail(`${entry.id}: missing ${missing.join(', ')}`);
  const skillSource = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
  const frontmatterName = skillSource.match(/^name:\s*([^\r\n]+)$/m)?.[1]?.replaceAll('"', '').trim();
  if (frontmatterName !== entry.id) fail(`${entry.id}: SKILL.md name mismatch`);
  const publicText = requiredFiles.filter((file) => file.endsWith('.md')).map((file) => readFileSync(path.join(skillDir, ...file.split('/')), 'utf8')).join('\n');
  if (/\b(?:gated|bypass)\b/i.test(publicText)) fail(`${entry.id}: legacy approval modes remain`);
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const outputSchema = readJson(path.join(skillDir, 'output.schema.json'));
  const machine = readJson(path.join(skillDir, 'machine.json'));
  assertMachine(entry.id, machine, inputSchema, outputSchema);
  assertOpenAiInterface(entry.id, skillDir);
  await assertValidators(entry.id, skillDir);
}

if (globalAnalyzer.validateAnalyzeInput({ analyzerVersion: 2, skillId: 'starci-missing' }).valid) {
  fail('global analyzer accepts an unknown skill');
}

console.log('validated 13 public v7 mission skills');
