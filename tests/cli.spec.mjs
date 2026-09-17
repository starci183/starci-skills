import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init as install } from '../bin/starci-skills.mjs';
import { node as writeNode, resource, mutateJSON, mutateNode, json } from '../fixtures/build-workspace.mjs';

const cli = fileURLToPath(new URL('../cli/main.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
const runIn = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

// `install()` copies the whole payload and rebuilds .dist (~6s). Several tests only need a
// freshly-installed root to spawn or import the relocated CLI from; none of them assert anything
// about the *process* of installing. Build the payload once here and clone the (path-independent,
// verified-relocatable) result per test with fs.cpSync, which is roughly an order of magnitude
// cheaper than re-running the installer. Tests that assert on install()'s own return value/log
// output still call install() directly.
let installedBaseDir = null;
before(() => {
  installedBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-cli-installed-base-'));
  install({ dir: installedBaseDir, bootstrap: true }, () => {});
});
after(() => {
  if (installedBaseDir) fs.rmSync(installedBaseDir, { recursive: true, force: true });
});
function installInto(root) {
  fs.cpSync(installedBaseDir, root, { recursive: true });
}
function snapshot(root) {
  const result = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const stat = fs.lstatSync(target);
      result.push({ path: path.relative(root, target), type: stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'link' : 'file',
        hash: stat.isFile() ? crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') : null, mtime: stat.mtimeMs });
      if (stat.isDirectory()) walk(target);
    }
  }
  walk(root);
  return result;
}

test('init creates only a fresh minimal root and refuses all existing roots without mutation', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  const created = run('init', root, '--id', 'workspace:test');
  assert.equal(created.status, 0, created.stderr);
  assert.deepEqual(fs.readdirSync(root).sort(), ['.gitignore', '_schema', 'workspace.yaml']);
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(root, 'workspace.yaml'), 'utf8')), { schema: 'work/workspace@1', id: 'workspace:test' });
  const before = snapshot(parent);
  assert.equal(run('init', root, '--id', 'replacement').status, 1);
  assert.deepEqual(snapshot(parent), before);
  const empty = path.join(parent, 'existing-empty');
  fs.mkdirSync(empty);
  assert.equal(run('init', empty, '--id', 'replacement').status, 1);
  assert.deepEqual(fs.readdirSync(empty), []);
});

test('read-only validate and tree do not create requests, responses, runs, or metadata updates', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'workspace:test').status, 0);
  const before = snapshot(parent);
  for (const command of ['validate', 'tree']) {
    const result = run(command, root);
    assert.equal(result.status, 0, `${command}: ${result.stderr}\n${result.stdout}`);
    assert.deepEqual(snapshot(parent), before, `${command} mutated workspace`);
  }
});

test('agent-route exposes the first ready external worker for Orca without executing it',()=>{
  const selected=run('agent-route','starci','interface.implement','codex,claude,qwen');
  assert.equal(selected.status,0,selected.stderr);
  const result=JSON.parse(selected.stdout);
  assert.equal(result.selected.target,'qwen-agent');
  assert.equal(result.selected.model,'qwen3.8-flash');
  const fallback=run('agent-route','starci','interface.implement','claude');
  assert.equal(fallback.status,0,fallback.stderr);
  const fallbackResult=JSON.parse(fallback.stdout);
  assert.equal(fallbackResult.selected.target,'claude-agent');
  assert.deepEqual(fallbackResult.skipped.map(x=>x.target),['qwen-agent','devin-agent']);
  const exhausted=run('agent-route','starci','business.decide','qwen');
  assert.equal(exhausted.status,0,exhausted.stderr);
  assert.equal(JSON.parse(exhausted.stdout).selected,null);
  // A decide chain is three links - Fable, the Codex window's reasoning model and the Claude pool - and Qwen
  // is in none of them.
  assert.equal(JSON.parse(exhausted.stdout).skipped.length,3);
});

