import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import {
  annotatedOnHead, chooseTag, defaultGates, git, jestSummary, judgeJest, launch, normalizeRelease, refName, releaseDir, releaseGate,
} from '../../packages/hfs/release/gate.mjs';
import { contextOf, loadReleaseConfig, parseVerbFlags, readDeclaration, releaseMain, runVerb } from '../../packages/hfs/release/index.mjs';
import { JEST_GREEN, bad, greenTool, makeRepo, makeSpawn, ok, releaseCtx } from '../helpers/release-fakes.mjs';

const repos = [];
const repoWith = (options) => {
  const repo = makeRepo(options);
  repos.push(repo);
  return repo;
};
after(() => { for (const repo of repos) repo.cleanup(); });

const GATE_NAMES = ['app-check', 'typecheck', 'lint', 'test'];
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function session(repo, { tools = greenTool(), env, gitHook } = {}) {
  const spawn = makeSpawn(tools, { gitHook });
  const out = releaseCtx(repo.root, { spawn, env });
  return { ...out, spawn, config: loadReleaseConfig(repo.root) };
}

const refused = async (promise, code) => {
  await assert.rejects(promise, (error) => error instanceof StackError && error.code === code);
};

test('the default gates are the app check plus the managed package scripts the app has', () => {
  assert.deepEqual(defaultGates({ typecheck: 'x', 'build:fe': 'y', test: 'z', ignored: 'w' }).map((gate) => gate.name), ['app-check', 'typecheck', 'build-fe', 'test']);
  assert.deepEqual(defaultGates(undefined).map((gate) => gate.name), ['app-check']);
  const gates = defaultGates({ test: 'jest' });
  assert.deepEqual(gates[1], { name: 'test', command: ['npm', 'run', 'test'], summary: 'jest', env: {} });
  assert.deepEqual(gates[0].command, ['npx', 'starci', 'app', 'check']);
});

test('an absent release block is valid and a declared one is judged field by field', () => {
  const absent = normalizeRelease(undefined, { lint: 'x' });
  assert.deepEqual(absent.config, { gates: defaultGates({ lint: 'x' }), tagPrefix: 'v', defaultBranch: 'main', tagMatchesVersion: false });
  const declared = normalizeRelease({
    tagPrefix: 'r', defaultBranch: 'trunk', tagMatchesVersion: true,
    gates: [{ name: 'unit', command: ['node', 'run.mjs', '--flag=1'], summary: 'jest', env: { FOO: 'bar' } }, { name: 'plain', command: ['node', 'x.mjs'] }],
  });
  assert.deepEqual(declared.config.gates[1], { name: 'plain', command: ['node', 'x.mjs'], summary: null, env: {} });
  assert.equal(declared.config.tagPrefix, 'r');
});

test('every invalid release field is named', () => {
  assert.deepEqual(normalizeRelease('no').problems, ['release: must be a mapping']);
  const { problems } = normalizeRelease({
    other: 1, tagPrefix: '1x', defaultBranch: '-x', tagMatchesVersion: 'yes',
    gates: [
      'text', { name: 'Bad Name', command: 'npm test', extra: 1 }, { name: 'ok-one', command: ['node', 'a.mjs'] },
      { name: 'ok-one', command: ['node', 'x.mjs'] }, { name: 'sum', command: ['npm', 'a b'], summary: 'mocha', env: { lower: 'x' } }, { name: 'env-value', command: ['node'], env: { FOO: 1 } },
      { name: 'empty', command: [] }, { name: 'not-map-env', command: ['node'], env: 'x' },
    ],
  });
  const text = problems.join('\n');
  for (const part of ['release.other', 'release.tagPrefix', 'release.defaultBranch', 'release.tagMatchesVersion', 'gates[0]: must be a mapping', 'gates[1].extra', 'gates[1].name',
    'gates[1].command', 'gates[3].name: ok-one is declared twice', 'gates[4].command', 'gates[4].summary', 'gates[4].env', 'gates[5].env', 'gates[6].command', 'gates[7].env']) assert.match(text, new RegExp(part.replace(/[[\]]/gu, String.raw`\$&`), 'u'));
  assert.deepEqual(normalizeRelease({ gates: [] }).problems, ['release.gates: must be a non-empty list']);
  assert.deepEqual(normalizeRelease({ gates: 'x' }).problems, ['release.gates: must be a non-empty list']);
});

