import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseYaml } from '../../engine/yaml.mjs';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { runtimeSecretEnv } from '../../scripts/gates/runtime-host.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';
import { proofRepo } from '../helpers/sonar-scan.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const source = path.resolve(import.meta.dirname, '..', '..');
const example = () => parseYaml(fs.readFileSync(path.join(source, 'config.example.yaml'), 'utf8'));
const namedTunnel = { mode: 'named', tunnel: 'fixture-tunnel', hostname: 'fixture.example',
  access: true, tokenEnv: 'FIXTURE_TUNNEL_TOKEN' };
const telegram = { enabled: true, chatId: '-1', botTokenEnv: 'FIXTURE_TELEGRAM_TOKEN' };

function fixture(t, connectors = {}) {
  const root = mkdtemp(t, 'starci-credentials-');
  const config = example();
  config.connectors = connectors;
  fs.writeFileSync(path.join(root, 'config.yaml'), JSON.stringify(config));
  return { root, config, put: text => fs.writeFileSync(path.join(root, 'secret.env'), text) };
}

async function dispatch(fx, argv, env = {}, extra = {}) {
  const output = { stdout: '', stderr: '' }, calls = [];
  const io = { catalog, runtimeRoot: fx.root, cwd: fx.root, env,
    stdout: text => { output.stdout += text; }, stderr: text => { output.stderr += text; },
    runScript: (script, args, options) => { calls.push({ script, args, options }); return 0; }, ...extra };
  const code = await main(argv, io);
  return { code, calls, output };
}

test('missing selected tunnel key refuses before a native script starts and reports names only', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel });
  const result = await dispatch(fx, ['connect', 'tunnel', 'start']);
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.deepEqual(JSON.parse(result.output.stdout), {
    schema: 'starci/credential-preflight@1', ok: false, code: 'credential-missing',
    action: 'connect tunnel start', missing: [{ feature: 'ask-tunnel', kind: 'env', name: 'FIXTURE_TUNNEL_TOKEN' }],
    verification: 'not-performed',
  });
  assert.match(result.output.stderr, /FIXTURE_TUNNEL_TOKEN/);
  assert.doesNotMatch(result.output.stderr, /SONAR_TOKEN|FIXTURE_TELEGRAM_TOKEN/);
});

test('blank and conventional placeholders cannot reach the selected connector', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel });
  for (const value of ['', '   ', 'CHANGE_ME', 'REPLACE_ME', 'PLACEHOLDER', 'TODO', '<token>', 'YOUR_TUNNEL_TOKEN']) {
    fx.put('FIXTURE_TUNNEL_TOKEN=' + value + '\n');
    const result = await dispatch(fx, ['connect', 'tunnel', 'run']);
    assert.equal(result.code, 2, JSON.stringify(value));
    assert.equal(result.calls.length, 0);
    assert.equal(JSON.parse(result.output.stdout).code, 'credential-missing');
    assert.doesNotMatch(result.output.stdout + result.output.stderr, /CHANGE_ME|REPLACE_ME|PLACEHOLDER|TODO|<token>|YOUR_TUNNEL_TOKEN/);
  }
});

test('real environment wins and the selected native action receives shared values privately', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel });
  fx.put('FIXTURE_TUNNEL_TOKEN=fixture-file-secret\nUNSELECTED_KEY=fixture-extra-secret\n');
  const env = { FIXTURE_TUNNEL_TOKEN: 'fixture-real-secret', STARCI_ROLE: 'owner' };
  const result = await dispatch(fx, ['connect', 'tunnel', 'start'], env);
  assert.equal(result.code, 0);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].options.env.FIXTURE_TUNNEL_TOKEN, 'fixture-real-secret');
  assert.equal(result.calls[0].options.env.UNSELECTED_KEY, 'fixture-extra-secret');
  assert.deepEqual(env, { FIXTURE_TUNNEL_TOKEN: 'fixture-real-secret', STARCI_ROLE: 'owner' });
  assert.doesNotMatch(result.output.stdout + result.output.stderr, /fixture-(?:file|real|extra)-secret/);
  const blank = await dispatch(fx, ['connect', 'tunnel', 'start'], { FIXTURE_TUNNEL_TOKEN: '' });
  assert.equal(blank.code, 2);
  assert.equal(blank.calls.length, 0, 'a blank real override must not resurrect the file value');
});