test('legacy audit inventories credentials without echoing values and does not execute scripts', t => {
  const root = temporary(t);
  fs.mkdirSync(path.join(root, 'uat'));
  fs.writeFileSync(path.join(root, 'uat', 'accounts.dev.json'), '{"password":"SYNTHETIC_SECRET_NEVER_ECHO"}');
  fs.writeFileSync(path.join(root, 'uat', 'seed.mjs'), 'throw new Error("SYNTHETIC_SCRIPT_NEVER_EXECUTE")');
  fs.writeFileSync(path.join(root, 'uat', 'screen.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  fs.writeFileSync(path.join(root, 'uat', 'secret.png'), 'SYNTHETIC_IMAGE_NAMED_SECRET');
  const before = snapshot(root);
  const result = run('audit-legacy', root);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes('SYNTHETIC_'));
  const data = JSON.parse(result.stdout);
  assert.equal(data.readOnly, true);
  assert.equal(data.importedVerdicts, false);
  assert.equal(data.entries.find(item => item.path.endsWith('accounts.dev.json')).contentInspected, false);
  assert.equal(data.entries.find(item => item.path.endsWith('secret.png')).sha256, undefined);
  assert.match(data.entries.find(item => item.path.endsWith('screen.png')).sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(snapshot(root), before);
});

test('legacy audit never follows junctions or symlinks to external content', t => {
  const parent = temporary(t);
  const root = path.join(parent, 'legacy');
  const outside = path.join(parent, 'outside');
  fs.mkdirSync(root); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'private.txt'), 'SYNTHETIC_OUTSIDE_SECRET');
  fs.symlinkSync(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = run('audit-legacy', root);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).entries, [{ path: 'escape', type: 'link', followed: false }]);
  assert.equal(run('audit-legacy', path.join(root, 'escape')).status, 1);
});

test('--help names every command of the one entry, the forwarded kernel commands included', () => {
  const help = run('--help');
  assert.equal(help.status, 0, help.stderr);
  // `bin/starci.mjs` forwards these to the kernel launcher before this module is loaded, so nothing here
  // answers them - but the one command line a person types is `starci <command>`, and a help page that names
  // only half of it teaches the wrong entry. One line each, so a reader can copy the one they need.
  const forwarded = ['workflow-goal', 'workflow-amend', 'workflow-approve', 'workflow-answer', 'workflow-run', 'workflow-retry', 'workflow-status',
    'workflow-tail', 'workflow-ops', 'workflow-list', 'workflow-stop', 'workflow-lane-close', 'workflow-supervise', 'workflow-inputs', 'journal-prune', 'journal-retire',
    'start-op', 'settle', 'sweep', 'notify', 'report', 'wait', 'verify'];
  const lines = help.stdout.split('\n').map(line => line.trim());
  for (const command of forwarded) assert.ok(lines.some(line => line.startsWith(`starci ${command} `) || line === `starci ${command}`), command);
  // The checks the CLI itself owns stay on the same page, named the same way.
  assert.ok(lines.some(line => line.startsWith('starci brand check ')), 'brand check');
  // Every forwarded name is a command the entry really forwards; a help page may not invent one.
  const entry = fs.readFileSync(new URL('../bin/starci.mjs', import.meta.url), 'utf8');
  const declared = JSON.parse(entry.match(/const LAUNCHER_COMMANDS=(\[[\s\S]*?\])/)[1].replaceAll("'", '"').replace(/,\s*\]/, ']'));
  assert.deepEqual([...forwarded].sort(), [...declared].sort());
});

test('argument errors cannot silently execute other commands', t => {
  const root = temporary(t);
  const before = snapshot(root);
  for (const args of [['cook'], ['init', path.join(root, '.starciwork')], ['init', path.join(root, '.starciwork'), '--id', '../escape'], ['validate', root, '--write'], ['audit-legacy', root, '--import'], ['op', '../CONTRACT.md'], ['impact', root], ['impact', root, 'node', '--cook']]) {
    const result = run(...args);
    assert.equal(result.status, 1, args.join(' '));
  }
  assert.deepEqual(snapshot(root), before);
});

test('impact follows canonical typed graph without including an unrelated sibling or modifying data', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'impact-fixture').status, 0);
  resource(root, 'art', 'design', { purpose: 'Synthetic shared desired direction' });
  const family = writeNode(root, 'family', { id: 'family' });
  mutateNode(family, value => { delete value.state; });
  writeNode(root, 'family/ui', { id: 'ui', refs: ['art'] });
  writeNode(root, 'family/backend', { id: 'backend' });
  writeNode(root, 'uat', { id: 'uat', dependsOn: ['ui'] });
  writeNode(root, 'branch-consumer', { id: 'branch-consumer', refs: ['family'] });
  const before = snapshot(parent);
  const response = run('impact', root, 'art');
  assert.equal(response.status, 0, response.stderr + response.stdout);
  const result = JSON.parse(response.stdout);
  assert.equal(result.target.id, 'art');
  assert.equal(result.target.type, 'resource');
  assert.deepEqual(result.affected.map(item => item.id).sort(), ['branch-consumer', 'family', 'uat', 'ui']);
  const ui = result.affected.find(item => item.id === 'ui');
  assert.equal(ui.direct, true);
  assert.ok(ui.reasons.includes('reference'));
  assert.ok(ui.via.includes('art'));
  assert.ok(result.affected.find(item => item.id === 'family').reasons.includes('child-input'));
  assert.equal(result.affected.find(item => item.id === 'uat').direct, false);
  const branch = run('impact', root, 'family');
  assert.equal(branch.status, 0, branch.stderr + branch.stdout);
  assert.ok(JSON.parse(branch.stdout).affected.some(item => item.id === 'backend' && item.reasons.includes('ancestor-spec')));
  const unknown = run('impact', root, 'missing');
  assert.equal(unknown.status, 1);
  assert.ok(JSON.parse(unknown.stdout).errors.some(item => item.code === 'MISSING_TARGET'));
  assert.deepEqual(snapshot(parent), before);
});

