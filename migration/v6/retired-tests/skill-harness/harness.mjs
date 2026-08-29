import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const harnessRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(harnessRoot, '..', '..');
const skillsRoot = path.join(root, 'skills');
const operatorsRoot = path.join(root, 'operators');
const config = JSON.parse(fs.readFileSync(path.join(harnessRoot, 'cases.json'), 'utf8'));
const args = new Set(process.argv.slice(2));

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = (value) => structuredClone(value);
const ratioScore = (part, whole, points) => whole === 0 ? points : Math.round(points * part / whole);

function resolveLocal(schema, rule) {
  if (!rule?.$ref?.startsWith('#/')) return rule;
  return rule.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function visitSchema(schema, callback) {
  const seen = new Set();
  const visit = (raw, at) => {
    const rule = resolveLocal(schema, raw);
    if (!rule || typeof rule !== 'object' || seen.has(rule)) return;
    seen.add(rule);
    callback(rule, at);
    for (const [key, child] of Object.entries(rule.properties ?? {})) visit(child, `${at}.${key}`);
    if (rule.items) visit(rule.items, `${at}[]`);
    for (const key of ['$defs', 'definitions']) for (const [name, child] of Object.entries(rule[key] ?? {})) visit(child, `${at}.${name}`);
    for (const key of ['allOf', 'oneOf', 'anyOf']) (rule[key] ?? []).forEach((child, index) => visit(child, `${at}.${key}[${index}]`));
    for (const key of ['if', 'then', 'else', 'not']) if (rule[key]) visit(rule[key], `${at}.${key}`);
  };
  visit(schema, '$');
}

function schemaInventory(schema) {
  const inventory = { objects: 0, closedObjects: 0, arrays: 0, boundedArrays: 0, referenceFields: [], broadFields: [] };
  const constrained = (raw) => {
    const rule = resolveLocal(schema, raw);
    if (!rule || typeof rule !== 'object') return false;
    if (rule.pattern || rule.format || rule.enum || Object.hasOwn(rule, 'const')) return true;
    return [...(rule.oneOf ?? []), ...(rule.anyOf ?? [])].some(constrained);
  };
  visitSchema(schema, (rule, at) => {
    if (rule.type === 'object' || rule.properties) {
      inventory.objects += 1;
      if (rule.additionalProperties === false) inventory.closedObjects += 1;
    }
    if (rule.type === 'array') {
      inventory.arrays += 1;
      if (Number.isInteger(rule.maxItems)) inventory.boundedArrays += 1;
    }
    const leaf = at.split('.').at(-1).replace('[]', '');
    if (/refs?$/i.test(leaf)) {
      const target = rule.type === 'array' ? resolveLocal(schema, rule.items) : rule;
      inventory.referenceFields.push({ at, constrained: constrained(target), bounded: rule.type !== 'array' || Number.isInteger(rule.maxItems) });
    }
    if (/(raw|content|document|transcript|prompt|sourcecontext|fullcontext)/i.test(leaf) && !/refs?$/i.test(leaf)) inventory.broadFields.push(at);
  });
  return inventory;
}

function enumValues(rule) {
  if (!rule) return [];
  if (Object.hasOwn(rule, 'const')) return [rule.const];
  return rule.enum ?? [];
}

function canonicalOptions(inputSchema) {
  const properties = inputSchema.properties?.options?.properties ?? {};
  return Object.fromEntries(Object.entries(properties).map(([key, rule]) => {
    if (rule.enum) return [key, rule.enum[0]];
    if (rule.type === 'boolean') return [key, true];
    if (rule.type === 'number' || rule.type === 'integer') return [key, rule.minimum ?? 0];
    return [key, 'value'];
  }));
}

function canonicalInput(skillId, schema) {
  return {
    schemaVersion: 6,
    runId: 'harness-run',
    project: 'starci',
    selection: {
      analyzerVersion: 1,
      skillId,
      confidence: 'exact',
      mode: 'gated',
      activeInputRefs: ['request:harness'],
      passiveContextRefs: []
    },
    requestRef: 'request:harness',
    artifactRefs: Array.from({ length: schema.properties.artifactRefs.minItems ?? 0 }, (_, index) => `artifact:${index + 1}`),
    evidenceRefs: ['evidence:harness'],
    scope: {
      targetRefs: ['target:harness'],
      writeRoots: Array.from({ length: schema.properties.scope.properties?.writeRoots?.minItems ?? 0 }, (_, index) => `src-${index + 1}`),
      externalMutation: false,
      approvalRef: null
    },
    options: canonicalOptions(schema)
  };
}

function canonicalOutput(skillId, schema) {
  const branches = schema.allOf?.flatMap((item) => item.oneOf ?? []) ?? [];
  const branch = branches.find((item) => item.properties?.result?.const === 'complete') ?? branches[0];
  const result = branch?.properties?.result?.const;
  const finalState = branch?.properties?.finalState?.const;
  const stateRule = branch?.properties?.state?.properties ?? {};
  return {
    schemaVersion: 6,
    runId: 'harness-run',
    skillId,
    result,
    finalState,
    state: {
      status: stateRule.status?.const,
      code: stateRule.code?.const,
      retryable: stateRule.retryable?.const,
      terminalState: stateRule.terminalState?.const
    },
    handoffRef: result === 'handoff' ? 'session://tasks/harness-run/handoff.json' : null,
    receiptRefs: [`receipt:sha256:${'a'.repeat(64)}`],
    findings: [],
    cleanup: { scratchRefs: [], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' }
  };
}

function cleanlinessInput(schema, mutationPasses) {
  const i = schemaInventory(schema);
  const selection = schema.properties?.selection;
  const scope = schema.properties?.scope;
  const options = schema.properties?.options;
  const requiredEnvelope = ['schemaVersion', 'runId', 'project', 'selection', 'requestRef', 'artifactRefs', 'evidenceRefs', 'scope', 'options'];
  const architecture = requiredEnvelope.every((field) => schema.required?.includes(field) && schema.properties?.[field]);
  const referenceConstrained = i.referenceFields.filter((item) => item.constrained).length;
  const referenceBounded = i.referenceFields.filter((item) => item.bounded).length;
  let score = 0;
  score += schema.additionalProperties === false ? 10 : 0;
  score += ratioScore(i.closedObjects, i.objects, 10);
  score += architecture ? 10 : 0;
  score += i.broadFields.length === 0 ? 10 : 0;
  score += ratioScore(referenceConstrained, i.referenceFields.length, 15);
  score += ratioScore(referenceBounded, i.referenceFields.length, 5);
  score += ratioScore(i.boundedArrays, i.arrays, 10);
  score += selection?.additionalProperties === false && selection?.properties?.activeInputRefs && selection?.properties?.passiveContextRefs && JSON.stringify([...(selection?.properties?.mode?.enum ?? [])].sort()) === JSON.stringify(['bypass', 'gated']) ? 10 : 0;
  score += scope?.additionalProperties === false && ['targetRefs', 'writeRoots', 'externalMutation', 'approvalRef'].every((field) => scope.required?.includes(field)) ? 10 : 0;
  score += options?.additionalProperties === false && Object.keys(options?.properties ?? {}).length <= 3 ? 5 : 0;
  score += mutationPasses ? 10 : 0;
  const findings = [];
  if (referenceConstrained < i.referenceFields.length) findings.push(`${i.referenceFields.length - referenceConstrained} reference field(s) accept arbitrary text instead of a reference syntax`);
  if (referenceBounded < i.referenceFields.length) findings.push(`${i.referenceFields.length - referenceBounded} reference array(s) have no maximum cardinality`);
  if (i.boundedArrays < i.arrays) findings.push(`${i.arrays - i.boundedArrays} array field(s) are unbounded`);
  if (i.broadFields.length) findings.push(`embedded-context-shaped fields: ${i.broadFields.join(', ')}`);
  return { score: Math.min(100, score), findings, metrics: i };
}

function cleanlinessOutput(schema, mutationPasses) {
  const i = schemaInventory(schema);
  const properties = schema.properties ?? {};
  const result = properties.result;
  const finalState = properties.finalState;
  const state = properties.state;
  const receipts = properties.receiptRefs;
  const findingsRule = properties.findings;
  const cleanup = properties.cleanup;
  const correlated = Boolean(schema.oneOf || schema.anyOf || schema.if || (schema.allOf ?? []).some((item) => item.if || item.oneOf));
  const typedState = state?.type === 'object' && ['status', 'code', 'retryable'].every((field) => state.properties?.[field]) && Boolean(state.properties?.emits || state.properties?.terminalState);
  const typedFindings = findingsRule?.type === 'array' && findingsRule.items?.type === 'object' && Number.isInteger(findingsRule.maxItems);
  let score = 0;
  score += schema.additionalProperties === false ? 10 : 0;
  score += ratioScore(i.closedObjects, i.objects, 10);
  score += enumValues(result).length >= 1 ? 10 : 0;
  score += enumValues(finalState).length > 0 ? 10 : 0;
  score += typedState ? 20 : 0;
  score += correlated ? 10 : 0;
  score += receipts?.type === 'array' && receipts.uniqueItems === true && receipts.items?.type === 'string' ? 10 : 0;
  score += i.broadFields.length === 0 ? 10 : 0;
  score += typedFindings ? 5 : 0;
  score += cleanup?.type === 'object' && cleanup.properties?.purgeAt ? 5 : 0;
  score += mutationPasses ? 10 : 0;
  const findings = [];
  if (!enumValues(finalState).length) findings.push('finalState is free text and is not tied to a machine terminal');
  if (!typedState) findings.push('output has no typed state object with status/code/retryable/emits');
  if (!correlated) findings.push('result, finalState, receipts, and findings are not conditionally correlated');
  if (!typedFindings) findings.push('findings are unbounded free-form strings instead of bounded evidence-linked objects');
  if (!cleanup) findings.push('output does not declare terminal cleanup');
  return { score: Math.min(100, score), findings, metrics: i };
}

function conditionMatches(condition, envelope, input) {
  if (condition.stage !== undefined && envelope.stage !== condition.stage) return false;
  if (condition.status !== undefined && envelope.status !== condition.status) return false;
  if (condition.decision !== undefined && envelope.payload?.decision !== condition.decision) return false;
  const facts = new Set(envelope.facts ?? []);
  if ((condition.allFacts ?? []).some((fact) => !facts.has(fact))) return false;
  if ((condition.noneFacts ?? []).some((fact) => facts.has(fact))) return false;
  for (const [key, expected] of Object.entries(condition.inputEquals ?? {})) {
    const actual = key.split('.').reduce((value, part) => value?.[part], input);
    if (actual !== expected) return false;
  }
  for (const [key, expected] of Object.entries(condition.outputEquals ?? {})) {
    const actual = key.split('.').reduce((value, part) => value?.[part], envelope?.output);
    if (actual !== expected) return false;
  }
  return true;
}

function matchingEdges(state, envelope, input) {
  return (state.on ?? []).filter((edge) => conditionMatches(edge.when ?? {}, envelope, input));
}

function reachable(machine) {
  const seen = new Set();
  const queue = [machine.start];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of machine.states[id]?.on ?? []) queue.push(edge.target);
  }
  return seen;
}