test('off and quick connectors require no unrelated provider key', async t => {
  for (const mode of ['off', 'quick']) {
    const fx = fixture(t, { cloudflare: { mode }, telegram: { enabled: false } });
    const result = await dispatch(fx, ['reconciler', 'up']);
    assert.equal(result.code, 0, mode);
    assert.equal(result.calls.length, 1);
  }
});

test('enabled background integrations refuse the workflow before host or provider effects', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel, telegram });
  fx.put('FIXTURE_TUNNEL_TOKEN=fixture-tunnel-secret\n');
  const result = await dispatch(fx, ['workflow', 'start', '--json']);
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.deepEqual(JSON.parse(result.output.stdout).missing,
    [{ feature: 'telegram-bridge', kind: 'env', name: 'FIXTURE_TELEGRAM_TOKEN' }]);
  assert.doesNotMatch(result.output.stdout + result.output.stderr, /fixture-tunnel-secret/);
});

test('Telegram direct test and discover alias require the token even when its bridge is disabled', async t => {
  const fx = fixture(t, { telegram: { ...telegram, enabled: false } });
  for (const tail of [['test'], ['discover-chat'], ['--discover-chat']]) {
    const result = await dispatch(fx, ['connect', 'telegram', ...tail]);
    assert.equal(result.code, 2, tail.join(' '));
    assert.equal(result.calls.length, 0);
    assert.deepEqual(JSON.parse(result.output.stdout).missing,
      [{ feature: 'telegram-bridge', kind: 'env', name: 'FIXTURE_TELEGRAM_TOKEN' }]);
  }
});

test('help, status, check and non-actuating plans do not read the shared file or selected config', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel, telegram });
  fs.mkdirSync(path.join(fx.root, 'secret.env'));
  const dependencies = { loadEnv: () => { throw Error('must not load'); }, readConfig: () => { throw Error('must not read'); } };
  for (const argv of [
    ['reconciler', 'up', '--help'], ['reconciler', 'status'], ['reconciler', 'up', '--check'],
    ['workflow', 'start', '--plan'], ['kernel', 'dispatch', '--job', 'j-plan'],
    ['kernel', 'dispatch-ready', '--workflow', 'wf-plan', '--dry-run'],
    ['supervisor', 'start', '--plan'], ['supervisor', 'telegram-bridge', 'status'],
    ['connect', 'tunnel', 'status'], ['connect', 'tunnel', 'stop'], ['connect', 'tunnel', 'dry-run'],
    ['gate', 'sonar', 'status'], ['gate', 'custody-exec', '--help'],
  ]) {
    const result = await dispatch(fx, argv, {}, { credentialDependencies: dependencies });
    assert.equal(result.code, 0, argv.join(' '));
    assert.equal(result.calls.length, argv.includes('--help') ? 0 : 1);
  }
});

test('argument and role refusals happen before credentials and before module import', async t => {
  const fx = fixture(t), calls = [];
  const extra = { credentialDependencies: { loadEnv: () => { calls.push('secrets'); throw Error('not reached'); } },
    importModule: async () => { calls.push('module'); throw Error('not reached'); } };
  assert.equal((await dispatch(fx, ['connect', 'tunnel', 'start', '--bogus'], {}, extra)).code, 2);
  assert.equal((await dispatch(fx, ['gate', 'custody-exec', 'fixture.yaml.enc', '--bogus'], {}, extra)).code, 2);
  assert.equal((await dispatch(fx, ['gate', 'custody-exec'], {}, extra)).code, 2);
  const worker = ['worker', 'start', '--agent', 'codex', '--worktree', fx.root, '--spec', 'brief', '--task-title', 'fixture'];
  assert.equal((await dispatch(fx, worker, { STARCI_ROLE: 'op' }, extra)).code, 2);
  assert.deepEqual(calls, []);
});