test('impact refuses malformed graph and never echoes secret-bearing resource values', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'impact-invalid').status, 0);
  resource(root, 'actor', 'identity', { password: 'SYNTHETIC_IMPACT_SECRET_NEVER_ECHO' });
  writeNode(root, 'piece', { refs: ['actor'], dependsOn: ['missing'] });
  const before = snapshot(parent);
  const result = run('impact', root, 'actor');
  assert.equal(result.status, 1);
  assert.ok(!`${result.stdout}${result.stderr}`.includes('SYNTHETIC_IMPACT_SECRET_NEVER_ECHO'));
  assert.deepEqual(snapshot(parent), before);
});

test('impact terminates with a structured cycle error instead of treating a dependency loop as executable', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'impact-cycle').status, 0);
  writeNode(root, 'first', { id: 'first', dependsOn: ['second'] });
  writeNode(root, 'second', { id: 'second', dependsOn: ['first'] });
  const before = snapshot(parent);
  const result = spawnSync(process.execPath, [cli, 'impact', root, 'first'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 1, result.stderr);
  assert.ok(JSON.parse(result.stdout).errors.some(item => item.code === 'CYCLE'));
  assert.deepEqual(snapshot(parent), before);
});

test('catalogue and op commands show contracts but do not execute or mutate workspace', async t => {
  const root = temporary(t);
  installInto(root);
  const relocatedCLI = path.join(root, '.claude/cli/main.mjs');
  const invoke = (...args) => spawnSync(process.execPath, [relocatedCLI, ...args], { encoding: 'utf8', cwd: root, windowsHide: true });
  const beforeSnapshot = snapshot(root);
  // One real process spawn proves the relocated file executes as a script (shebang, no top-level
  // throw, real argv/exit-code plumbing). Every op after that goes through the exact same relocated
  // module's exported `main()` in-process: same catalogue()/readOperatorDocument() resolution
  // (import.meta.url-relative to the relocated file, so relocation is still fully exercised), just
  // without paying for 21 extra Node process spawns to prove the identical dispatch path each time.
  const list = invoke('ops');
  assert.equal(list.status, 0, list.stderr);
  const catalog = JSON.parse(list.stdout);
  assert.ok(catalog.ops.some(op => op.id === 'workspace.manage'));
  const { main: relocatedMain } = await import(pathToFileURL(relocatedCLI).href);
  for (const op of catalog.ops) {
    let stdout = '';
    const io = { out: value => { stdout += value; }, err: value => { stdout += value; } };
    const status = await relocatedMain(['op', op.id], io);
    assert.equal(status, 0, `${op.id}: ${stdout}`);
    assert.match(stdout, /Contract display only/);
    assert.match(stdout, /nothing has executed/);
    assert.ok(stdout.length > 1000, `${op.id} contract missing`);
  }
  assert.deepEqual(snapshot(root), beforeSnapshot);
});

test('invalid-workspace CLI reports failure without rewriting evidence or exposing credential values', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'workspace:test').status, 0);
  fs.mkdirSync(path.join(root, '_resources', 'identities', 'actor'), { recursive: true });
  fs.writeFileSync(path.join(root, '_resources', 'identities', 'actor', 'resource.yaml'), JSON.stringify({ schema: 'work/resource@1', id: 'actor', kind: 'identity', owner: 'test', revision: '1', details: { password: 'SYNTHETIC_SECRET_NEVER_ECHO' } }));
  const before = snapshot(parent);
  for (const command of ['validate', 'tree']) {
    const result = runIn(parent, command, root);
    assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('SYNTHETIC_SECRET_NEVER_ECHO'));
    assert.deepEqual(snapshot(parent), before);
  }
});