test('ref names and launch lines', () => {
  assert.equal(refName('origin'), true);
  assert.equal(refName('feature/a-b.c'), true);
  assert.equal(refName('-x'), false);
  assert.equal(refName('a b'), false);
  assert.equal(refName(5), false);
  assert.deepEqual(launch(['npm', 'run', 'x'], 'linux'), ['npm', ['run', 'x']]);
  assert.deepEqual(launch(['node', 'a.mjs'], 'win32'), ['node', ['a.mjs']]);
  assert.deepEqual(launch(['npx', 'starci'], 'win32'), ['cmd.exe', ['/d', '/s', '/c', 'npx', 'starci']]);
});

test('jest logs are judged on suites, tests and coverage thresholds', () => {
  assert.equal(jestSummary('nothing'), null);
  assert.equal(jestSummary('Test Suites: 1 passed, 1 total\n'), null);
  assert.deepEqual(jestSummary('Test Suites: 1 failed, 2 passed, 3 total\nTests:       2 failed, 5 passed, 7 total\n'), { suites: 3, failedSuites: 1, tests: 7, failed: 2, passed: 5 });
  assert.equal(judgeJest(JEST_GREEN).pass, true);
  assert.equal(judgeJest(JEST_GREEN).detail, 'suites 3/3, tests 12/12, coverage-threshold misses 0');
  assert.equal(judgeJest('log').pass, false);
  assert.equal(judgeJest('Test Suites: 1 failed, 1 total\nTests: 1 failed, 1 total\n').pass, false);
  assert.equal(judgeJest('Test Suites: 1 passed, 1 total\nTests: 4 passed, 5 total\n').pass, false);
  assert.equal(judgeJest('Test Suites: 0 total\nTests: 0 total\n').pass, false);
  const miss = judgeJest(`${JEST_GREEN}Jest: "global" coverage threshold for lines (100%) not met: 99%\n`);
  assert.equal(miss.pass, false);
  assert.equal(miss.misses, 1);
});

test('git failures are named and never hide a missing git', () => {
  const repo = repoWith({});
  const { ctx } = session(repo);
  assert.throws(() => git(ctx, ['rev-parse', '--verify', 'nope^{commit}']), (error) => error.code === 'RELEASE_GIT_FAILED' && /rev-parse --verify/u.test(error.message));
  assert.equal(git(ctx, ['rev-parse', '--verify', 'nope^{commit}'], { allowFail: true }).code !== 0, true);
  const missing = releaseCtx(repo.root, { spawn: () => ({ status: null, error: new Error('ENOENT') }) });
  assert.throws(() => git(missing.ctx, ['status']), (error) => error.code === 'RELEASE_GIT_MISSING');
  const silent = releaseCtx(repo.root, { spawn: () => ({ status: 0 }) });
  assert.deepEqual(git(silent.ctx, ['status']), { code: 0, stdout: '', stderr: '' });
});

test('a dry run prints the gates, the head and the tag and runs nothing', async () => {
  const repo = repoWith({});
  const { ctx, spawn, config } = session(repo);
  const result = await releaseGate(ctx, config, {});
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.gates, GATE_NAMES);
  assert.equal(result.data.head, repo.head());
  assert.equal(result.data.tag, 'v1.0.0');
  assert.equal(result.data.executed, false);
  const text = result.lines.join('\n');
  assert.match(text, /tag +v1\.0\.0 \(free: will be created, annotated\)/u);
  assert.match(text, /npm run typecheck/u);
  assert.match(text, /\(summary: jest\)/u);
  assert.match(text, /dry run: no gate was run/u);
  assert.deepEqual([...new Set(spawn.calls.map((call) => call.command))], ['git']);
  assert.equal(fs.existsSync(path.join(releaseDir(ctx), `${repo.head()}.l4.json`)), false);
});

