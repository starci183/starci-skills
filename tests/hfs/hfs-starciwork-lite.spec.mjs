import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkRepo, explainPath } from '../../scripts/hfs/check.mjs';
import { loadSlotManifest, openHfs } from '../../scripts/hfs/slots.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const app = (edition = 'lite') => ({
  hfs: 3, kind: 'app', project: 'demo', edition,
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const tree = (t, files = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-work-lite-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
};
const check = (repoRoot, files, edition = 'lite', options = {}) => checkRepo({ repoRoot, declaration: app(edition), files, tree: false, ...options });
const workFindings = (result) => result.findings.filter((finding) => finding.path?.startsWith('.starciwork'));

test('lite Work is optional without brand; a present brand tree requires only .gitignore', (t) => {
  const repoRoot = tree(t);
  const lite = openHfs({ declaration: app() });
  assert.equal(lite.slot('app.starciwork').presence, 'optional');
  assert.deepEqual(lite.slot('app.starciwork').requires, ['.gitignore']);
  assert.deepEqual(lite.slot('app.starciwork').allows, ['brand/**']);
  assert.equal(lite.slot('app.starciwork.uat'), null);
  assert.equal(lite.requiredPaths().paths.some((entry) => entry.path.startsWith('.starciwork')), false);
  assert.deepEqual(workFindings(check(repoRoot, [])), []);
  const brand = '.starciwork/brand/index.yaml';
  const missing = workFindings(check(repoRoot, [brand]));
  assert.deepEqual(missing.map((finding) => [finding.code, finding.path]), [['HFS_SLOT_REQUIRED_MISSING', '.starciwork/.gitignore']]);
  assert.deepEqual(workFindings(check(repoRoot, ['.starciwork/.gitignore', brand])), []);
  assert.deepEqual(workFindings(check(repoRoot, ['.starciwork/.gitignore'])), []);
});

test('lite Work admits brand drawings, evidence, references and assets at arbitrary depth', (t) => {
  const repoRoot = tree(t);
  const files = [
    '.starciwork/.gitignore', '.starciwork/brand/index.yaml',
    '.starciwork/brand/evidence.yaml', '.starciwork/brand/assets/refs/reference.webp',
    '.starciwork/brand/assets/refs/group/deeper/reference.webp',
    '.starciwork/brand/drawings/mobile/evidence/approval.yaml',
    '.starciwork/brand/shell/features/uat/br/_resources/reference.txt',
  ];
  assert.deepEqual(workFindings(check(repoRoot, files)), []);
  for (const input of files) {
    const explained = explainPath({ repoRoot, input, declaration: app() });
    assert.equal(explained.status, 'owned', input);
    assert.equal(explained.slot, 'app.starciwork', input);
  }
});

test('lite Work explanation admits brand directories and refuses a .gitignore directory', (t) => {
  const repoRoot = tree(t);
  for (const input of ['.starciwork/brand/', '.starciwork\\brand\\']) {
    assert.equal(explainPath({ repoRoot, input, declaration: app() }).status, 'owned', input);
  }
  for (const input of ['.starciwork/.gitignore/', '.starciwork\\.gitignore\\']) {
    const explained = explainPath({ repoRoot, input, declaration: app() });
    assert.equal(explained.status, 'forbidden', input);
    assert.equal(explained.code, 'HFS_STARCIWORK_LITE_FORBIDDEN', input);
  }
  fs.mkdirSync(path.join(repoRoot, '.starciwork', 'brand'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, '.starciwork', '.gitignore'));
  assert.equal(explainPath({ repoRoot, input: '.starciwork/brand', declaration: app() }).status, 'owned', 'an existing directory needs no trailing separator');
  const explained = explainPath({ repoRoot, input: '.starciwork/.gitignore', declaration: app() });
  assert.equal(explained.status, 'forbidden');
  assert.equal(explained.code, 'HFS_STARCIWORK_LITE_FORBIDDEN');
});