test('a credential-loading failure contains no raw exception or environment in its receipt', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel });
  const result = await dispatch(fx, ['connect', 'tunnel', 'start'], {}, {
    credentialDependencies: { loadEnv: () => { throw Error('private-value-must-never-escape'); } },
  });
  assert.equal(result.code, 2);
  assert.equal(result.calls.length, 0);
  assert.equal(JSON.parse(result.output.stdout).code, 'credential-preflight-unavailable');
  assert.doesNotMatch(JSON.stringify(result), /private-value-must-never-escape/);
});

test('managed worker account authentication gets shared env without an invented API-key requirement', async t => {
  const fx = fixture(t);
  fx.put('CURSOR_API_KEY=fixture-optional-native-key\n');
  let ctx;
  const result = await dispatch(fx, ['worker', 'start', '--agent', 'codex', '--worktree', fx.root,
    '--spec', 'private brief', '--task-title', 'fixture worker'], { STARCI_ROLE: 'lead' }, {
    importModule: async () => ({ workerStartVerb: received => { ctx = received; return { code: 0, data: { nativeOwnerReached: true } }; } }),
  });
  assert.equal(result.code, 0);
  assert.equal(result.calls.length, 0);
  assert.equal(ctx.role, 'lead');
  assert.equal(ctx.env.CURSOR_API_KEY, 'fixture-optional-native-key');
  assert.equal(ctx.env.ANTHROPIC_API_KEY, undefined);
  assert.doesNotMatch(result.output.stdout + result.output.stderr, /fixture-optional-native-key/);
});

test('named credential-file auth requires its actual regular file and does not demand a token fallback', async t => {
  const fx = fixture(t, { cloudflare: { ...namedTunnel, credentialsFile: 'private-cloudflare.json' } });
  const missing = await dispatch(fx, ['connect', 'tunnel', 'start']);
  assert.equal(missing.code, 2);
  assert.deepEqual(JSON.parse(missing.output.stdout).missing,
    [{ feature: 'ask-tunnel', kind: 'file', name: 'connectors.cloudflare.credentialsFile' }]);
  fs.mkdirSync(path.join(fx.root, 'private-cloudflare.json'));
  assert.equal((await dispatch(fx, ['connect', 'tunnel', 'start'])).code, 2, 'a directory is not credential custody');
  fs.rmdirSync(path.join(fx.root, 'private-cloudflare.json'));
  fs.writeFileSync(path.join(fx.root, 'private-cloudflare.json'), '{}');
  const present = await dispatch(fx, ['connect', 'tunnel', 'start']);
  assert.equal(present.code, 0, 'presence permits the native provider owner to validate the actual file');
  assert.equal(present.calls.length, 1);
});

