import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { walkFiles } from '../../scripts/lib/walk.mjs';
import { isProductPath, isLiteProductPath, starciworkGitignoreText } from '../../scripts/lib/starciwork-boundary.mjs';
import { isLiteWorkRoot, liteWorkForbiddenPaths, workPathAllowed } from '../../scripts/lib/work-edition.mjs';
import { loadRecords, readWorkspace } from '../../scripts/work/record-ownership.mjs';
import { indexFilesUnder, workRootOf } from '../../scripts/work/work-io.mjs';
import { layoutTreeMain, readShellRecord } from '../../scripts/work/layout-tree.mjs';
import { layoutRenderMain } from '../../scripts/work/layout-render.mjs';
import { composeDirectionMain } from '../../scripts/work/compose-direction.mjs';
import { checkShellConformance, productLocaleOf, shellBindingFindings } from '../../scripts/work/ui/shell-conformance.mjs';
import { scanTargets } from '../../scripts/work/brand/brand-palette.mjs';
import { readBrandRecord } from '../../scripts/work/brand/brand.mjs';
import { workGraphContext } from '../../scripts/work/work-graph-context.mjs';
import { renderProofProblems } from '../../scripts/work/render-proof.mjs';

const fixture = (t, edition = 'lite') => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-lite-readers-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(repo, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', edition }));
  return { repo, work: path.join(repo, '.starciwork') };
};
const write = (work, rel, text) => {
  const file = path.join(work, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};
const seed = ({ work }) => {
  const workspace = { schema: 'work/workspace@1', id: 'lite-app', project: 'lite-app', description: 'A lite fixture app.', repositories: [{ name: 'web', role: 'fe' }] };
  const workspaceFile = write(work, 'workspace.yaml', stringifyYaml(workspace));
  const brand = { schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', brand: { identity: { name: 'Lite' }, voice: { locales: [{ locale: 'vi', default: true }] }, sources: [{ path: 'brand/assets/refs/reference.webp' }] } };
  const brandFile = write(work, 'brand/index.yaml', stringifyYaml(brand));
  write(work, 'brand/assets/refs/reference.webp', Buffer.from('brand reference bytes'));
  const forbidden = [
    write(work, 'index.yaml', 'schema: work/catalog@1\nid: catalog\n'),
    write(work, 'shell/index.yaml', 'schema: work/layout-tree@1\nid: shell\nproductLocale: {default: en}\n'),
    write(work, 'features/login/index.yaml', 'schema: work/feature@1\nid: feature.login\n'),
    write(work, 'features/login/fr/sign-in/index.yaml', 'schema: work/functional-requirement@1\nid: fr.login.sign-in\n'),
  ];
  return { workspace, workspaceFile, brand, brandFile, forbidden };
};

test('lite Work readers never open stale full metadata and retain brand records, references and assets', async t => {
  const p = fixture(t);
  const { workspace, workspaceFile, brand, brandFile, forbidden } = seed(p);
  const read = fs.readFileSync;
  const forbiddenReads = [];
  t.mock.method(fs, 'readFileSync', function(file, ...args) {
    if (forbidden.includes(String(file))) forbiddenReads.push(String(file));
    return read.call(this, file, ...args);
  });
  assert.deepEqual(readWorkspace(p.work), workspace);
  assert.equal(workPathAllowed(p.work, workspaceFile), true);
  assert.equal(readShellRecord(p.work), null);
  assert.deepEqual([...loadRecords(p.work, walkFiles).keys()].sort(), ['brand', 'lite-app']);
  assert.deepEqual(indexFilesUnder(p.work), [brandFile]);
  assert.deepEqual(indexFilesUnder(path.join(p.work, 'features')), []);
  assert.deepEqual(workGraphContext(p.repo, ['login']), { frs: [], shapes: [] });
  assert.deepEqual(await scanTargets(p.work), []);
  assert.deepEqual(shellBindingFindings(p.work), []);
  assert.equal(checkShellConformance(p.work).ok, true);
  assert.equal(checkShellConformance(p.work).skipped, true);
  assert.equal(productLocaleOf(p.work).locale, 'vi');
  assert.deepEqual(readBrandRecord(p.work).brand, brand.brand);
  assert.deepEqual(readBrandRecord(p.repo).brand, brand.brand);
  assert.equal(fs.readFileSync(path.join(p.work, 'brand/assets/refs/reference.webp'), 'utf8'), 'brand reference bytes');
  assert.deepEqual(forbiddenReads, []);
});

test('lite workspace identity supports root detection and frontend render-proof role mapping', t => {
  const p = fixture(t);
  seed(p);
  const workspaceDoc = readWorkspace(p.work);
  assert.equal(workRootOf(path.join(p.work, 'brand', 'assets', 'refs')), p.work);
  assert.equal(workspaceDoc.project, 'lite-app');
  const rec = { schema: 'work/implementation@1', dir: path.join(p.repo, 'fe'), data: { repository: 'web' } };
  assert.ok(renderProofProblems({ rec, records: new Map(), workspaceDoc, workRoot: p.work })
    .some(problem => problem.includes('[RENDER_UI_INPUT_MISSING]')), 'a repository named web is recognized by its fe role');
  assert.deepEqual(renderProofProblems({ rec: { ...rec, data: { repository: 'service' } }, records: new Map(), workspaceDoc, workRoot: p.work }), []);
});

test('a forbidden nested workspace cannot bypass the enclosing lite Work boundary', t => {
  const p = fixture(t);
  seed(p);
  const task = path.join(p.work, 'features', 'task');
  write(task, 'workspace.yaml', 'schema: work/workspace@1\nid: stale-task\n');
  write(task, 'index.yaml', 'bad: [\n');
  const reads = [];
  for (const method of ['readFileSync', 'readdirSync']) {
    const original = fs[method];
    t.mock.method(fs, method, function(file, ...args) {
      if (String(file) === task || String(file).startsWith(`${task}${path.sep}`)) reads.push(String(file));
      return original.call(this, file, ...args);
    });
  }
  assert.equal(workRootOf(task), p.work);
  assert.equal(workRootOf(path.join(task, 'nested')), p.work);
  assert.deepEqual(indexFilesUnder(task), []);
  assert.deepEqual(reads, [], 'forbidden workspace and index bytes and their directory are never read');
});

test('root detection retains full and custom workspaces and the worktrees escape boundary', t => {
  const p = fixture(t, 'full');
  const nested = path.join(p.work, 'features', 'task');
  write(nested, 'workspace.yaml', 'schema: work/workspace@1\nid: nested\n');
  assert.equal(workRootOf(path.join(nested, 'record')), nested);
  const custom = path.join(p.repo, 'custom');
  write(custom, 'workspace.yaml', 'schema: work/workspace@1\nid: custom\n');
  assert.equal(workRootOf(path.join(custom, 'record')), custom);
  const worktree = path.join(p.work, 'worktrees', 'workflow', 'operation');
  assert.equal(workRootOf(worktree), null);
  write(worktree, 'workspace.yaml', 'schema: work/workspace@1\nid: operation\n');
  assert.equal(workRootOf(path.join(worktree, 'record')), worktree);
});

test('lite shell commands skip absent Work without creating a shell or any other Work file', async t => {
  const p = fixture(t);
  for (const command of ['scan', 'plan', 'capture', 'destinations', 'lockup']) {
    const result = layoutTreeMain([command, '--work', p.work, '--node', '/', '--files', 'layout,page', '--write', '--json']);
    assert.equal(result.exitCode, 0, result.text);
    assert.equal(JSON.parse(result.text).skipped, true);
  }
  const render = await layoutRenderMain(['--work', p.work, '--node', '/', '--breakpoint', 'desktop', '--theme', 'light', '--write', '--json']);
  assert.equal(render.exitCode, 0, render.text);
  assert.equal(JSON.parse(render.text).skipped, true);
  const compose = composeDirectionMain(['--ui', path.join(p.work, 'features/login/ui/sign-in'), '--content', 'absent.png', '--breakpoint', 'desktop', '--theme', 'light', '--json']);
  assert.equal(compose.exitCode, 0, compose.text);
  assert.equal(JSON.parse(compose.text).skipped, true);
  assert.equal(fs.existsSync(p.work), false);
});

test('lite path boundary covers empty forbidden directories and permits workspace identity and brand layout', t => {
  const p = fixture(t);
  write(p.work, '.gitignore', '/*\n!/brand/\n');
  write(p.work, 'brand/assets/refs/reference.webp', 'reference');
  write(p.work, '.gitattributes', '*.yaml text\n');
  write(p.work, 'workspace.yaml', 'schema: work/workspace@1\n');
  fs.mkdirSync(path.join(p.work, '_resources'));
  fs.mkdirSync(path.join(p.work, 'br'));
  assert.equal(isLiteWorkRoot(p.work), true);
  assert.equal(isLiteProductPath('brand/assets/refs/reference.webp'), true);
  assert.equal(isLiteProductPath('.gitignore'), true);
  assert.equal(isLiteProductPath('workspace.yaml'), true);
  assert.equal(isLiteProductPath('workspace.yaml', { dir: true }), false);
  assert.equal(starciworkGitignoreText({ edition: 'lite' }), fs.readFileSync(path.join(import.meta.dirname, '../../packages/hfs/templates/app/starciwork.gitignore-lite'), 'utf8').trimEnd() + '\n');
  assert.match(starciworkGitignoreText({ edition: 'lite' }), /!\/workspace\.yaml/);
  assert.doesNotMatch(starciworkGitignoreText({ edition: 'lite' }), /!\/shell\/|!\/features\//);
  assert.equal(isLiteProductPath('shell/index.yaml'), false);
  assert.equal(isProductPath('shell/index.yaml'), true, 'full product boundary is unchanged');
  assert.equal(workPathAllowed(p.work, path.join(p.repo, 'local-environment.yaml')), true, 'external files remain readable');
  assert.deepEqual(liteWorkForbiddenPaths(p.work).map(file => path.basename(file)).sort(), ['.gitattributes', '_resources', 'br']);
});

test('full Work readers retain workspace, shell, feature and graph context behavior', t => {
  const p = fixture(t, 'full');
  const { forbidden } = seed(p);
  assert.equal(readWorkspace(p.work).repositories[0].name, 'web');
  assert.equal(readShellRecord(p.work).record.id, 'shell');
  assert.ok(indexFilesUnder(p.work).includes(forbidden[1]));
  assert.ok(indexFilesUnder(p.work).includes(forbidden[0]));
  assert.ok(loadRecords(p.work, walkFiles).has('feature.login'));
  assert.deepEqual(workGraphContext(p.repo, ['login']), { frs: ['fr.login.sign-in'], shapes: [] });
  assert.deepEqual(liteWorkForbiddenPaths(p.work), []);
});