test('installed workspace.manage forward-test authors only scoped todo planning and stops without a successor', t => {
  const root = temporary(t);
  const gitInit = spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8', windowsHide: true });
  assert.equal(gitInit.status, 0, gitInit.stderr);
  installInto(root);
  const installedCLI = path.join(root, '.claude/bin/starci-skills.mjs');
  const invoke = (...args) => spawnSync(process.execPath, [installedCLI, 'work', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  const catalog = JSON.parse(fs.readFileSync(path.join(root, '.claude/.dist/ops/catalog.json'), 'utf8'));
  const selected = catalog.ops.find(op => op.id === 'workspace.manage');
  assert.ok(selected, 'actual installed catalogue must resolve the selected op');
  for (const relative of ['SKILL.md', 'README.md', '.dist/policy/common.json', `.dist/ops/${selected.operator}`, '.dist/schemas/work.schema.json']) {
    assert.ok(fs.readFileSync(path.join(root, '.claude', relative), 'utf8').length > 100, `missing installed authority: ${relative}`);
  }
  const workRoot = path.join(root, '.starciwork');
  assert.equal(invoke('init', workRoot, '--id', 'synthetic-draft-workspace').status, 0);
  const beforeContract = snapshot(root);
  const contract = invoke('op', 'workspace.manage');
  assert.equal(contract.status, 0, contract.stderr);
  assert.deepEqual(snapshot(root), beforeContract, 'contract display executed a side effect');
  assert.deepEqual(fs.readdirSync(workRoot).sort(), ['.gitignore', '_schema', 'workspace.yaml']);
  // Authored by the evaluator after reading the actual installed common/goal contract.
  // This is an executable regression of that bounded authoring decision, not autonomous LLM replay.
  fs.cpSync(fileURLToPath(new URL('../fixtures/forward-goal/draft', import.meta.url)), path.join(workRoot, 'draft'), { recursive: true, errorOnExist: true });
  const beforeRead = snapshot(root);
  const validation = invoke('validate', workRoot);
  const tree = invoke('tree', workRoot);
  assert.equal(validation.status, 0, validation.stderr + validation.stdout);
  assert.equal(tree.status, 0, tree.stderr + tree.stdout);
  assert.deepEqual(snapshot(root), beforeRead, 'validation/tree mutated installed or product data');
  const result = JSON.parse(validation.stdout);
  assert.equal(result.nodes.length, 4);
  assert.ok(result.nodes.every(item => item.effectiveState === 'todo'));
  assert.equal(result.nodes.find(item => item.id === 'draft').state, null);
  assert.equal(result.nodes.find(item => item.id === 'draft.acceptance').eligible, false);
  assert.equal(result.resources.length, 0, 'no invented account/repository/environment resource');
  assert.match(tree.stdout, /draft\.functional \[todo\]/);
  const paths = snapshot(workRoot).map(item => item.path.replaceAll('\\', '/'));
  assert.deepEqual(paths.filter(item => item.endsWith('index.yaml')).sort(), ['draft/business/acceptance/index.yaml', 'draft/business/functional/index.yaml', 'draft/index.yaml', 'draft/setup/index.yaml']);
  assert.ok(!paths.some(item => /(?:request\.json|response\.json|manifest\.yaml|completion|implementation|uat|runs|sessions)/i.test(item)));
  assert.equal(fs.existsSync(path.join(root, '.worktrees')), false);
  assert.equal(fs.existsSync(path.join(root, 'src')), false);
});

test('installed review.verify can inspect synthetic producer gate proof without changing frozen semantic inputs', t => {
  const root = temporary(t);
  assert.equal(spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8', windowsHide: true }).status, 0);
  installInto(root);
  const invoke = (...args) => spawnSync(process.execPath, [path.join(root, '.claude/bin/starci-skills.mjs'), 'work', ...args], { cwd: root, encoding: 'utf8', windowsHide: true });
  const workRoot = path.join(root, '.starciwork');
  assert.equal(invoke('init', workRoot, '--id', 'synthetic-quality-workspace').status, 0);
  const source = path.join(root, 'quality-source.spec.mjs');
  fs.copyFileSync(fileURLToPath(new URL('./fixtures/quality-source.spec.mjs', import.meta.url)), source);
  const sourceBytes = fs.readFileSync(source);
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const sourceDigest = hash(sourceBytes);
  const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.notEqual(head.status, 0, 'fixture must not invent a commit for an unborn repository');
  // The fixture provider supplies an existing scoped graph before the consumer op is selected.
  // review.verify may neither create these inputs nor repair a missing target/dependency.
  const repoResource = resource(workRoot, 'synthetic-repo', 'repository', { root, head: 'unborn', scopedSource: 'quality-source.spec.mjs', sourceDigest });
  mutateJSON(repoResource, value => { value.revision = `sha256:${sourceDigest}`; });
  const specBody = '# Synthetic quality gate\n\nScope: execute only node --test --test-reporter=tap quality-source.spec.mjs on the supplied synthetic source.\n\nDone when: the actual process exits zero, executes at least one test, and reports zero failed tests. No repair, source commit, browser, account, platform goal or next op is authorized.\n\nLimits: this is not product coverage. Numeric performance thresholds are unconfigured. Report actual results only in evidence, leaving this specification frozen.';
  const nodeFile = writeNode(workRoot, 'quality', { id: 'synthetic-quality', kind: 'operations', refs: ['synthetic-repo'], assertions: ['unit-gate'] }, specBody);
  const beforeSelection = snapshot(root);
  const contract = invoke('op', 'review.verify');
  assert.equal(contract.status, 0, contract.stderr);
  assert.ok(contract.stdout.includes('review.verify'));
  assert.deepEqual(snapshot(root), beforeSelection, 'consumer selection must not create or revise its graph');
  const before = invoke('validate', workRoot);
  assert.equal(before.status, 0, before.stderr + before.stdout);
  const initial = JSON.parse(before.stdout).nodes[0];
  const frozenResource = fs.readFileSync(repoResource, 'utf8');
  const frozenBody = fs.readFileSync(nodeFile, 'utf8').split('\n---\n')[1];
  const command = [process.execPath, '--test', '--test-reporter=tap', 'quality-source.spec.mjs'];
  const gateEnvironment = { ...process.env };
  // This is a standalone gate process, not a recursive test-runner worker.
  delete gateEnvironment.NODE_TEST_CONTEXT;
  const execution = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', windowsHide: true, env: gateEnvironment });
  assert.equal(execution.status, 0, execution.stderr + execution.stdout);
  const measured = Object.fromEntries(['tests', 'pass', 'fail'].map(key => [key, Number(execution.stdout.match(new RegExp(`# ${key} (\\d+)`))?.[1])]));
  assert.ok(measured.tests > 0, execution.stdout + execution.stderr);
  assert.equal(measured.fail, 0);
  assert.equal(measured.pass, measured.tests);
  assert.deepEqual(fs.readFileSync(source), sourceBytes, 'gate repaired source without authorization');
  const evidenceRoot = path.join(workRoot, 'quality/evidence/synthetic-gate');
  json(evidenceRoot, 'gates/unit.json', { command, cwd: root, head: 'unborn', sourceDigest, exit: execution.status, measured, performanceThreshold: null });
  json(evidenceRoot, 'coverage.json', { scope: ['quality-source.spec.mjs'], kind: 'synthetic-unit-only', productCoverage: false });
  fs.mkdirSync(path.join(evidenceRoot, 'logs'));
  fs.writeFileSync(path.join(evidenceRoot, 'logs/unit.txt'), execution.stdout + execution.stderr);
  fs.writeFileSync(path.join(evidenceRoot, 'result.md'), `# Observed synthetic quality result\n\nExit ${execution.status}; tests ${measured.tests}, pass ${measured.pass}, fail ${measured.fail}. No product behavior or browser UAT was tested. No source commit exists in the unborn fixture. Performance thresholds remain unconfigured.\n`);
  const assets = ['gates/unit.json', 'logs/unit.txt', 'coverage.json', 'result.md'].map(relative => ({ path: relative, sha256: hash(fs.readFileSync(path.join(evidenceRoot, relative))) }));
  json(evidenceRoot, 'manifest.yaml', { schema: 'work/evidence@1', id: 'synthetic-gate-evidence', nodeId: 'synthetic-quality', inputDigest: initial.inputDigest, outcome: 'pass',
    assertions: [{ id: 'unit-gate', outcome: 'pass', observation: `Executed supplied synthetic Node gate: exit ${execution.status}, tests ${measured.tests}, pass ${measured.pass}, fail ${measured.fail}; raw output retained.` }], assets });
  mutateNode(nodeFile, value => { value.state = 'done'; value.completion = { inputDigest: initial.inputDigest, evidence: ['synthetic-gate-evidence'] }; });
  const final = invoke('validate', workRoot);
  assert.equal(final.status, 0, final.stderr + final.stdout);
  const accepted = JSON.parse(final.stdout).nodes[0];
  assert.equal(accepted.effectiveState, 'done');
  assert.equal(accepted.inputDigest, initial.inputDigest);
  assert.equal(accepted.specDigest, initial.specDigest);
  assert.equal(fs.readFileSync(nodeFile, 'utf8').split('\n---\n')[1], frozenBody);
  assert.equal(fs.readFileSync(repoResource, 'utf8'), frozenResource, 'post-proof resource pointer would invalidate evidence');
  assert.ok(!snapshot(workRoot).some(item => /request\.json|response\.json|sessions|runs/.test(item.path)));
});

/**
 * A credential used to live in an environment variable: whoever exported it owned it, it was gone on the next
 * machine, and the tree could not say who had set it. `identity set` is the owner's own hands putting a value
 * into the tree's encrypted custody - and the two rules that make it safe are testable from outside: the value
 * comes from stdin and from nowhere else, and it appears in nothing this command writes or prints.
 *
 * The fake `sops` on PATH is what lets the test drive the real spawn: it encrypts by prefixing a marker, so the
 * file on disk is provably not the plaintext, and the CLI's own refusals (no sops, no key) are real refusals.
 */
function fakeSops(t, { encryptStatus = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-sops-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('./helpers/fake-sops.mjs', import.meta.url));
  const windows = process.platform === 'win32';
  fs.writeFileSync(path.join(dir, windows ? 'sops.cmd' : 'sops'),
    windows ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n` : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    { mode: 0o755 });
  return { PATH: `${dir}${path.delimiter}${process.env.PATH}`, FAKE_SOPS_ENCRYPT_STATUS: String(encryptStatus) };
}
const SYNTHETIC = 'SYNTHETIC-NOT-A-REAL-KEY-0123456789';

test('sops runs with the host\'s master age identity when nothing names a key file', async () => {
  const {sopsEnv}=await import('../core/identity.mjs');
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-age-'));
  try{
    assert.equal(sopsEnv({USERPROFILE:home}).SOPS_AGE_KEY_FILE,undefined,'no key file on this host: nothing is invented');
    fs.mkdirSync(path.join(home,'.starci'),{recursive:true});fs.writeFileSync(path.join(home,'.starci','master.identity'),'# AGE-SECRET-KEY placeholder for the test\n');
    assert.equal(sopsEnv({USERPROFILE:home}).SOPS_AGE_KEY_FILE,path.join(home,'.starci','master.identity'));
    assert.equal(sopsEnv({USERPROFILE:home,SOPS_AGE_KEY_FILE:'C:/elsewhere/key.txt'}).SOPS_AGE_KEY_FILE,'C:/elsewhere/key.txt','a named key file is never overridden');
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('identity set puts a value into the tree\'s encrypted custody from stdin alone, and echoes it nowhere', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'workspace:test').status, 0);
  const env = { ...process.env, ...fakeSops(t) };
  const result = spawnSync(process.execPath, [cli, 'identity', 'set', 'payments', '--name', 'PAY_API_KEY'],
    { encoding: 'utf8', cwd: parent, env, input: `${SYNTHETIC}\n` });
  assert.equal(result.status, 0, result.stderr);
  const answer = JSON.parse(result.stdout);
  assert.deepEqual([answer.ok, answer.custody, answer.variables, answer.created],
    [true, 'identity:payments', ['PAY_API_KEY'], true]);

  // The readable half names who the identity is and which variables it holds - and never a value.
  const folder = path.join(root, '_resources', 'identity', 'payments');
  const resource = parseYaml(fs.readFileSync(path.join(folder, 'resource.yaml'), 'utf8'));
  assert.deepEqual([resource.schema, resource.kind, resource.id], ['work/resource@1', 'identity', 'identity.payments']);
  assert.deepEqual(resource.details.variables, ['PAY_API_KEY']);
  assert.equal(resource.details.secrets, 'secrets.enc.yaml');
  // The encrypted half went through sops, and the plaintext staging file it needed is gone.
  const secrets = fs.readFileSync(path.join(folder, 'secrets.enc.yaml'), 'utf8');
  assert.match(secrets, /^# sops-encrypted/, 'what lands on disk is what sops produced, never the plaintext');
  assert.deepEqual(fs.readdirSync(folder).sort(), ['resource.yaml', 'secrets.enc.yaml']);
  // Everything the CLI itself writes or says is free of the value: only what sops produced holds it, which with
  // a real sops is ciphertext and with this fake is a marker the test can recognise.
  const said = `${result.stdout}${result.stderr}${fs.readFileSync(path.join(folder, 'resource.yaml'), 'utf8')}`;
  assert.equal(said.includes(SYNTHETIC), false, 'a credential value never reaches stdout, stderr or the readable record');
  assert.equal(secrets, `# sops-encrypted\nPAY_API_KEY: ${SYNTHETIC}\n`, 'the file is sops output written verbatim, never the plaintext the CLI held');

  // A second variable joins the same custody; the file is decrypted, extended and encrypted again.
  const second = spawnSync(process.execPath, [cli, 'identity', 'set', 'payments', '--name', 'PAY_WEBHOOK_SECRET'],
    { encoding: 'utf8', cwd: parent, env, input: `${SYNTHETIC}-2\n` });
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout).variables, ['PAY_API_KEY', 'PAY_WEBHOOK_SECRET']);
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(folder, 'resource.yaml'), 'utf8')).details.variables,
    ['PAY_API_KEY', 'PAY_WEBHOOK_SECRET']);

  // The value is never an argument: a second positional is refused before anything is read or written.
  const onCommandLine = spawnSync(process.execPath, [cli, 'identity', 'set', 'payments', SYNTHETIC, '--name', 'PAY_API_KEY'],
    { encoding: 'utf8', cwd: parent, env, input: '' });
  assert.equal(onCommandLine.status, 1);
  assert.match(onCommandLine.stderr, /Invalid arguments/);
});