test('--execute runs every gate in order, writes the L4 record with log hashes and creates the annotated tag', async () => {
  const repo = repoWith({});
  const { ctx, spawn, config } = session(repo);
  const result = await releaseGate(ctx, config, { execute: true, platform: 'linux' });
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual(spawn.calls.filter((call) => call.command !== 'git').map((call) => `${call.command} ${call.args.join(' ')}`), ['npx starci app check', 'npm run typecheck', 'npm run lint', 'npm run test']);
  const head = repo.head();
  const recordPath = path.join(releaseDir(ctx), `${head}.l4.json`);
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  assert.equal(record.head, head);
  assert.equal(record.tag, 'v1.0.0');
  assert.deepEqual(record.gates.map((gate) => gate.name), GATE_NAMES);
  for (const gate of record.gates) {
    assert.equal(gate.pass, true);
    assert.equal(gate.logSha256, sha256(gate.log));
  }
  assert.deepEqual(record.gates[3].summary, { suites: 3, failedSuites: 0, tests: 12, failed: 0, passed: 12 });
  assert.equal(repo.git('cat-file', '-t', 'refs/tags/v1.0.0'), 'tag');
  assert.equal(repo.git('rev-parse', 'v1.0.0^{commit}'), head);
  assert.equal(result.data.tagCreated, true);
  assert.match(result.lines.join('\n'), /annotated tag v1\.0\.0 created/u);
  // gate output is only in the log files, the env of a gate is recorded by name
  assert.equal(fs.readFileSync(record.gates[0].log, 'utf8'), 'check ok\n');
});

test('a second run reuses the annotated tag already on HEAD and rewrites the record', async () => {
  const repo = repoWith({});
  const first = session(repo);
  await releaseGate(first.ctx, first.config, { execute: true });
  const second = session(repo);
  const result = await releaseGate(second.ctx, second.config, { execute: true });
  assert.equal(result.ok, true);
  assert.equal(result.data.tagCreated, false);
  assert.match(result.lines.join('\n'), /already on/u);
  assert.equal(repo.git('tag', '--list').split('\n').length, 1);
  assert.deepEqual(annotatedOnHead(second.ctx, 'v'), ['v1.0.0']);
});

test('the next free tag skips local and remote tags and the dry run says so', async () => {
  const repo = repoWith({ version: '2.3.4', hook: 'none' });
  repo.git('tag', '-a', 'v2.3.0', '-m', 'old');
  repo.commit('more.txt');
  repo.git('push', '--quiet', 'origin', 'HEAD:refs/backup/side');
  const other = repo.head();
  repo.git('tag', '-a', 'v2.3.1', '-m', 'remote only');
  repo.git('push', '--quiet', 'origin', 'refs/tags/v2.3.1');
  repo.git('tag', '-d', 'v2.3.1');
  repo.git('tag', 'v2.3.2');
  const { ctx, config } = session(repo);
  assert.equal(other, repo.head());
  assert.equal(chooseTag(ctx, config, { prefix: 'v', remote: 'origin' }).tag, 'v2.3.3');
  assert.deepEqual(annotatedOnHead(ctx, 'v'), []);
  const result = await releaseGate(ctx, config, {});
  assert.equal(result.data.tag, 'v2.3.3');
});

test('with no free tag left the gate refuses', async () => {
  const repo = repoWith({});
  const taken = Array.from({ length: 100 }, (_, index) => `v1.0.${index}`).join('\n');
  const { ctx, config } = session(repo, { gitHook: (args) => (args[0] === 'tag' && args[1] === '--list' ? ok(taken) : null) });
  await refused(releaseGate(ctx, config, {}), 'RELEASE_NO_FREE_TAG');
});

