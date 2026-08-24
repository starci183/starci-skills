import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const v6Root = path.dirname(root);
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

const knowledgeIds = new Set(fs.readdirSync(path.join(v6Root, 'knowledge')).filter((name) => name.endsWith('.md')).map((name) => fs.readFileSync(path.join(v6Root, 'knowledge', name), 'utf8').match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi)?.[1]).filter(Boolean));
const sourceRefs = new Set(readJson(path.join(v6Root, 'knowledge', 'references', 'catalog.json')).references.map((item) => item.id));

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
  for (const ref of manifest.knowledgeRefs ?? []) if (!knowledgeIds.has(ref)) fail(`${relative}: missing Qdrant knowledge ${ref}`);
  for (const ref of manifest.sourceReferenceRefs ?? []) if (!sourceRefs.has(ref)) fail(`${relative}: missing source reference ${ref}`);
  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  if (!execute.includes('## LOADS') || !/\|\s*Alias\s*\|\s*Target\s*\|\s*Kind\s*\|\s*Why\s*\|/i.test(execute)) fail(`${relative}: missing V5-style LOADS table`);
  const loadedKnowledge = [...execute.matchAll(/^\|\s*`@[^`]+`\s*\|\s*`([^`]+)`\s*\|\s*qdrant\s*\|/gmi)].map((match) => match[1]).sort();
  if (JSON.stringify(loadedKnowledge) !== JSON.stringify([...(manifest.knowledgeRefs ?? [])].sort())) fail(`${relative}: LOADS/Qdrant knowledgeRefs drift`);
  const input = await import(`${pathToFileURL(path.join(directory, 'validate-input.mjs')).href}?validate=${Date.now()}`);
  const output = await import(`${pathToFileURL(path.join(directory, 'validate-output.mjs')).href}?validate=${Date.now()}`);
  if (typeof input.validateInput !== 'function' || typeof output.validateOutput !== 'function') fail(`${relative}: validators must export validateInput/validateOutput`);
  for (const [label, result] of [['input', input.validateInput({ unexpected: true })], ['output', output.validateOutput({ unexpected: true })]]) {
    if ((result?.valid ?? result?.ok) !== false) fail(`${relative}: ${label} validator accepted junk`);
  }
}

console.log(`V6 operators valid: ${operatorDirs.length} operators across ${domains.length} domains.`);
