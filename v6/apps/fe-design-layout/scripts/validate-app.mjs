import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultGraphPath, guardsEqual, readJson } from './route-app.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const v6Root = path.resolve(scriptDir, '..', '..', '..');
const operationRoot = path.resolve(v6Root, 'operations');
const requiredFiles = ['execute.md', 'input.md', 'input.schema.json', 'operation.json', 'output.md', 'output.schema.json', 'validate-input.mjs', 'validate-output.mjs'];
const operationSpecs = [
  { name: 'preflight', directory: 'fe/preflight', domain: 'fe' },
  { name: 'customer-journey', directory: 'fe/customer-journey', domain: 'fe' },
  { name: 'page-model', directory: 'fe/page-model', domain: 'fe' },
  { name: 'state', directory: 'fe/state', domain: 'fe' },
  { name: 'layout', directory: 'fe/layout', domain: 'fe' },
  { name: 'grammar-convergence', directory: 'fe/grammar-convergence', domain: 'fe' },
  { name: 'source-fit', directory: 'fe/source-fit', domain: 'fe' },
  { name: 'principle-compile', directory: 'fe/principle-compile', domain: 'fe' },
  { name: 'request-emission', directory: 'fe/request-emission', domain: 'fe' },
  { name: 'implementation', directory: 'fe/implementation', domain: 'fe' },
  { name: 'product-seed', directory: 'fe/product-seed', domain: 'fe' },
  { name: 'unit-test', directory: 'test/unit', domain: 'test' },
  { name: 'e2e-test', directory: 'test/e2e', domain: 'test' },
  { name: 'ui-test', directory: 'test/ui', domain: 'test' },
  { name: 'product-proof', directory: 'fe/product-proof', domain: 'fe' }
];
const expectedOperations = operationSpecs.map((item) => item.name);

function fail(message) {
  throw new Error(message);
}

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
  if (Array.isArray(rule.allOf)) return rule.allOf.some((item) => closedRoot(item, schema, seen));
  return false;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const allFiles = walk(v6Root);
for (const file of allFiles.filter((item) => item.endsWith('.json'))) readJson(file);

const forbiddenPaths = allFiles.filter((file) => {
  const relative = path.relative(v6Root, file).replaceAll('\\', '/').toLowerCase();
  return /(^|\/)(en|vi)\.md$/.test(relative) || /(^|\/)(context|contexts)(\/|$)/.test(relative);
});
if (forbiddenPaths.length) fail(`Forbidden V6 language/context files: ${forbiddenPaths.join(', ')}`);

const missingOperations = operationSpecs.filter((item) => !fs.existsSync(path.join(operationRoot, item.directory))).map((item) => item.name);
if (missingOperations.length) {
  fail(`Missing FE app operations: ${missingOperations.join(', ')}`);
}

const graph = readJson(defaultGraphPath);
if (JSON.stringify(Object.keys(graph.nodes).sort()) !== JSON.stringify([...expectedOperations].sort())) {
  fail('Graph node set does not equal the FE operation set');
}

const knowledgeIds = new Set(
  allFiles
    .filter((file) => path.dirname(file) === path.resolve(v6Root, 'knowledge') && file.endsWith('.md'))
    .map((file) => fs.readFileSync(file, 'utf8').match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi)?.[1])
    .filter(Boolean)
);
const sourceCatalog = readJson(path.join(v6Root, 'knowledge', 'references', 'catalog.json'));
const sourceReferenceIds = new Set(sourceCatalog.references.map((item) => item.id));