test('a release block that demands tag = prefix + version is honoured and a taken tag is red', async () => {
  const repo = repoWith({ version: '3.1.4', release: { tagMatchesVersion: true } });
  const fresh = session(repo);
  assert.equal((await releaseGate(fresh.ctx, fresh.config, {})).data.tag, 'v3.1.4');
  repo.git('tag', '-a', 'v3.1.4', '-m', 'x');
  repo.commit('next.txt');
  const taken = session(repo);
  const result = await releaseGate(taken.ctx, taken.config, {});
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), /RED: tag v3\.1\.4 already exists on another commit/u);
  assert.match(result.lines.join('\n'), /TAKEN by another commit/u);
  assert.deepEqual(taken.spawn.calls.filter((call) => call.command !== 'git'), []);
});

test('a dirty tree, a different --source and an unknown --source are red and nothing runs', async () => {
  const repo = repoWith({});
  const clean = session(repo);
  const earlier = repo.head();
  repo.commit('second.txt');
  fs.writeFileSync(path.join(repo.root, 'stray.txt'), 'x');
  const dirty = session(repo);
  const result = await releaseGate(dirty.ctx, dirty.config, { execute: true, source: earlier });
  assert.equal(result.ok, false);
  const text = result.lines.join('\n');
  assert.match(text, /RED: working tree is not clean \(1 path\(s\), first: \?\? stray\.txt\)/u);
  assert.match(text, /RED: --source .* is .* but HEAD is/u);
  assert.deepEqual(dirty.spawn.calls.filter((call) => call.command !== 'git'), []);
  assert.deepEqual(result.data.red.length, 2);
  fs.rmSync(path.join(repo.root, 'stray.txt'));
  const unknown = await releaseGate(clean.ctx, clean.config, { source: 'no-such-branch' });
  assert.match(unknown.lines.join('\n'), /RED: cannot resolve --source no-such-branch/u);
  const odd = await releaseGate(clean.ctx, clean.config, { source: '--upload-pack=x' });
  assert.match(odd.lines.join('\n'), /RED: --source --upload-pack=x is not a ref name/u);
  const same = await releaseGate(clean.ctx, clean.config, { source: 'main' });
  assert.equal(same.ok, true);
});

test('an invalid --tag-prefix is a refusal and a valid one changes the tag', async () => {
  const repo = repoWith({});
  const { ctx, config } = session(repo);
  await refused(releaseGate(ctx, config, { tagPrefix: '1bad' }), 'RELEASE_USAGE');
  assert.equal((await releaseGate(ctx, config, { tagPrefix: 'rel' })).data.tag, 'rel1.0.0');
});

test('a red gate stops the run: no record, no tag', async () => {
  const repo = repoWith({});
  const { ctx, spawn, config } = session(repo, { tools: greenTool({ 'run lint': bad('lint failed') }) });
  const result = await releaseGate(ctx, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), /FAIL lint \(exit 1,/u);
  assert.match(result.lines.join('\n'), /gate\(s\) red: lint\. No L4 record, no tag\./u);
  assert.equal(spawn.calls.some((call) => call.args.includes('test')), false);
  assert.equal(repo.git('tag', '--list'), '');
  assert.equal(fs.existsSync(path.join(releaseDir(ctx), `${repo.head()}.l4.json`)), false);
});

