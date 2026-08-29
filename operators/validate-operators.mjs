import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { operatorV7Issues } from './contract-v7.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const releaseRoot = path.dirname(root);
const required = ['execute.md','input.md','input.schema.json','operator.json','output.md','output.schema.json','validate-input.mjs','validate-output.mjs'].sort();
const allowedContracts = [required, [...required, 'icon.svg'].sort()];
const fail = (message) => { throw new Error(message); };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
function closedRoot(rule, schema, seen = new Set()) {
  if (!rule || typeof rule !== 'object') return false;
  if (rule.$ref?.startsWith('#/')) {
    if (seen.has(rule.$ref)) return false;
    const target = rule.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
    return closedRoot(target, schema, new Set([...seen, rule.$ref]));
  }
  if (Array.isArray(rule.oneOf)) return rule.oneOf.length > 0 && rule.oneOf.every((item) => closedRoot(item, schema, seen));
  if (Array.isArray(rule.anyOf)) return rule.anyOf.length > 0 && rule.anyOf.every((item) => closedRoot(item, schema, seen));
  if (rule.type === 'object' && rule.additionalProperties === false) return true;
  return Array.isArray(rule.allOf) && rule.allOf.some((item) => closedRoot(item, schema, seen));
}
function resolveLocalRule(rule, schema, seen = new Set(), context = 'schema') {
  if (!rule?.$ref?.startsWith('#/')) return rule;
  if (seen.has(rule.$ref)) fail(`${context}: cyclic local schema reference ${rule.$ref}`);
  const target = rule.$ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
  if (!target) fail(`${context}: missing local schema reference ${rule.$ref}`);
  return resolveLocalRule(target, schema, new Set([...seen, rule.$ref]), context);
}
const domains = fs.readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name);
const operatorDirs = domains.flatMap((domain) => fs.readdirSync(path.join(root, domain), { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => path.join(root, domain, item.name)));

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}
const contextIds = new Set(walkFiles(path.join(releaseRoot, 'knowledge')).filter((file) => file.endsWith('.md')).map((file) => fs.readFileSync(file, 'utf8').match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi)?.[1]).filter(Boolean));
const sourceRefs = new Set(readJson(path.join(releaseRoot, 'knowledge', 'references', 'catalog.json')).references.map((item) => item.id));

function collectStrings(value, found = new Set()) {
  if (typeof value === 'string') found.add(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, found);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, found);
  return found;
}