for (const spec of operationSpecs) {
  const { name } = spec;
  const directory = path.join(operationRoot, spec.directory);
  const entries = fs.readdirSync(directory).sort();
  if (JSON.stringify(entries) !== JSON.stringify(requiredFiles)) {
    fail(`${name} must contain exactly ${requiredFiles.join(', ')}`);
  }
  for (const markdown of ['input.md', 'output.md', 'execute.md']) {
    if (fs.readFileSync(path.join(directory, markdown), 'utf8').trim().length < 40) {
      fail(`${name}/${markdown} is empty or too small`);
    }
  }
  const operation = readJson(path.join(directory, 'operation.json'));
  const inputSchema = readJson(path.join(directory, 'input.schema.json'));
  const outputSchema = readJson(path.join(directory, 'output.schema.json'));
  for (const [direction, schema] of [['input', inputSchema], ['output', outputSchema]]) {
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail(`${name}/${direction}.schema.json must use JSON Schema 2020-12`);
    if (!closedRoot(schema, schema)) fail(`${name}/${direction}.schema.json must close every root object branch`);
  }
  if (operation.schemaVersion !== 6 || operation.domain !== spec.domain) fail(`${name} must declare operation domain=${spec.domain} at schemaVersion 6`);
  if (operation.inputSchema !== 'input.schema.json' || operation.outputSchema !== 'output.schema.json') fail(`${name} must bind separate JSON input/output schemas`);
  if (!Array.isArray(operation.accepts) || operation.accepts.length === 0) fail(`${name} has no accepts guards`);
  const knowledgeRefs = operation.knowledgeRefs ?? [];
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.some((ref) => typeof ref !== 'string')) fail(`${name} has invalid knowledgeRefs`);
  for (const ref of knowledgeRefs) if (!knowledgeIds.has(ref)) fail(`${name} references missing Qdrant knowledge ${ref}`);
  const sourceRefs = operation.sourceReferenceRefs ?? [];
  if (!Array.isArray(sourceRefs) || sourceRefs.some((ref) => !sourceReferenceIds.has(ref))) fail(`${name} has an unknown sourceReferenceRef`);

  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  const qdrantImports = [...execute.matchAll(/^\|\s*`(@[^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*qdrant\s*\|/gmi)]
    .map((match) => match[2]);
  if (JSON.stringify([...qdrantImports].sort()) !== JSON.stringify([...knowledgeRefs].sort())) {
    fail(`${name} LOADS table does not mirror operation.json knowledgeRefs`);
  }

  const inputModule = await import(pathToFileURL(path.join(directory, 'validate-input.mjs')).href);
  const outputModule = await import(pathToFileURL(path.join(directory, 'validate-output.mjs')).href);
  if (typeof inputModule.validateInput !== 'function') fail(`${name}/validate-input.mjs must export validateInput`);
  if (typeof outputModule.validateOutput !== 'function') fail(`${name}/validate-output.mjs must export validateOutput`);
  const junk = { unexpected: 'must-not-cross-operation-boundary' };
  const inputJunk = inputModule.validateInput(junk);
  const outputJunk = outputModule.validateOutput(junk);
  if ((inputJunk?.valid ?? inputJunk?.ok) !== false) fail(`${name} input validator accepted junk`);
  if ((outputJunk?.valid ?? outputJunk?.ok) !== false) fail(`${name} output validator accepted junk`);
  for (const ref of sourceRefs) {
    if (!execute.includes(`knowledge/references/${ref}.json`)) fail(`${name} LOADS table is missing source reference ${ref}`);
  }

  const appGuards = graph.routes
    .filter((route) => route.target.kind === 'operation' && route.target.ref === name)
    .map((route) => route.when);
  const operationGuards = operation.accepts;
  for (const guard of appGuards) {
    if (!operationGuards.some((candidate) => guardsEqual(candidate, guard))) fail(`${name} is missing an app route guard`);
  }
  for (const guard of operationGuards) {
    if (!appGuards.some((candidate) => guardsEqual(candidate, guard))) fail(`${name} declares an orphan accepts guard`);
  }
}

const waits = graph.routes.filter((route) => route.target.kind === 'wait').map((route) => route.target.ref).sort();
if (JSON.stringify(waits) !== JSON.stringify(['flow-approval', 'layout-approval'])) {
  fail(`Expected exactly the two creative approval waits, found: ${waits.join(', ')}`);
}

const forbiddenTerm = allFiles
  .filter((file) => /\.(md|json)$/.test(file))
  .find((file) => /hard[ -]cases?/i.test(fs.readFileSync(file, 'utf8')));
if (forbiddenTerm) fail(`Forbidden complex-case terminology found in: ${forbiddenTerm}`);

console.log(`V6 FE app valid: ${expectedOperations.length} operations, ${graph.routes.length} deterministic routes, 2 approval waits.`);