test('a coverage threshold miss makes a jest gate red even when the process exits 0', async () => {
  const repo = repoWith({});
  const text = `${JEST_GREEN}Jest: "global" coverage threshold for branches (100%) not met: 98%\n`;
  const { ctx, config } = session(repo, { tools: greenTool({ 'run test': ok('', text) }) });
  const result = await releaseGate(ctx, config, { execute: true });
  assert.equal(result.ok, false);
  assert.match(result.lines.join('\n'), /FAIL test \(suites 3\/3, tests 12\/12, coverage-threshold misses 1,/u);
  assert.equal(repo.git('tag', '--list'), '');
});

test('a jest gate without a summary and a gate that cannot start are red', async () => {
  const repo = repoWith({});
  const silent = session(repo, { tools: greenTool({ 'run test': ok('all good\n') }) });
  assert.match((await releaseGate(silent.ctx, silent.config, { execute: true })).lines.join('\n'), /FAIL test \(no jest summary in the log/u);
  const missing = session(repo, { tools: greenTool({ 'run typecheck': { status: null, error: new Error('ENOENT') } }) });
  assert.match((await releaseGate(missing.ctx, missing.config, { execute: true })).lines.join('\n'), /FAIL typecheck \(cannot run \(ENOENT\)/u);
});

test('the declared env of a gate reaches the tool and only its names reach the record', async () => {
  const repo = repoWith({ release: { gates: [{ name: 'build', command: ['node', 'build.mjs'], env: { BUILD_MODE: 'ci' } }] } });
  const seen = [];
  const { ctx, config } = session(repo, { env: { PATH_LIKE: 'x' }, tools: { node: (args, options) => { seen.push(options.env); return ok('built\n'); } } });
  const result = await releaseGate(ctx, config, { execute: true });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, [{ PATH_LIKE: 'x', BUILD_MODE: 'ci' }]);
  assert.deepEqual(result.data.results[0].env, ['BUILD_MODE']);
});

test('on Windows npm and npx start through cmd.exe', async () => {
  const repo = repoWith({});
  const { ctx, spawn, config } = session(repo);
  const result = await releaseGate(ctx, config, { execute: true, platform: 'win32' });
  assert.equal(result.ok, true, result.lines.join('\n'));
  const starts = spawn.calls.filter((call) => call.command !== 'git');
  assert.deepEqual(starts.map((call) => call.command), ['cmd.exe', 'cmd.exe', 'cmd.exe', 'cmd.exe']);
  assert.deepEqual(starts[0].args, ['/d', '/s', '/c', 'npx', 'starci', 'app', 'check']);
});

test('a gate that moves HEAD or dirties the tree voids the record', async () => {
  const moving = repoWith({});
  const mover = session(moving, { tools: greenTool({ 'run lint': () => { moving.commit('during.txt'); return ok(); } }) });
  await assert.rejects(releaseGate(mover.ctx, mover.config, { execute: true }), (error) => error.code === 'RELEASE_HEAD_MOVED' && error.exit === 1);
  const dirtying = repoWith({});
  const dirtier = session(dirtying, { tools: greenTool({ 'run lint': () => { fs.writeFileSync(path.join(dirtying.root, 'generated.txt'), 'x'); return ok(); } }) });
  await assert.rejects(releaseGate(dirtier.ctx, dirtier.config, { execute: true }), (error) => error.code === 'RELEASE_TREE_DIRTY' && /generated\.txt/u.test(error.message));
  assert.equal(dirtying.git('tag', '--list'), '');
  assert.equal(fs.existsSync(path.join(releaseDir(dirtier.ctx), `${dirtying.head()}.l4.json`)), false);
});

test('releaseMain: actions, flags, json output, config refusals and bugs', async () => {
  const repo = repoWith({});
  const run = (argv, io = {}) => {
    const spawn = makeSpawn(greenTool());
    const out = releaseCtx(repo.root, { spawn });
    return releaseMain(argv, { cwd: repo.root, stdout: (t) => out.out.push(t), stderr: (t) => out.err.push(t), env: {}, stackIo: { spawn }, ...io }).then((code) => ({ code, out: out.text(), err: out.err.join('') }));
  };
  assert.deepEqual(await run(['bogus']), { code: 2, out: '', err: 'starci app release: takes gate or push\n' });
  assert.equal((await run([])).code, 2);
  const dry = await run(['gate', '--source', 'HEAD', '--tag-prefix', 'v']);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /dry run: no gate was run/u);
  const json = JSON.parse((await run(['gate', '--json'])).out);
  assert.equal(json.verb, 'gate');
  assert.equal(json.ok, true);
  assert.deepEqual(json.gates, GATE_NAMES);
  const executed = await run(['gate', '--execute']);
  assert.equal(executed.code, 0);
  const push = await run(['push', '--remote', 'origin']);
  assert.equal(push.code, 0);
  assert.match(push.out, /dry run: nothing pushed/u);
  const red = await run(['gate', '--source', 'nope']);
  assert.equal(red.code, 1);
  await Promise.all([['gate', '--wat'], ['gate', '--source'], ['gate', '--source', '--json'], ['push', '--remote']].map(async (argv) => {
    const result = await run(argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, /^starci app release: RELEASE_USAGE: /u);
  }));
  await assert.rejects(run(['gate'], { stackIo: { spawn: () => { throw new TypeError('bug'); } } }), TypeError);
});

test('the release block and the package are loaded tolerantly and refused when wrong', () => {
  const absent = repoWith({});
  const config = loadReleaseConfig(absent.root);
  assert.equal(config.version, '1.0.0');
  assert.deepEqual(config.gates.map((gate) => gate.name), GATE_NAMES);
  assert.deepEqual(readDeclaration(absent.root), {});
  const noScripts = repoWith({ scripts: null });
  assert.deepEqual(loadReleaseConfig(noScripts.root).gates.map((gate) => gate.name), ['app-check']);
  fs.writeFileSync(path.join(noScripts.root, 'package.json'), '{"version":"1.0.0"}');
  assert.deepEqual(loadReleaseConfig(noScripts.root).gates.map((gate) => gate.name), ['app-check']);
  const invalid = repoWith({ release: { tagPrefix: '1' } });
  assert.throws(() => loadReleaseConfig(invalid.root), (error) => error.code === 'RELEASE_CONFIG_INVALID' && /1 problem\(s\) in release: release\.tagPrefix/u.test(error.message));
  const noVersion = repoWith({ version: 'next' });
  assert.throws(() => loadReleaseConfig(noVersion.root), (error) => error.code === 'RELEASE_CONFIG_INVALID' && /version/u.test(error.message));
  const noPackage = repoWith({});
  fs.rmSync(path.join(noPackage.root, 'package.json'));
  assert.throws(() => loadReleaseConfig(noPackage.root), (error) => error.code === 'RELEASE_PACKAGE_UNREADABLE');
  const badYaml = repoWith({ files: { '.starcistacks/application-stacks.yaml': 'a: [unclosed\n' } });
  assert.throws(() => readDeclaration(badYaml.root), (error) => error.code === 'STACKS_DEPLOY_FILE_INVALID');
  const scalar = repoWith({ files: { '.starcistacks/application-stacks.yaml': 'just text\n' } });
  assert.deepEqual(readDeclaration(scalar.root), {});
});

test('the shared plumbing: the context takes the app IO over the injectable seams and flags are strict', async () => {
  const spawn = () => ({ status: 0 });
  const writes = [];
  const ctx = contextOf({ cwd: '/app', env: { A: '1' }, stdout: (t) => writes.push(t), stackIo: { spawn, now: () => 5 } });
  assert.equal(ctx.cwd, '/app');
  assert.equal(ctx.spawn, spawn);
  assert.equal(ctx.now(), 5);
  assert.equal(contextOf().cwd, process.cwd());
  assert.deepEqual(parseVerbFlags(['x', '--a', '--b', 'v'], { boolean: ['--a'], value: ['--b'] }), { flags: { a: true, b: 'v' }, positional: ['x'] });
  assert.equal(await runVerb({ label: 'l', name: 'n', io: { stdout: (t) => writes.push(t) }, argv: [], spec: { boolean: [], value: [] }, run: () => ({ ok: false, data: {} }) }), 1);
});
