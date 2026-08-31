import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditOperatorRoot } from '../operators/contract-v7.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolve = (relative) => path.join(root, relative);
const exists = (relative) => fs.existsSync(resolve(relative));
const read = (relative) => fs.readFileSync(resolve(relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const fail = (message) => { throw new Error(message); };
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

for (const required of [
  'INDEX.md', 'config.yaml', 'scope.yaml', 'analyze-input.md', 'analyze-input.schema.json',
  'request-vocabulary.md', 'skills/catalog.json', 'skills/machine.schema.json',
  'runtime/config.schema.json', 'runtime/receipt.schema.json', 'runtime/topology.schema.json',
  'runtime/contracts/grammar-decision.schema.json', 'runtime/contracts/grammar-decision.mjs',
  'knowledge/grammar/common/semantic-composition.md', 'operators/fe-grammar-v74.spec.mjs',
  'templates/businesses/business.schema.json', 'templates/uat/snapshot.schema.json',
  'templates/uat/result.schema.json', 'templates/sessions/call-receipt.schema.json',
  'templates/debts/debt.schema.json', 'tests/v7-skill-selection.spec.mjs',
]) {
  if (!exists(required)) fail(`release is missing ${required}`);
}

const packageJson = json('package.json');
const catalog = json('skills/catalog.json');
const expectedSkills = [
  'starci-feature-deliver', 'starci-business-process', 'starci-architecture-design',
  'starci-backend-process', 'starci-fe-process', 'starci-quality-assure',
  'starci-content-generate',
  'starci-uat-verify', 'starci-release-manage', 'starci-platform-operate',
  'starci-workspace-manage', 'starci-git-publish', 'starci-workflow-diagnose',
].sort();
const publicSkills = fs.readdirSync(resolve('skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('starci-'))
  .map((entry) => entry.name)
  .sort();

if (packageJson.version !== '7.5.0-alpha.1' || catalog.systemVersion !== packageJson.version) {
  fail('package and catalog must agree on version 7.5.0-alpha.1');
}
if (catalog.schemaVersion !== 7) fail('catalog must use schemaVersion 7');
if (JSON.stringify(publicSkills) !== JSON.stringify(expectedSkills)) {
  fail(`public skill directories differ from the thirteen v7 mission skills: ${publicSkills.join(', ')}`);
}
if (JSON.stringify(catalog.skills.map(({ id }) => id).sort()) !== JSON.stringify(expectedSkills)) {
  fail('catalog is not exactly the thirteen public v7 mission skills');
}
for (const skill of publicSkills) {
  for (const required of ['SKILL.md', 'agents/openai.yaml', 'machine.json', 'input.schema.json', 'output.schema.json']) {
    if (!exists(path.join('skills', skill, required))) fail(`${skill} is missing ${required}`);
  }
  if (json(path.join('skills', skill, 'machine.json')).schemaVersion !== 7) {
    fail(`${skill} is not a v7 machine`);
  }
  const inputSchema = json(path.join('skills', skill, 'input.schema.json'));
  if (!inputSchema.required?.includes('scope')) fail(`${skill} does not require mission scope`);
}

const config = read('config.yaml');
if (!/^version:\s*7\.5\.0-alpha\.1$/m.test(config) || !/^grammarContractVersion:\s*7\.4\.0$/m.test(config) || !/^debug:\s*true$/m.test(config)) {
  fail('config.yaml must enable the v7.5.0-alpha.1 debug trace');
}
for (const required of [
  'aiBrainstormModel: gpt-5.6-sol',
  'aiBrainstormCount: 1',
  'aiBrainstormIsolation: fresh',
  'aiBrainstormForkTurns: none',
  'visualReviewModel: gpt-5.6-sol',
  'visualReviewCount: 1',
  'visualReviewIsolation: fresh',
  'visualReviewForkTurns: none',
  'visualReviewNoProgressLimit: 3',
]) if (!config.includes(required)) fail(`config.yaml is missing v7.5-alpha AI boundary: ${required}`);
const index = read('INDEX.md');
for (const required of [
  '(context + input) -> typed output', 'CALL child', 'RETURN', 'RESUME exact parent state',
  'Debug changes visibility only', 'one dominant direction',
  'scope.yaml',
  '.worktrees/uat/<feature>/<flow>/', '.worktrees/sessions/<session-id>/',
]) {
  if (!index.includes(required)) fail(`INDEX.md is missing v7 law: ${required}`);
}

for (const retired of [
  'tests/skill-harness', 'uat', 'scripts/build-frontend-coding-context.mjs',
  'operators/fe/product-uat', 'operators/test/flow-coverage-audit',
  'operators/test/behavior-audit', 'operators/test/ux-audit', 'operators/test/ui-audit',
  'knowledge/platform-source-index.md', 'knowledge/platform-mcp-publication.md',
]) {
  if (exists(retired)) fail(`retired v6 path remains active: ${retired}`);
}

const operatorAudit = auditOperatorRoot(resolve('operators'));
if (operatorAudit.remaining > 0) {
  fail(`${operatorAudit.remaining} of ${operatorAudit.total} operators violate the strict v7 contract`);
}
if (operatorAudit.total < 140) fail(`operator coverage unexpectedly fell to ${operatorAudit.total}`);

const operatorManifests = walk(resolve('operators')).filter((file) => path.basename(file) === 'operator.json');
const knowledgeFiles = walk(resolve('knowledge')).filter((file) => file.endsWith('.md'));
const knowledgeIds = new Set(knowledgeFiles.map((file) => {
  const match = fs.readFileSync(file, 'utf8').match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi);
  return match?.[1];
}).filter(Boolean));
if (knowledgeIds.size !== knowledgeFiles.length) fail('knowledge records need unique Knowledge ID rows');
for (const manifestFile of operatorManifests) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const contextId of manifest.contextRefs ?? []) {
    if (!knowledgeIds.has(contextId)) fail(`${manifest.id} references missing context ${contextId}`);
  }
}

const sitePackage = json('sites/skills/package.json');
const siteCatalog = json('sites/skills/src/catalog.generated.json');
if (sitePackage.version !== packageJson.version || siteCatalog.version !== packageJson.version) {
  fail('site and runtime versions differ');
}
if (siteCatalog.skills?.length !== 13) fail('generated site must expose exactly thirteen Skills');

console.log(`release valid: 13 mission skills, ${operatorAudit.total} atomic operators, ${knowledgeIds.size} knowledge records`);