function factCombinations(facts) {
  if (facts.length > 10) return [];
  return Array.from({ length: 2 ** facts.length }, (_, mask) => facts.filter((_, index) => mask & (1 << index)));
}

function ruleAtPath(schema, dottedPath) {
  let rule = schema;
  for (const part of dottedPath.split('.')) {
    rule = resolveLocal(schema, rule)?.properties?.[part];
    if (!rule) return undefined;
  }
  return resolveLocal(schema, rule);
}

function inputCombinations(state, inputSchema) {
  const entries = new Map();
  for (const edge of state.on ?? []) for (const [key, value] of Object.entries(edge.when?.inputEquals ?? {})) {
    if (!entries.has(key)) entries.set(key, new Set());
    entries.get(key).add(value);
  }
  let outputs = [{}];
  for (const [key, values] of entries) {
    const rule = ruleAtPath(inputSchema, key);
    const allowed = enumValues(rule);
    const candidates = allowed.length ? allowed : rule?.type === 'boolean' ? [false, true] : [...values];
    outputs = outputs.flatMap((base) => candidates.map((value) => {
      const next = clone(base);
      const parts = key.split('.');
      let owner = next;
      for (const part of parts.slice(0, -1)) owner = owner[part] ??= {};
      owner[parts.at(-1)] = value;
      return next;
    }));
  }
  return outputs;
}