test('identity set refuses with the exact reason when sops or its key is not there, and writes nothing', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'workspace:test').status, 0);
  const folder = path.join(root, '_resources', 'identity', 'payments');

  // No sops on PATH at all: the owner is told what to install, and no custody folder is created behind it.
  const bare = spawnSync(process.execPath, [cli, 'identity', 'set', 'payments', '--name', 'PAY_API_KEY'],
    { encoding: 'utf8', cwd: parent, env: { ...process.env, PATH: fs.mkdtempSync(path.join(os.tmpdir(), 'work-v3-nosops-')) }, input: `${SYNTHETIC}\n` });
  assert.equal(bare.status, 1);
  assert.match(bare.stdout, /sops is not on PATH/);
  assert.equal(bare.stdout.includes(SYNTHETIC), false);
  assert.equal(fs.existsSync(folder), false, 'a refusal creates nothing');

  // sops is there but has no key for this tree: the reason says so, and the staging plaintext is still cleaned up.
  const noKey = spawnSync(process.execPath, [cli, 'identity', 'set', 'payments', '--name', 'PAY_API_KEY'],
    { encoding: 'utf8', cwd: parent, env: { ...process.env, ...fakeSops(t, { encryptStatus: 1 }) }, input: `${SYNTHETIC}\n` });
  assert.equal(noKey.status, 1);
  assert.match(noKey.stdout, /no age or GPG key is configured for it/);
  assert.equal(noKey.stdout.includes(SYNTHETIC), false);
  assert.equal(fs.existsSync(path.join(folder, 'secrets.enc.yaml')), false, 'nothing was written');
  assert.deepEqual(fs.readdirSync(folder), [], 'the plaintext sops needed is gone, whatever happened');
});

