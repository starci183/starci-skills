import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const releaseRoot = path.dirname(root);
const required = ['execute.md','input.md','input.schema.json','operator.json','output.md','output.schema.json','validate-input.mjs','validate-output.mjs'].sort();
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
const domains = fs.readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name);
const operatorDirs = domains.flatMap((domain) => fs.readdirSync(path.join(root, domain), { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => path.join(root, domain, item.name)));

const knowledgeIds = new Set(fs.readdirSync(path.join(releaseRoot, 'knowledge')).filter((name) => name.endsWith('.md')).map((name) => fs.readFileSync(path.join(releaseRoot, 'knowledge', name), 'utf8').match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi)?.[1]).filter(Boolean));
const sourceRefs = new Set(readJson(path.join(releaseRoot, 'knowledge', 'references', 'catalog.json')).references.map((item) => item.id));

for (const directory of operatorDirs) {
  const relative = path.relative(root, directory).replaceAll('\\', '/');
  const names = fs.readdirSync(directory).sort();
  if (JSON.stringify(names) !== JSON.stringify(required)) fail(`${relative}: expected exact 8-file operator contract`);
  const manifest = readJson(path.join(directory, 'operator.json'));
  if (manifest.id !== relative || manifest.domain !== relative.split('/')[0] || manifest.schemaVersion !== 6) fail(`${relative}: operator identity drift`);
  if (manifest.inputSchema !== 'input.schema.json' || manifest.outputSchema !== 'output.schema.json') fail(`${relative}: schema binding drift`);
  for (const direction of ['input','output']) {
    const schema = readJson(path.join(directory, `${direction}.schema.json`));
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail(`${relative}: ${direction} schema is not Draft 2020-12`);
    if (!closedRoot(schema, schema)) fail(`${relative}: ${direction} schema root must be a closed object`);
  }
  const inputSchema = readJson(path.join(directory, 'input.schema.json'));
  const outputSchema = readJson(path.join(directory, 'output.schema.json'));
  const inputPayload = inputSchema.properties?.payload?.properties;
  for (const field of ['provided','loads','session']) if (!inputPayload?.[field]) fail(`${relative}: input payload must declare ${field}`);
  if (inputPayload?.session?.properties?.retention?.const !== 'until-skill-terminal') fail(`${relative}: input session retention must end at the parent skill terminal`);
  const outputPayload = outputSchema.properties?.payload?.properties;
  for (const field of ['decision','state','produced','context','cleanup','evidenceRefs','findings']) if (!outputPayload?.[field]) fail(`${relative}: output payload must declare ${field}`);
  for (const field of ['status','code','retryable','emits']) if (!outputPayload?.state?.properties?.[field]) fail(`${relative}: output state must declare ${field}`);
  if (outputPayload?.cleanup?.properties?.retention?.const !== 'until-skill-terminal' || outputPayload?.cleanup?.properties?.purgeAt?.const !== 'skill-terminal') {
    fail(`${relative}: output cleanup must purge session intermediates at the parent skill terminal`);
  }
  for (const ref of manifest.knowledgeRefs ?? []) if (!knowledgeIds.has(ref)) fail(`${relative}: missing Qdrant knowledge ${ref}`);
  for (const ref of manifest.sourceReferenceRefs ?? []) if (!sourceRefs.has(ref)) fail(`${relative}: missing source reference ${ref}`);
  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  if (!execute.includes('## LOADS') || !/\|\s*Alias\s*\|\s*Target\s*\|\s*Kind\s*\|\s*Why\s*\|/i.test(execute)) fail(`${relative}: missing typed LOADS table`);
  if ((execute.match(/^## Step\s+\d+/gmi) ?? []).length < 2) fail(`${relative}: execute.md needs operator-specific numbered steps`);
  for (const marker of ['**Read:**','**Context:**','**Session write:**','**Stop:**']) if (!execute.includes(marker)) fail(`${relative}: execute.md is missing ${marker}`);
  if (!/orchestrat/i.test(execute)) fail(`${relative}: execute.md must declare orchestration behavior`);
  const inputDoc = fs.readFileSync(path.join(directory, 'input.md'), 'utf8');
  if (!inputDoc.includes('## JSON architecture') || !/provided/i.test(inputDoc) || !/load/i.test(inputDoc)) fail(`${relative}: input.md must explain provided and runtime-loaded JSON sections`);
  const outputDoc = fs.readFileSync(path.join(directory, 'output.md'), 'utf8');
  if (!outputDoc.includes('## JSON architecture') || !/state/i.test(outputDoc) || !/skill-terminal/i.test(outputDoc)) fail(`${relative}: output.md must explain state and terminal cleanup`);
  const completeContract = [execute,inputDoc,outputDoc,JSON.stringify(inputSchema),JSON.stringify(outputSchema)].join('\n');
  for (const forbidden of ['@source-context','source-qdrant','/<role>/<project>/','.worktrees/runs/']) if (completeContract.includes(forbidden)) fail(`${relative}: forbidden broad or persistent context token ${forbidden}`);
  const loadedKnowledge = [...execute.matchAll(/^\|\s*`@[^`]+`\s*\|\s*`([^`]+)`\s*\|\s*qdrant\s*\|/gmi)].map((match) => match[1]).sort();
  if (JSON.stringify(loadedKnowledge) !== JSON.stringify([...(manifest.knowledgeRefs ?? [])].sort())) fail(`${relative}: LOADS/Qdrant knowledgeRefs drift`);
  const input = await import(`${pathToFileURL(path.join(directory, 'validate-input.mjs')).href}?validate=${Date.now()}`);
  const output = await import(`${pathToFileURL(path.join(directory, 'validate-output.mjs')).href}?validate=${Date.now()}`);
  if (typeof input.validateInput !== 'function' || typeof output.validateOutput !== 'function') fail(`${relative}: validators must export validateInput/validateOutput`);
  for (const [label, result] of [['input', input.validateInput({ unexpected: true })], ['output', output.validateOutput({ unexpected: true })]]) {
    if ((result?.valid ?? result?.ok) !== false) fail(`${relative}: ${label} validator accepted junk`);
  }
}

console.log(`operators valid: ${operatorDirs.length} hand-authored contracts across ${domains.length} domains`);