function stronglyConnected(machine) {
  let index = 0;
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const groups = [];
  const visit = (id) => {
    indices.set(id, index); low.set(id, index); index += 1; stack.push(id); active.add(id);
    for (const edge of machine.states[id]?.on ?? []) {
      if (!indices.has(edge.target)) { visit(edge.target); low.set(id, Math.min(low.get(id), low.get(edge.target))); }
      else if (active.has(edge.target)) low.set(id, Math.min(low.get(id), indices.get(edge.target)));
    }
    if (low.get(id) === indices.get(id)) {
      const group = [];
      let current;
      do { current = stack.pop(); active.delete(current); group.push(current); } while (current !== id);
      const selfLoop = (machine.states[id]?.on ?? []).some((edge) => edge.target === id);
      if (group.length > 1 || selfLoop) groups.push(group);
    }
  };
  for (const id of Object.keys(machine.states)) if (!indices.has(id)) visit(id);
  return groups;
}

function machineIntegrity(machine, inputSchema, outputSchema) {
  const failures = [];
  const states = machine.states ?? {};
  if (machine.start !== 'analyze-input' || states[machine.start]?.kind !== 'analysis') failures.push('machine must start at analyze-input analysis');
  const reached = reachable(machine);
  const unreachable = Object.keys(states).filter((id) => !reached.has(id));
  if (unreachable.length) failures.push(`unreachable states: ${unreachable.join(', ')}`);
  const terminalResults = new Set(Object.values(states).filter((state) => state.kind === 'terminal').map((state) => state.result));
  const allowedResults = new Set(enumValues(outputSchema.properties?.result));
  for (const result of terminalResults) if (!allowedResults.has(result)) failures.push(`terminal result ${result} is absent from output schema`);

  for (const [id, state] of Object.entries(states)) {
    if (state.kind === 'analysis') {
      if (state.on?.length !== 1 || Object.keys(state.on[0].when ?? {}).length !== 0) failures.push(`${id}: analysis entry is not one unconditional edge`);
    }
    if (state.kind === 'operator') {
      const operatorDir = path.join(operatorsRoot, ...state.ref.split('/'));
      const manifest = readJson(path.join(operatorDir, 'operator.json'));
      const output = readJson(path.join(operatorDir, 'output.schema.json'));
      const decisions = enumValues(output.properties?.payload?.properties?.decision);
      const decisionEdges = state.on.filter((edge) => edge.when?.decision !== undefined);
      const outcomeEdges = state.on.filter((edge) => edge.when?.outputEquals?.outcome !== undefined);
      if (decisionEdges.length) {
        const routed = decisionEdges.map((edge) => edge.when.decision).sort();
        if (JSON.stringify(routed) !== JSON.stringify([...decisions].sort())) failures.push(`${id}: decision routes do not equal ${state.ref} outcomes`);
        for (const decision of decisions) if (matchingEdges(state, { payload: { decision }, facts: [] }, {}).length !== 1) failures.push(`${id}: decision ${decision} is ambiguous or uncovered`);
      } else if (outcomeEdges.length) {
        const outcomes = enumValues(output.properties?.output?.properties?.outcome);
        const routed = outcomeEdges.map((edge) => edge.when.outputEquals.outcome).sort();
        if (JSON.stringify(routed) !== JSON.stringify([...outcomes].sort())) failures.push(`${id}: typed output routes do not equal ${state.ref} outcomes`);
        for (const outcome of outcomes) if (matchingEdges(state, { output: { outcome }, facts: [] }, {}).length !== 1) failures.push(`${id}: output outcome ${outcome} is ambiguous or uncovered`);
      } else {
        const variants = [...new Set((manifest.emits ?? []).map((emit) => `${emit.stage}\u0000${emit.status}`))];
        const routed = state.on.map((edge) => `${edge.when?.stage ?? '*'}\u0000${edge.when?.status ?? '*'}`);
        for (const variant of variants) {
          const [stage, status] = variant.split('\u0000');
          if (matchingEdges(state, { stage, status, facts: [] }, {}).length !== 1) failures.push(`${id}: emitted ${stage}/${status} is ambiguous or uncovered`);
        }
        for (const route of routed) if (!variants.includes(route)) failures.push(`${id}: route ${route.replace('\u0000', '/')} is not emitted by ${state.ref}`);
      }
    }
    if (state.kind === 'choice') {
      const facts = [...new Set(state.on.flatMap((edge) => [...(edge.when?.allFacts ?? []), ...(edge.when?.noneFacts ?? [])]))];
      for (const factSet of factCombinations(facts)) for (const input of inputCombinations(state, inputSchema)) {
        const count = matchingEdges(state, { facts: factSet }, input).length;
        if (count !== 1) failures.push(`${id}: choice matched ${count} route(s) for facts [${factSet}]`);
      }
    }
    if (state.kind === 'wait') {
      if (!state.approval?.approve || !state.approval?.reject || state.on?.length < 2) failures.push(`${id}: approval wait lacks explicit approve/reject routes`);
      if (!state.approval?.bypassTarget || !state.on.some((edge) => edge.target === state.approval.bypassTarget)) failures.push(`${id}: approval wait lacks a declared bypass target`);
      for (const edge of state.on ?? []) if (matchingEdges(state, { ...edge.when, facts: edge.when?.allFacts ?? [] }, {}).length !== 1) failures.push(`${id}: wait route is ambiguous`);
    }
  }

  for (const group of stronglyConnected(machine)) {
    const members = new Set(group);
    const exits = group.flatMap((id) => states[id].on ?? []).filter((edge) => !members.has(edge.target));
    if (exits.length === 0) failures.push(`cycle has no exit: ${group.join(' -> ')}`);
  }

  const deductions = Math.min(100, failures.length * 10);
  return { score: 100 - deductions, findings: [...new Set(failures)] };
}