/**
 * `identity fill` is the whole of what the owner does for a credential: one command the kernel printed for
 * them, which then ASKS - `Fill PAY_API_KEY:` - and puts each answer straight into the custody. It exists
 * because the previous shape was an agent in a tab printing a command for the owner to compose, and the owner
 * could not tell they were being asked anything. What the test holds it to is what the ruling demanded: it
 * asks per variable, it never shows or writes what was typed, and an empty answer is a skip, never a blank
 * credential.
 */
test('identity fill asks for each variable in turn, puts every answer into the custody, and shows none of them', t => {
  const parent = temporary(t);
  const root = path.join(parent, '.starciwork');
  assert.equal(run('init', root, '--id', 'workspace:test').status, 0);
  const env = { ...process.env, ...fakeSops(t) };
  const filled = spawnSync(process.execPath,
    [cli, 'identity', 'fill', 'payments', '--name', 'PAY_API_KEY', '--name', 'PAY_WEBHOOK_SECRET'],
    { encoding: 'utf8', cwd: parent, env, input: `${SYNTHETIC}\n${SYNTHETIC}-hook\n` });
  assert.equal(filled.status, 0, filled.stderr);
  // One prompt per variable, in the order the command named them, and the answer to each is never printed.
  assert.match(filled.stderr, /Fill PAY_API_KEY: /);
  assert.match(filled.stderr, /Fill PAY_WEBHOOK_SECRET: /);
  assert.ok(filled.stderr.indexOf('Fill PAY_API_KEY') < filled.stderr.indexOf('Fill PAY_WEBHOOK_SECRET'), 'in order');
  assert.match(filled.stderr, /PAY_API_KEY: present in identity:payments/);
  assert.match(filled.stderr, /PAY_WEBHOOK_SECRET: present in identity:payments/);
  const answer = JSON.parse(filled.stdout);
  assert.deepEqual([answer.ok, answer.custody], [true, 'identity:payments']);
  assert.deepEqual(answer.filled, [{ name: 'PAY_API_KEY', ok: true }, { name: 'PAY_WEBHOOK_SECRET', ok: true }]);
  // Both values are in the custody and in nothing else this command said or wrote.
  const folder = path.join(root, '_resources', 'identity', 'payments');
  const secrets = fs.readFileSync(path.join(folder, 'secrets.enc.yaml'), 'utf8');
  assert.equal(secrets, `# sops-encrypted\nPAY_API_KEY: ${SYNTHETIC}\nPAY_WEBHOOK_SECRET: ${SYNTHETIC}-hook\n`);
  assert.deepEqual(parseYaml(fs.readFileSync(path.join(folder, 'resource.yaml'), 'utf8')).details.variables,
    ['PAY_API_KEY', 'PAY_WEBHOOK_SECRET']);
  const said = `${filled.stdout}${filled.stderr}${fs.readFileSync(path.join(folder, 'resource.yaml'), 'utf8')}`;
  assert.equal(said.includes(SYNTHETIC), false, 'nothing the owner typed is printed or written outside the custody');

  // An empty answer is a skip: no blank credential, and the command exits 1 because something is still owed.
  const skipped = spawnSync(process.execPath, [cli, 'identity', 'fill', 'payments', '--name', 'PAY_REFUND_KEY'],
    { encoding: 'utf8', cwd: parent, env, input: '\n' });
  assert.equal(skipped.status, 1);
  assert.match(skipped.stderr, /PAY_REFUND_KEY: skipped - nothing was entered/);
  assert.deepEqual(JSON.parse(skipped.stdout).filled, [{ name: 'PAY_REFUND_KEY', ok: false, reason: 'skipped: nothing was entered' }]);
  assert.equal(fs.readFileSync(path.join(folder, 'secrets.enc.yaml'), 'utf8').includes('PAY_REFUND_KEY'), false);

  // A refusal is named per variable and exits 1; a value on the command line is refused before anything is read.
  const noKey = spawnSync(process.execPath, [cli, 'identity', 'fill', 'invoicing', '--name', 'INVOICE_TOKEN'],
    { encoding: 'utf8', cwd: parent, env: { ...process.env, ...fakeSops(t, { encryptStatus: 1 }) }, input: `${SYNTHETIC}\n` });
  assert.equal(noKey.status, 1);
  assert.match(noKey.stderr, /INVOICE_TOKEN: refused - .*no age or GPG key is configured/);
  assert.equal(`${noKey.stdout}${noKey.stderr}`.includes(SYNTHETIC), false);
  const onCommandLine = spawnSync(process.execPath, [cli, 'identity', 'fill', 'payments', SYNTHETIC, '--name', 'PAY_API_KEY'],
    { encoding: 'utf8', cwd: parent, env, input: '' });
  assert.equal(onCommandLine.status, 1);
  assert.match(onCommandLine.stderr, /Invalid arguments/);
});