test('every other lite Work path reports the brand-only failure, including narrower slots', (t) => {
  const repoRoot = tree(t);
  const forbidden = [
    '.starciwork/workspace.yaml', '.starciwork/index.yaml',
    '.starciwork/shell/index.yaml', '.starciwork/features/system-health/index.yaml',
    '.starciwork/features/system-health/ui/card/assets/approved.webp',
    '.starciwork/_resources/identities/demo/resource.yaml',
    '.starciwork/uat/demo/index.yaml', '.starciwork/br/demo/index.yaml',
    '.starciwork/features/demo/uat/login/index.yaml',
    '.starciwork/features/demo/br/access/ac/granted/index.yaml',
    '.starciwork/other/reference.webp', '.starciwork/brandish/index.yaml',
    '.starciwork/.gitignore/extra.yaml', '.starciwork/worktrees/demo/index.yaml',
  ];
  assert.equal(openHfs({ declaration: app() }).classifyPath(forbidden.at(-1)).slot, 'app.worktrees', 'the narrower worktree slot must not bypass the lite boundary');
  const result = check(repoRoot, ['.starciwork/.gitignore', ...forbidden]);
  const findings = workFindings(result);
  assert.deepEqual(findings.map((finding) => [finding.path, finding.code]).sort(), forbidden.map((file) => [file, 'HFS_STARCIWORK_LITE_FORBIDDEN']).sort());
  for (const input of forbidden) {
    const explained = explainPath({ repoRoot, input, declaration: app() });
    assert.equal(explained.status, 'forbidden', input);
    assert.equal(explained.code, 'HFS_STARCIWORK_LITE_FORBIDDEN', input);
    assert.match(explained.message, /lite \.starciwork holds only brand\//);
    assert.ok(explained.titleVi && explained.whyVi, input);
  }
});

test('lite Work admission follows the slot manifest rather than a copied path list', (t) => {
  const repoRoot = tree(t);
  const document = parseYaml(fs.readFileSync(path.join(root, 'knowledge/hfs/slots.yaml'), 'utf8'));
  document.slots.find((slot) => slot.id === 'app.starciwork').lite.allows.push('migration.yaml');
  const manifest = loadSlotManifest({ text: JSON.stringify(document) });
  const files = ['.starciwork/.gitignore', '.starciwork/migration.yaml'];
  assert.equal(workFindings(check(repoRoot, files)).some((finding) => finding.code === 'HFS_STARCIWORK_LITE_FORBIDDEN'), true);
  assert.deepEqual(workFindings(check(repoRoot, files, 'lite', { manifest })), []);
});

test('lite Work also rejects ignored and untracked leftovers in the local tree', (t) => {
  const files = {
    '.starciwork/.gitignore': '/workspace.yaml\n/index.yaml\n/shell/\n/features/\n',
    '.starciwork/brand/index.yaml': {},
    '.starciwork/brand/assets/refs/reference.webp': 'image',
    '.starciwork/workspace.yaml': {}, '.starciwork/index.yaml': {},
    '.starciwork/shell/index.yaml': {}, '.starciwork/features/demo/index.yaml': {},
    '.starciwork/other/index.yaml': {},
  };
  const repoRoot = tree(t, files);
  execFileSync('git', ['-C', repoRoot, 'init', '-q'], { stdio: 'ignore' });
  execFileSync('git', ['-C', repoRoot, 'add', '--', '.starciwork/.gitignore', '.starciwork/brand'], { stdio: 'ignore' });
  const ignored = execFileSync('git', ['-C', repoRoot, 'ls-files', '--others', '--ignored', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/);
  assert.equal(ignored.length, 4, 'the fixture really hides the stale Work metadata from git');
  const result = checkRepo({ repoRoot, declaration: app() });
  const forbidden = workFindings(result).filter((finding) => finding.code === 'HFS_STARCIWORK_LITE_FORBIDDEN');
  assert.deepEqual(forbidden.map((finding) => finding.path).sort(), [
    '.starciwork/features', '.starciwork/index.yaml', '.starciwork/other', '.starciwork/shell', '.starciwork/workspace.yaml',
  ]);
  assert.equal(workFindings(result).some((finding) => finding.path.startsWith('.starciwork/brand')), false);
});

test('full Work retains workspace, index, shell, feature and UAT records and their proof checks', (t) => {
  const record = { repository: 'be', requiresProof: { unit: { required: true, command: 'node --test scripts/deleted.spec.mjs' } } };
  const files = {
    '.starciwork/.gitignore': '', '.starciwork/workspace.yaml': {}, '.starciwork/index.yaml': {},
    '.starciwork/shell/index.yaml': {}, '.starciwork/features/demo/index.yaml': {},
    '.starciwork/features/demo/impl/check/index.yaml': record,
    '.starciwork/features/demo/uat/login/index.yaml': {},
    '.starciwork/_resources/identities/demo/resource.yaml': {},
  };
  const repoRoot = tree(t, files);
  const full = openHfs({ declaration: app('full') });
  assert.equal(full.slot('app.starciwork').presence, 'required');
  assert.deepEqual(full.slot('app.starciwork').requires, ['.gitignore', 'workspace.yaml', 'index.yaml']);
  for (const file of Object.keys(files)) assert.equal(full.classifyPath(file).status, 'owned', file);
  const fullFindings = workFindings(check(repoRoot, Object.keys(files), 'full'));
  assert.deepEqual(fullFindings.map((finding) => [finding.code, finding.path, finding.missing]), [['HFS_PROOF_COMMAND_FILE_MISSING', '.starciwork/features/demo/impl/check/index.yaml', 'scripts/deleted.spec.mjs']]);
  const absent = workFindings(check(repoRoot, [], 'full'));
  assert.equal(absent.some((finding) => finding.code === 'HFS_SLOT_REQUIRED_MISSING'), true);
  const liteFindings = workFindings(check(repoRoot, Object.keys(files)));
  assert.equal(liteFindings.some((finding) => finding.code === 'HFS_PROOF_COMMAND_FILE_MISSING'), false, 'lite skips forbidden stale proof metadata');
  assert.equal(liteFindings.find((finding) => finding.path === '.starciwork/features/demo/impl/check/index.yaml')?.code, 'HFS_STARCIWORK_LITE_FORBIDDEN');
});