const stopWords = new Set('a an and are as at be before by do for from has have in into is it its of on one only or the this through to use when with without'.split(' '));
const tokenize = (text) => [...new Set(text.toLowerCase().replace(/[^a-z0-9-]+/g, ' ').split(/\s+/).filter((token) => token.length > 2 && !stopWords.has(token)))];

function routeScore(prompt, entry) {
  const [positive, negative = ''] = entry.description.split(/Do not use/i);
  const promptTokens = new Set(tokenize(prompt));
  const overlap = (text) => tokenize(text).filter((token) => promptTokens.has(token)).length;
  return overlap(positive) * 3 - overlap(negative) * 2 + overlap(entry.id.replace(/^starci-/, ''));
}

function routingAudit(catalog) {
  const outcomes = config.routingCases.map((testCase) => {
    const ranked = catalog.skills.map((entry) => ({ id: entry.id, score: routeScore(testCase.prompt, entry) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const expected = ranked.find((item) => item.id === testCase.expected);
    const pass = ranked[0].id === testCase.expected && expected.score > 0;
    return { ...testCase, pass, selected: ranked[0].id, expectedScore: expected.score, margin: expected.score - (ranked.find((item) => item.id !== testCase.expected)?.score ?? 0), top: ranked.slice(0, 3) };
  });
  return { score: Math.round(100 * outcomes.filter((item) => item.pass).length / outcomes.length), outcomes };
}

function textAudit() {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.endsWith('.md')) files.push(target);
    }
  };
  walk(skillsRoot); walk(operatorsRoot);
  const patterns = [
    { id: 'open-ended-context', re: /\b(?:relevant|necessary|appropriate) context\b/i },
    { id: 'open-ended-source', re: /\b(?:relevant|necessary|appropriate) (?:source|files?)\b/i },
    { id: 'vague-catchall', re: /\b(?:etc\.|and so on|whatever is needed|as needed)\b/i },
    { id: 'best-effort', re: /\b(?:best effort|probably|likely enough)\b/i },
    { id: 'implicit-inference', re: /\b(?:infer|assume)\b/i, allow: /\b(?:do not|never|cannot|must not|without)\b[^.\n]{0,120}\b(?:infer|assume)\b/i }
  ];
  const findings = [];
  let lines = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines += source.length;
    source.forEach((line, index) => {
      for (const pattern of patterns) if (pattern.re.test(line) && !pattern.allow?.test(line)) findings.push({ rule: pattern.id, file: path.relative(root, file).replaceAll('\\', '/'), line: index + 1, text: line.trim().slice(0, 180) });
    });
  }
  const density = findings.length / Math.max(1, lines / 1000);
  return { score: Math.max(0, Math.round(100 - density * 8)), files: files.length, lines, findings };
}

