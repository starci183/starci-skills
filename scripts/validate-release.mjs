import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(message); };
const exists = (relative) => fs.existsSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const isTracked = (relative) => {
  if (!exists('.git')) return exists(relative);
  return execFileSync('git', ['-C', root, 'ls-files', '--', relative], { encoding: 'utf8' }).trim().length > 0;
};

for (const required of [
  'README.md', 'INDEX.md', 'analyze-input.md', 'analyze-input.schema.json', 'validate-analyze-input.mjs', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'package.json', 'skills', 'operators', 'orchestration', 'knowledge', 'requests/request.schema.json', 'requests/validate-requests.mjs', 'runtime/knowledge-runtime', 'scripts/knowledge-query.py'
]) {
  if (!exists(required)) fail(`release is missing ${required}`);
}

for (const retired of ['v6', 'operations', 'docs', 'platform', 'context-manifest.json', 'netlify.toml']) {
  if (isTracked(retired)) fail(`retired release path is still tracked: ${retired}`);
}

const packageJson = readJson('package.json');
if (packageJson.version !== '6.1.1') fail('package version must be 6.1.1');
if (packageJson.license !== 'MIT' || packageJson.private !== true) fail('release must declare MIT and remain private against accidental npm publish');
if (!packageJson.repository?.url?.includes('starci183/starci-skills')) fail('repository metadata is missing');

const skillRoot = path.join(root, 'skills');
const skills = fs.readdirSync(skillRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (skills.length < 45) fail(`release regressed below the v6.1 baseline of 45 skills: found ${skills.length}`);
for (const skill of skills) {
  if (!skill.startsWith('starci-')) fail(`skill lacks starci- prefix: ${skill}`);
  for (const required of ['SKILL.md', 'agents/openai.yaml', 'machine.json', 'input.schema.json', 'output.schema.json']) {
    if (!exists(path.join('skills', skill, required))) fail(`${skill} is missing ${required}`);
  }
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const operatorManifests = walk(path.join(root, 'operators')).filter((file) => path.basename(file) === 'operator.json');
if (operatorManifests.length < 121) fail(`release regressed below the v6.1 baseline of 121 operators: found ${operatorManifests.length}`);

const knowledgeFiles = walk(path.join(root, 'knowledge'))
  .filter((file) => file.endsWith('.md'));
if (knowledgeFiles.length < 70) fail(`expected at least 70 knowledge records, found ${knowledgeFiles.length}`);
const knowledgeIds = new Set(knowledgeFiles.map((file) => {
  const source = fs.readFileSync(file, 'utf8');
  return source.match(/^\|\s*Knowledge ID\s*\|\s*`([^`]+)`\s*\|/mi)?.[1];
}).filter(Boolean));
if (knowledgeIds.size !== knowledgeFiles.length) fail('knowledge files must have unique Knowledge ID rows');

for (const manifestFile of operatorManifests) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const knowledgeId of manifest.knowledgeRefs ?? []) {
    if (!knowledgeIds.has(knowledgeId)) fail(`${manifest.id} references missing knowledge ${knowledgeId}`);
  }
}

const releaseTextFiles = [
  path.join(root, 'INDEX.md'),
  path.join(root, 'analyze-input.md'),
  path.join(root, 'analyze-input.schema.json'),
  path.join(root, 'validate-analyze-input.mjs'),
  ...walk(path.join(root, 'skills')),
  ...walk(path.join(root, 'operators')),
  ...walk(path.join(root, 'orchestration')),
  ...walk(path.join(root, 'runtime')),
  ...walk(path.join(root, 'scripts'))
].filter((file) => /\.(?:md|mjs|py|json|yaml)$/.test(file));
for (const file of releaseTextFiles) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (/(^|\/)(?:en|vi|context)\.md$/.test(relative)) fail(`retired mirror/context file remains: ${relative}`);
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(`.claude/${'v6'}/`)) fail(`nested release path remains in ${relative}`);
}

console.log(`release valid: ${skills.length} skills, ${operatorManifests.length} operators, ${knowledgeIds.size} knowledge records`);
