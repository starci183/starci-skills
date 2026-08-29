import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const claudeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtimeRoot = path.join(claudeRoot, 'runtime');
for (const retiredRuntime of ['knowledge-runtime', 'reference-context']) {
  const target = path.join(runtimeRoot, retiredRuntime);
  if (!target.startsWith(`${runtimeRoot}${path.sep}`)) throw new Error(`unsafe retired runtime target: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const manifests = walk(path.join(claudeRoot, 'operators'))
  .filter((file) => path.basename(file) === 'operator.json');

for (const file of manifests) {
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.schemaVersion !== 6 || !Object.hasOwn(manifest, 'knowledgeRefs')) continue;
  manifest.contextRefs = manifest.knowledgeRefs;
  delete manifest.knowledgeRefs;
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

const proseRoots = ['operators', 'skills', 'knowledge'].map((name) => path.join(claudeRoot, name));
const proseFiles = proseRoots.flatMap(walk).filter((file) => file.endsWith('.md'));
for (const file of proseFiles) {
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .replaceAll('qdrant-exact', 'default-search')
    .replaceAll('Qdrant-indexed', 'default-search-resolved')
    .replaceAll('Qdrant knowledge', 'default-search context')
    .replaceAll('Qdrant records', 'canonical context records')
    .replaceAll('Qdrant record', 'canonical context record')
    .replaceAll('Qdrant summaries', 'default-search candidates')
    .replaceAll('Qdrant hit', 'default-search hit')
    .replaceAll('Qdrant bodies', 'context bodies')
    .replaceAll('Qdrant retrieval', 'default search')
    .replaceAll('Qdrant partition', 'default-search root')
    .replaceAll('Qdrant virtual root', 'reference checkout root')
    .replaceAll('Qdrant is', 'Default search is')
    .replaceAll('Qdrant only', 'Default search only')
    .replaceAll('through Qdrant', 'through default search')
    .replaceAll('from Qdrant', 'with default search');
  if (after !== before) fs.writeFileSync(file, after);
}

const schemaAndFixtureRoots = [
  path.join(claudeRoot, 'operators'),
  path.join(claudeRoot, 'skills'),
  path.join(claudeRoot, 'knowledge'),
  path.join(claudeRoot, 'tests'),
  path.join(claudeRoot, 'scripts'),
  path.join(claudeRoot, 'sites', 'skills')
];
for (const file of schemaAndFixtureRoots.flatMap(walk)) {
  if (!/\.(?:json|mjs|md|tsx|yaml)$/.test(file)) continue;
  if (file.endsWith('contract-v7.mjs') || file.endsWith('contract-v7.spec.mjs') || file.endsWith('validate-release.mjs')) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .replaceAll('knowledgeRefs', 'contextRefs')
    .replaceAll('qdrant-exact', 'default-search')
    .replaceAll('qdrant-knowledge', 'default-search-context')
    .replaceAll('Qdrant', 'default search')
    .replaceAll('qdrant', 'default-search');
  if (after !== before) fs.writeFileSync(file, after);
}

const selectionCasesFile = path.join(claudeRoot, 'tests', 'skill-harness', 'cases.json');
const selectionCases = JSON.parse(fs.readFileSync(selectionCasesFile, 'utf8'));
selectionCases.routingCases = selectionCases.routingCases.filter((item) => item.id !== 'source-index');
fs.writeFileSync(selectionCasesFile, `${JSON.stringify(selectionCases, null, 2)}\n`);

const qualityCasesFile = path.join(claudeRoot, 'tests', 'skill-harness', 'quality-delivery-cases.json');
const qualityCases = JSON.parse(fs.readFileSync(qualityCasesFile, 'utf8'));
qualityCases.cases = qualityCases.cases.filter((item) => item.id !== 'platform-source-index-invalid-document-state');
qualityCases.summary.pass = qualityCases.cases.filter((item) => item.verdict === 'pass').length;
qualityCases.summary.warning = qualityCases.cases.filter((item) => item.verdict === 'warning').length;
qualityCases.summary.fail = qualityCases.cases.filter((item) => item.verdict === 'fail').length;
qualityCases.summary.topRisks = qualityCases.summary.topRisks.filter((item) => !item.includes('platform/source-index'));
fs.writeFileSync(qualityCasesFile, `${JSON.stringify(qualityCases, null, 2)}\n`);

console.log(`migrated ${manifests.length} operator manifests to contextRefs and default-search bindings`);