function loadIndependentCases() {
  const files = fs.readdirSync(harnessRoot).filter((name) => name.endsWith('-cases.json') && name !== 'cases.json').sort();
  const results = [];
  const errors = [];
  for (const name of files) {
    const value = readJson(path.join(harnessRoot, name));
    if (value.schemaVersion !== 1 || !Array.isArray(value.cases) || !value.summary) errors.push(`${name}: invalid report envelope`);
    for (const testCase of value.cases ?? []) {
      const required = ['id', 'targetType', 'target', 'scenario', 'inputRisks', 'expectedBehavior', 'forbiddenBehavior', 'verdict', 'findings', 'evidence'];
      if (!required.every((key) => Object.hasOwn(testCase, key))) errors.push(`${name}/${testCase.id ?? '?'}: missing required field`);
      if (!['pass', 'warning', 'fail'].includes(testCase.verdict)) errors.push(`${name}/${testCase.id ?? '?'}: invalid verdict`);
    }
    results.push({ file: name, ...value });
  }
  return { files, results, errors };
}

async function auditSkill(skillDir) {
  const id = path.basename(skillDir);
  const inputSchema = readJson(path.join(skillDir, 'input.schema.json'));
  const outputSchema = readJson(path.join(skillDir, 'output.schema.json'));
  const machine = readJson(path.join(skillDir, 'machine.json'));
  const inputModule = await import(`${pathToFileURL(path.join(skillDir, 'validate-input.mjs')).href}?harness=${Date.now()}-${id}`);
  const outputModule = await import(`${pathToFileURL(path.join(skillDir, 'validate-output.mjs')).href}?harness=${Date.now()}-${id}`);
  const input = canonicalInput(id, inputSchema);
  const output = canonicalOutput(id, outputSchema);
  const hardFailures = [];
  if (!inputModule.validateInput(input).valid) hardFailures.push('canonical input rejected');
  if (!outputModule.validateOutput(output).valid) hardFailures.push('canonical output rejected');

  const inputMutations = [
    Object.assign(clone(input), { rawSourceContext: 'copied source should be rejected' }),
    Object.assign(clone(input), { selection: { ...input.selection, skillId: 'starci-unknown' } }),
    Object.assign(clone(input), { selection: { ...input.selection, activeInputRefs: ['request:harness', 'request:harness'] } }),
    Object.assign(clone(input), { selection: { ...input.selection, passiveContextRefs: ['source://entire-repository'] } }),
    Object.assign(clone(input), { scope: { ...input.scope, writeRoots: ['/'] } }),
    Object.assign(clone(input), { scope: { ...input.scope, externalMutation: true, approvalRef: null } })
  ];
  const outputMutations = [
    Object.assign(clone(output), { rawContext: 'copied output context should be rejected' }),
    Object.assign(clone(output), { skillId: 'starci-unknown' }),
    Object.assign(clone(output), { receiptRefs: [output.receiptRefs[0], output.receiptRefs[0]] }),
    Object.assign(clone(output), { receiptRefs: ['invented:proof'] }),
    Object.assign(clone(output), { finalState: 'banana', state: { ...output.state, terminalState: 'banana' } })
  ];
  const acceptedInputMutations = inputMutations.flatMap((value, index) => inputModule.validateInput(value).valid ? [index] : []);
  const acceptedOutputMutations = outputMutations.flatMap((value, index) => outputModule.validateOutput(value).valid ? [index] : []);
  const inputMutationPasses = acceptedInputMutations.length === 0;
  const outputMutationPasses = acceptedOutputMutations.length === 0;
  if (!inputMutationPasses) hardFailures.push(`input validator accepted adversarial mutation(s): ${acceptedInputMutations.join(', ')}`);
  if (!outputMutationPasses) hardFailures.push(`output validator accepted adversarial mutation(s): ${acceptedOutputMutations.join(', ')}`);

  return {
    id,
    input: cleanlinessInput(inputSchema, inputMutationPasses),
    output: cleanlinessOutput(outputSchema, outputMutationPasses),
    machine: machineIntegrity(machine, inputSchema, outputSchema),
    hardFailures
  };
}