test('the fill prompt asks one variable at a time, writes each answer through setIdentitySecret, and echoes nothing back', async () => {
  const { fillIdentitySecrets } = await import('../core/identity.mjs');
  const said = [];
  const output = { write: value => { said.push(value); return true; } };
  const asked = [];
  const answers = ['first-value', '', 'third-value'];
  const prompt = question => { asked.push(question); return Promise.resolve(`${answers.shift()}\n`); };
  const written = [];
  const set = ({ workRoot, slug, name, value }) => {
    written.push({ workRoot, slug, name, value });
    return name === 'B_TOKEN' ? { ok: false, reason: 'sops is not on PATH' } : { ok: true, variables: [name] };
  };
  const result = await fillIdentitySecrets({ workRoot: '/tree/.starciwork', slug: 'payments',
    names: ['A_TOKEN', 'B_TOKEN', 'C_TOKEN'], output, prompt, set });
  // One question per variable, in order, and the second is skipped without ever reaching the custody.
  assert.deepEqual(asked, ['Fill A_TOKEN: ', 'Fill B_TOKEN: ', 'Fill C_TOKEN: ']);
  assert.deepEqual(written.map(entry => [entry.slug, entry.name, entry.value]),
    [['payments', 'A_TOKEN', 'first-value'], ['payments', 'C_TOKEN', 'third-value']]);
  assert.deepEqual(result.filled, [{ name: 'A_TOKEN', ok: true },
    { name: 'B_TOKEN', ok: false, reason: 'skipped: nothing was entered' }, { name: 'C_TOKEN', ok: true }]);
  assert.equal(result.ok, false, 'a variable that is not present leaves the command unfinished');
  assert.equal(said.join('').includes('first-value'), false, 'nothing the owner typed is written back out');
  assert.match(said.join(''), /A_TOKEN: present in identity:payments/);
  // A variable that is not a variable is refused before a single question is asked.
  await assert.rejects(fillIdentitySecrets({ workRoot: '/tree/.starciwork', slug: 'payments', names: ['not a var'], output, prompt, set }),
    /A credential variable is a name like STRIPE_SECRET_KEY/);
  await assert.rejects(fillIdentitySecrets({ workRoot: '/tree/.starciwork', slug: 'payments', names: [], output, prompt, set }),
    /identity fill needs at least one --name/);
});