test('real linked runtime worktree reuses only main credentials and keeps native env overrides', t => {
  const base = mkdtemp(t, 'starci-credential-home-'), main = path.join(base, 'main');
  fs.mkdirSync(main);
  proofRepo(t, main);
  const client = fakeOrcaWorktrees({ root: path.join(base, 'lanes') });
  const created = client.create({ repo: main, name: 'credential-lane', baseBranch: 'main' });
  assert.equal(created.ok, true, created.error);
  fs.writeFileSync(path.join(main, 'secret.env'), 'FIXTURE_TOKEN=fixture-main-secret\nSOPS_AGE_KEY=AGE-SECRET-KEY-FAKE-MAIN\n');
  fs.writeFileSync(path.join(created.worktree.path, 'secret.env'), 'FIXTURE_TOKEN=fixture-lane-secret\nSOPS_AGE_KEY=AGE-SECRET-KEY-FAKE-LANE\n');
  assert.equal(runtimeSecretEnv({}, created.worktree.path).FIXTURE_TOKEN, 'fixture-main-secret');
  assert.equal(runtimeSecretEnv({}, created.worktree.path).SOPS_AGE_KEY, 'AGE-SECRET-KEY-FAKE-MAIN');
  assert.equal(runtimeSecretEnv({ SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE-ACTUAL' }, created.worktree.path).SOPS_AGE_KEY, 'AGE-SECRET-KEY-FAKE-ACTUAL');
  assert.equal(runtimeSecretEnv({ SOPS_AGE_KEY: '' }, created.worktree.path).SOPS_AGE_KEY, '');
  assert.equal(runtimeSecretEnv({ FIXTURE_TOKEN: 'fixture-actual-env' }, created.worktree.path).FIXTURE_TOKEN, 'fixture-actual-env');
});

test('broken Git identity refuses instead of loading a lane-local alternate file', t => {
  const fx = fixture(t);
  fs.writeFileSync(path.join(fx.root, '.git'), 'gitdir: missing-worktree-registration\n');
  fx.put('FIXTURE_TOKEN=fixture-not-canonical\n');
  assert.throws(() => runtimeSecretEnv({}, fx.root));
});

test('selected Sonar analysis requires real supplied token and URL before the script; status stays native', async t => {
  const fx = fixture(t);
  const options = ['--stack', fx.root, '--host', 'https://sonar.fixture.example'];
  const missing = await dispatch(fx, ['gate', 'sonar', 'scan', ...options]);
  assert.equal(missing.code, 2);
  assert.equal(missing.calls.length, 0);
  assert.ok(JSON.parse(missing.output.stdout).missing.some(row => row.name === 'SONAR_TOKEN'));
  fx.put('SONAR_TOKEN=fixture-analysis-secret\n');
  const present = await dispatch(fx, ['gate', 'sonar', 'scan', ...options]);
  assert.equal(present.code, 0, 'only the native scan owner can establish provider validity');
  assert.equal(present.calls.length, 1);
  assert.equal(present.calls[0].options.env.SONAR_TOKEN, 'fixture-analysis-secret');
  assert.doesNotMatch(present.output.stdout + present.output.stderr, /fixture-analysis-secret/);
  const invalid = await dispatch(fx, ['gate', 'sonar', 'dashboard', '--stack', fx.root, '--host', 'https://user:pass@sonar.fixture.example']);
  assert.equal(invalid.code, 2);
  assert.equal(invalid.calls.length, 0);
});

test('all custody modes load canonical shared env without requiring unrelated connectors', async t => {
  const fx = fixture(t, { cloudflare: namedTunnel, telegram });
  fx.put('SOPS_AGE_KEY=fixture-file-identity\nFIXTURE_OVERRIDE=fixture-file-value\n');
  const env = Object.freeze({ FIXTURE_OVERRIDE: 'fixture-caller-value', STARCI_ROLE: 'owner' });
  const extra = { credentialDependencies: { readConfig: () => { throw Error('custody must not select connectors'); } } };
  for (const tail of [['--keys'], ['--get', 'TOKEN'], ['fixture-command']]) {
    const result = await dispatch(fx, ['gate', 'custody-exec', 'fixture.yaml.enc', ...tail], env, extra);
    assert.equal(result.code, 0, tail.join(' '));
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0].script, path.join(fx.root, 'scripts/gates/custody-exec.mjs'));
    assert.deepEqual(result.calls[0].args, ['fixture.yaml.enc', ...tail]);
    assert.equal(result.calls[0].options.env.SOPS_AGE_KEY, 'fixture-file-identity');
    assert.equal(result.calls[0].options.env.FIXTURE_OVERRIDE, 'fixture-caller-value');
    assert.equal(result.calls[0].options.env.STARCI_ROLE, 'owner');
    assert.doesNotMatch(result.output.stdout + result.output.stderr, /fixture-(?:file|caller)-(?:identity|value)/);
  }
  assert.deepEqual(env, { FIXTURE_OVERRIDE: 'fixture-caller-value', STARCI_ROLE: 'owner' });
});

test('custody dispatch reaches a real private Node child with main credentials and caller overrides', async t => {
  const base = mkdtemp(t, 'starci-custody-child-'), root = path.join(base, 'main');
  fs.mkdirSync(root);
  proofRepo(t, root);
  const client = fakeOrcaWorktrees({ root: path.join(base, 'lanes') });
  const created = client.create({ repo: root, name: 'custody-lane', baseBranch: 'main' });
  assert.equal(created.ok, true, created.error);
  const lane = created.worktree.path, receipt = path.join(base, 'child-observation.json');
  fs.writeFileSync(path.join(root, 'secret.env'),
    'SOPS_AGE_KEY=fixture-main-identity\nFIXTURE_LOADED=fixture-main-value\nFIXTURE_OVERRIDE=fixture-file-value\n');
  fs.writeFileSync(path.join(lane, 'secret.env'),
    'SOPS_AGE_KEY=fixture-lane-identity\nFIXTURE_LOADED=fixture-lane-value\n');
  // Only the custody implementation is replaced at the test boundary; dispatcher, loader and Node runner are real.
  const observer = 'observe-custody.mjs';
  fs.writeFileSync(path.join(lane, observer), "import fs from 'node:fs';fs.writeFileSync(" + JSON.stringify(receipt)
    + ",JSON.stringify({canonical:process.env.FIXTURE_LOADED==='fixture-main-value',"
    + "caller:process.env.FIXTURE_OVERRIDE==='fixture-caller-value',blankIdentity:process.env.SOPS_AGE_KEY==='',"
    + "role:process.env.STARCI_ROLE==='owner',cwd:process.cwd(),args:process.argv.slice(2)}));");
  const command = { ...catalog.groups.gate.verbs['custody-exec'], impl: { script: observer } };
  const selectedCatalog = { ...catalog, groups: { ...catalog.groups,
    gate: { ...catalog.groups.gate, verbs: { ...catalog.groups.gate.verbs, 'custody-exec': command } } } };
  const env = Object.freeze({ SOPS_AGE_KEY: '', FIXTURE_OVERRIDE: 'fixture-caller-value', STARCI_ROLE: 'owner' });
  const output = { stdout: '', stderr: '' };
  assert.equal(await main(['gate', 'custody-exec', 'fixture.yaml.enc', '--keys'], {
    catalog: selectedCatalog, runtimeRoot: lane, cwd: lane, env,
    stdout: text => { output.stdout += text; }, stderr: text => { output.stderr += text; },
  }), 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(receipt, 'utf8')), {
    canonical: true, caller: true, blankIdentity: true, role: true,
    cwd: path.resolve(lane), args: ['fixture.yaml.enc', '--keys'],
  });
  assert.deepEqual(env, { SOPS_AGE_KEY: '', FIXTURE_OVERRIDE: 'fixture-caller-value', STARCI_ROLE: 'owner' });
  assert.deepEqual(output, { stdout: '', stderr: '' });
});

test('unavailable custody shared credentials refuse before any script mode starts', async t => {
  const fx = fixture(t);
  fs.mkdirSync(path.join(fx.root, 'secret.env'));
  for (const tail of [['--keys'], ['--get', 'TOKEN'], ['fixture-command']]) {
    const result = await dispatch(fx, ['gate', 'custody-exec', 'fixture.yaml.enc', ...tail]);
    assert.equal(result.code, 2, tail.join(' '));
    assert.equal(result.calls.length, 0);
    assert.equal(result.output.stdout, '');
    assert.match(result.output.stderr, /credential-preflight-unavailable/);
    assert.doesNotMatch(result.output.stderr, /secret\.env must be a regular file/);
  }
});