const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(skillsRoot, entry.name)).sort();
const skills = [];
for (const skillDir of skillDirs) skills.push(await auditSkill(skillDir));
const routing = routingAudit(readJson(path.join(skillsRoot, 'catalog.json')));
const text = textAudit();
const independent = loadIndependentCases();
const averages = {
  inputCleanliness: Math.round(skills.reduce((sum, item) => sum + item.input.score, 0) / skills.length),
  outputCleanliness: Math.round(skills.reduce((sum, item) => sum + item.output.score, 0) / skills.length),
  machineIntegrity: Math.round(skills.reduce((sum, item) => sum + item.machine.score, 0) / skills.length),
  routingDiscoverability: routing.score,
  textClarity: text.score
};
const hardFailures = [...skills.flatMap((item) => item.hardFailures.map((failure) => `${item.id}: ${failure}`)), ...independent.errors];
const belowTargets = Object.entries(config.targets).filter(([key, target]) => averages[key] < target).map(([key, target]) => `${key}: ${averages[key]} < ${target}`);
const report = {
  schemaVersion: 1,
  summary: { skillCount: skills.length, hardFailureCount: hardFailures.length, averages, targets: config.targets, belowTargets },
  skills,
  routing,
  text,
  independent,
  hardFailures
};

if (args.has('--write')) fs.writeFileSync(path.join(harnessRoot, 'skill-results.json'), `${JSON.stringify(report, null, 2)}\n`);

if (args.has('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log('Skill'.padEnd(40), 'Input', 'Output', 'Machine', 'Hard');
  for (const item of skills) console.log(item.id.padEnd(40), String(item.input.score).padStart(5), String(item.output.score).padStart(6), String(item.machine.score).padStart(7), String(item.hardFailures.length).padStart(4));
  console.log(`\nAverages: input ${averages.inputCleanliness}, output ${averages.outputCleanliness}, machine ${averages.machineIntegrity}, routing ${averages.routingDiscoverability}, text ${averages.textClarity}`);
  console.log(`Independent reports: ${independent.files.length}; hard failures: ${hardFailures.length}`);
  if (belowTargets.length) console.log(`Below target: ${belowTargets.join('; ')}`);
  if (hardFailures.length) console.log(`Hard failures:\n- ${hardFailures.join('\n- ')}`);
}

if (hardFailures.length) process.exitCode = 1;
else if (args.has('--enforce') && belowTargets.length) process.exitCode = 2;
