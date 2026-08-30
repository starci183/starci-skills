import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('skills/catalog.json', root), 'utf8'));
const expected = [
  'starci-feature-deliver',
  'starci-business-process',
  'starci-architecture-design',
  'starci-backend-process',
  'starci-fe-process',
  'starci-quality-assure',
  'starci-uat-verify',
  'starci-release-manage',
  'starci-platform-operate',
  'starci-workspace-manage',
  'starci-git-publish',
  'starci-workflow-diagnose',
].sort();

test('public catalog is exactly the twelve v7 mission skills', () => {
  assert.equal(catalog.schemaVersion, 7);
  assert.equal(catalog.systemVersion, '7.2.0');
  assert.deepEqual(catalog.skills.map(({ id }) => id).sort(), expected);
  const directories = readdirSync(new URL('skills/', root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('starci-'))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(directories, expected);
});

test('selection law routes frontend work to one general FE process skill', () => {
  const selection = readFileSync(new URL('analyze-input.md', root), 'utf8');
  assert.match(selection, /audit Profile[\s\S]*`starci-fe-process`/i);
  assert.match(selection, /create page X[\s\S]*`starci-fe-process`/i);
  assert.match(selection, /Ask one focused question only when/i);
  assert.doesNotMatch(selection, /ui-ux-pro-max/i);
});

test('debug configuration is explicit and behavior-neutral', () => {
  const config = readFileSync(new URL('config.yaml', root), 'utf8');
  const index = readFileSync(new URL('INDEX.md', root), 'utf8');
  assert.match(config, /^version:\s*7\.2\.0$/m);
  assert.match(config, /^debug:\s*true$/m);
  assert.match(index, /Debug changes visibility only/i);
  assert.match(index, /Never persist or[\s\S]*display chain-of-thought/i);
});

test('v7 topology owns typed UAT and session evidence without an index layer', () => {
  const index = readFileSync(new URL('INDEX.md', root), 'utf8');
  assert.match(index, /uat\/[\s\S]*<feature>\/[\s\S]*<flow>\/[\s\S]*snapshot\.json[\s\S]*result\.json/);
  assert.match(index, /sessions\/[\s\S]*<session-id>\/[\s\S]*calls\.ndjson/);
  assert.match(index, /Qdrant.*not part/is);
});

test('scope is frozen before selection and remains multidimensional',()=>{
  const scope=readFileSync(new URL('scope.yaml',root),'utf8');
  const analysis=readFileSync(new URL('analyze-input.md',root),'utf8');
  assert.match(scope,/unclearAction:\s*ask-before-skill-selection/);
  assert.match(scope,/frontend\.ux-ui\.change-level/);
  assert.match(analysis,/ambiguityRefs[\s\S]*Skill input/i);
  assert.match(analysis,/one conditional part of scope/i);
});