for (const directory of operatorDirs) {
  const relative = path.relative(root, directory).replaceAll('\\', '/');
  const names = fs.readdirSync(directory).sort();
  if (!allowedContracts.some((contract) => JSON.stringify(names) === JSON.stringify(contract))) fail(`${relative}: expected the exact 8-file operator contract plus optional icon.svg`);
  const manifest = readJson(path.join(directory, 'operator.json'));
  if (manifest.id !== relative || manifest.domain !== relative.split('/')[0] || ![6, 7].includes(manifest.schemaVersion)) fail(`${relative}: operator identity drift`);
  if (manifest.inputSchema !== 'input.schema.json' || manifest.outputSchema !== 'output.schema.json') fail(`${relative}: schema binding drift`);
  for (const direction of ['input','output']) {
    const schema = readJson(path.join(directory, `${direction}.schema.json`));
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail(`${relative}: ${direction} schema is not Draft 2020-12`);
    if (!closedRoot(schema, schema)) fail(`${relative}: ${direction} schema root must be a closed object`);
  }
  const inputSchema = readJson(path.join(directory, 'input.schema.json'));
  const outputSchema = readJson(path.join(directory, 'output.schema.json'));
  if (manifest.schemaVersion === 7) {
    const issues = operatorV7Issues({ manifest, inputSchema, outputSchema });
    if (issues.length) fail(`${relative}: invalid v7 operator contract: ${issues.join('; ')}`);
  } else {
    const inputPayload = resolveLocalRule(inputSchema.properties?.payload, inputSchema, new Set(), `${relative} input payload`)?.properties;
    for (const field of ['provided','loads','session']) if (!inputPayload?.[field]) fail(`${relative}: input payload must declare ${field}`);
    const inputSession = resolveLocalRule(inputPayload?.session, inputSchema, new Set(), `${relative} input session`);
    if (inputSession?.properties?.retention?.const !== 'until-skill-terminal') fail(`${relative}: input session retention must end at the parent skill terminal`);
    const outputPayload = resolveLocalRule(outputSchema.properties?.payload, outputSchema, new Set(), `${relative} output payload`)?.properties;
    for (const field of ['decision','state','produced','context','cleanup','evidenceRefs','findings']) if (!outputPayload?.[field]) fail(`${relative}: output payload must declare ${field}`);
    const outputState = resolveLocalRule(outputPayload?.state, outputSchema, new Set(), `${relative} output state`);
    const outputCleanup = resolveLocalRule(outputPayload?.cleanup, outputSchema, new Set(), `${relative} output cleanup`);
    for (const field of ['status','code','retryable','emits']) if (!outputState?.properties?.[field]) fail(`${relative}: output state must declare ${field}`);
    const retention = outputCleanup?.properties?.retention?.const;
    const purgeAt = outputCleanup?.properties?.purgeAt?.const;
    const legacyCleanup = retention === 'until-skill-terminal' && purgeAt === 'skill-terminal';
    const acknowledgedHandoff = retention === 'until-consumer-ack' && purgeAt === 'consumer-ack';
    if (!legacyCleanup && !acknowledgedHandoff) fail(`${relative}: output cleanup must use skill-terminal cleanup or an acknowledged handoff`);
  }
  for (const ref of manifest.contextRefs ?? []) if (!contextIds.has(ref)) fail(`${relative}: missing default-search context ${ref}`);
  for (const ref of manifest.sourceReferenceRefs ?? []) if (!sourceRefs.has(ref)) fail(`${relative}: missing source reference ${ref}`);
  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  if (/^## LOADS\s*$/mi.test(execute) || /\|\s*Alias\s*\|\s*Target\s*\|\s*Kind\s*\|\s*Why\s*\|/i.test(execute)) {
    fail(`${relative}: execute.md duplicates the passive input contract in a LOADS table`);
  }
  const inputDoc = fs.readFileSync(path.join(directory, 'input.md'), 'utf8');
  const outputDoc = fs.readFileSync(path.join(directory, 'output.md'), 'utf8');
  if (manifest.schemaVersion === 7) {
    for (const field of Object.keys(inputSchema.properties.context.properties)) {
      if (!inputDoc.includes(`context.${field}`)) fail(`${relative}: input.md must explain context.${field}`);
    }
    for (const field of Object.keys(inputSchema.properties.input.properties)) {
      if (!inputDoc.includes(`input.${field}`)) fail(`${relative}: input.md must explain input.${field}`);
    }
    for (const field of Object.keys(outputSchema.properties.output.properties)) {
      if (!outputDoc.includes(`output.${field}`)) fail(`${relative}: output.md must explain output.${field}`);
    }
  } else {
    if ((execute.match(/^## Step\s+\d+/gmi) ?? []).length < 2) fail(`${relative}: execute.md needs operator-specific numbered steps`);
    for (const marker of ['**Read:**','**Context:**','**Session write:**','**Stop:**']) if (!execute.includes(marker)) fail(`${relative}: execute.md is missing ${marker}`);
    if (!/orchestrat/i.test(execute)) fail(`${relative}: execute.md must declare orchestration behavior`);
    if (!inputDoc.includes('## JSON architecture') || !/provided/i.test(inputDoc) || !/load/i.test(inputDoc)) fail(`${relative}: input.md must explain provided and runtime-loaded JSON sections`);
    if (!outputDoc.includes('## JSON architecture') || !/state/i.test(outputDoc) || !/skill-terminal/i.test(outputDoc)) fail(`${relative}: output.md must explain state and terminal cleanup`);
  }
  const completeContract = [execute,inputDoc,outputDoc,JSON.stringify(inputSchema),JSON.stringify(outputSchema)].join('\n');
  for (const forbidden of ['@source-context','source-default-search','/<role>/<project>/','.worktrees/runs/']) if (completeContract.includes(forbidden)) fail(`${relative}: forbidden broad or persistent context token ${forbidden}`);
  const schemaContext = [...collectStrings(inputSchema)].filter((value) => contextIds.has(value)).sort();
  const manifestContext = [...(manifest.contextRefs ?? [])].sort();
  if (JSON.stringify(schemaContext) !== JSON.stringify(manifestContext)) {
    fail(`${relative}: input-schema/contextRefs drift; schema=${JSON.stringify(schemaContext)}, manifest=${JSON.stringify(manifestContext)}`);
  }
  const input = await import(`${pathToFileURL(path.join(directory, 'validate-input.mjs')).href}?validate=${Date.now()}`);
  const output = await import(`${pathToFileURL(path.join(directory, 'validate-output.mjs')).href}?validate=${Date.now()}`);
  if (typeof input.validateInput !== 'function' || typeof output.validateOutput !== 'function') fail(`${relative}: validators must export validateInput/validateOutput`);
  for (const [label, result] of [['input', input.validateInput({ unexpected: true })], ['output', output.validateOutput({ unexpected: true })]]) {
    if ((result?.valid ?? result?.ok) !== false) fail(`${relative}: ${label} validator accepted junk`);
  }
}

console.log(`operators valid: ${operatorDirs.length} hand-authored contracts across ${domains.length} domains`);
