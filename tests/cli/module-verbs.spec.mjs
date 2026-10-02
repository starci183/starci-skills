// Function-backed CLI verbs execute only inside the runtime dispatcher.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { main as runtimeMain } from '../../scripts/cli/main.mjs';
import { currentRole, requireRole } from '../../scripts/cli/roles.mjs';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';
import { main as packageMain } from '../../packages/cli/src/main.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const GLOBAL_YAML = `commands: [explain]
flags:
  - {name: json, type: boolean}
  - {name: cwd, type: string}
  - {name: quiet, type: boolean}
  - {name: help, type: boolean}
  - {name: edition, type: enum, enum: [full, lite]}
`;

const verbYaml = ({ verb, module, exported, effect = 'read', roles = '[worker, lead, owner]', conventions = '', flags = '[]', positional = '', json = 'flag', removed = '[]' }) => `group: demo
verb: ${verb}
owner: runtime
summary: ${verb} fixture module
impl: {module: scripts/${module}, export: ${exported}}
effect: ${effect}
roles: ${roles}
${conventions ? `conventions: [${conventions}]\n` : ''}${positional ? `positional:\n${positional}\n` : ''}flags: ${flags}
exit: {0: clean, 1: findings, 2: bad usage}
json: ${json}
examples: ['starci demo ${verb}']
editions: [full]
since: 1.0.0-alpha.4
removed: ${removed}
`;

const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: (text) => { value.out += text; }, stderr: (text) => { value.err += text; } };
};

const fixture = (t) => {
  const root = mkdtemp(t, 'starci-module-verbs-');
  const put = (relative, text) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  put('modules/cli/commands/_global.yaml', GLOBAL_YAML);
  put('modules/cli/commands/demo/_group.yaml', 'group: demo\nsummary: fixture verbs\nowner: runtime\nsince: 1.0.0-alpha.4\n');
  put('modules/cli/commands/demo/ok.yaml', verbYaml({
    verb: 'ok', module: 'ok.mjs', exported: 'runOk', effect: 'host', roles: '[lead, owner]',
    conventions: 'run this fixture in its isolated temp directory',
    flags: '[{name: count, type: number, default: 2}, {name: tag, type: list}, {name: enabled, type: boolean}]',
    positional: '  - {name: item, required: true, variadic: false}',
    removed: "['raw fixture ok']",
  }));
  put('modules/cli/commands/demo/fail.yaml', verbYaml({ verb: 'fail', module: 'fail.mjs', exported: 'runFail' }));
  put('modules/cli/commands/demo/explode.yaml', verbYaml({ verb: 'explode', module: 'explode.mjs', exported: 'explode' }));
  put('modules/cli/commands/demo/invalid.yaml', verbYaml({ verb: 'invalid', module: 'invalid.mjs', exported: 'invalid' }));
  put('modules/cli/commands/demo/plain.yaml', verbYaml({ verb: 'plain', module: 'ok.mjs', exported: 'runOk', json: 'none' }));
  put('scripts/ok.mjs', `export async function runOk(ctx) {
  return {
    code: 0,
    text: \`ok:\${ctx.args.count}:\${(ctx.args.tag ?? []).join(',')}:\${ctx.args.enabled === true}:\${ctx.positionals[0]}\`,
    data: {args: ctx.args, positionals: ctx.positionals, global: ctx.global, cwd: ctx.cwd, role: ctx.role, now: ctx.now},
  };
}\n`);
  put('scripts/fail.mjs', `export function runFail() { return {code: 1, text: 'fixture failed', stderr: 'fixture finding\\n'}; }\n`);
  put('scripts/explode.mjs', `export function explode() { throw new Error('fixture boom'); }\n`);
  put('scripts/invalid.mjs', `export function invalid() { return {code: 7}; }\n`);

  const loaded = loadCatalog(root);
  const groups = Object.fromEntries(loaded.groups.map((group) => [group.group, {
    summary: group.summary,
    owner: group.owner,
    verbs: Object.fromEntries(group.verbs.map((verb) => [verb.verb, verb])),
  }]));
  return { root, catalog: { schema: loaded.schema, global: loaded.global.flags, commands: loaded.global.commands, groups } };
};

test('module verbs receive typed context and render text or JSON', async (t) => {
  const { root, catalog } = fixture(t);
  const human = capture();
  assert.equal(await runtimeMain(['demo', 'ok', 'item', '--count', '4', '--tag', 'a', '--tag', 'b', '--enabled'], {
    ...human, catalog, runtimeRoot: root, cwd: root, env: { STARCI_ROLE: 'lead' }, now: 123,
  }), 0);
  assert.equal(human.value.out, 'ok:4:a,b:true:item\n');
  assert.equal(human.value.err, '');

  const machine = capture();
  assert.equal(await runtimeMain(['demo', 'ok', 'item', '--json', '--cwd', 'work'], {
    ...machine, catalog, runtimeRoot: root, cwd: root, env: { STARCI_ROLE: 'lead' }, now: () => 456,
  }), 0);
  const data = JSON.parse(machine.value.out);
  assert.deepEqual(data.args, { count: 2 });
  assert.deepEqual(data.positionals, ['item']);
  assert.equal(data.global.json, true);
  assert.equal(data.cwd, path.join(root, 'work'));
  assert.equal(data.role, 'lead');
  assert.equal(data.now, 456);
});

test('role and argument refusals happen before a module executes', async (t) => {
  const { root, catalog } = fixture(t);
  const role = capture();
  assert.equal(await runtimeMain(['demo', 'ok', 'item'], {
    ...role, catalog, runtimeRoot: root, env: { STARCI_ROLE: 'op' },
  }), 2);
  assert.equal(role.value.err, 'starci demo ok: role worker may not run this (allowed: lead, owner)\n');

  const flag = capture();
  assert.equal(await runtimeMain(['demo', 'ok', 'item', '--nope'], {
    ...flag, catalog, runtimeRoot: root, env: { STARCI_ROLE: 'lead' },
  }), 2);
  assert.equal(flag.value.err, 'starci: unknown option --nope\n');

  const json = capture();
  assert.equal(await runtimeMain(['demo', 'plain', '--json'], {
    ...json, catalog, runtimeRoot: root,
  }), 2);
  assert.equal(json.value.err, 'starci: demo plain has no machine output\n');
});

test('module failures preserve codes and thrown errors become verb failures', async (t) => {
  const { root, catalog } = fixture(t);
  const finding = capture();
  assert.equal(await runtimeMain(['demo', 'fail'], { ...finding, catalog, runtimeRoot: root }), 1);
  assert.equal(finding.value.out, 'fixture failed\n');
  assert.equal(finding.value.err, 'fixture finding\n');

  const thrown = capture();
  assert.equal(await runtimeMain(['demo', 'explode'], { ...thrown, catalog, runtimeRoot: root }), 1);
  assert.equal(thrown.value.err, 'starci demo explode: fixture boom\n');

  const invalid = capture();
  assert.equal(await runtimeMain(['demo', 'invalid'], { ...invalid, catalog, runtimeRoot: root }), 1);
  assert.match(invalid.value.err, /returned invalid code 7/);
});

test('module help and package-level explain expose policy and replacements', async (t) => {
  const { root, catalog } = fixture(t);
  const help = capture();
  assert.equal(await runtimeMain(['demo', 'ok', '--help'], { ...help, catalog, runtimeRoot: root }), 0);
  assert.match(help.value.out, /Effect: host\nRoles: lead, owner/);
  assert.match(help.value.out, /Conventions:\n  - run this fixture in its isolated temp directory/);
  assert.match(help.value.out, /Exit codes:/);
  assert.match(help.value.out, /JSON: flag/);

  const explain = capture();
  assert.equal(await packageMain(['explain', 'demo', 'ok'], { ...explain, catalog, retired: [], version: 'test' }), 0);
  assert.match(explain.value.out, /Replaces: raw fixture ok/);
  const unknown = capture();
  assert.equal(await packageMain(['explain', 'demo', 'missing'], { ...unknown, catalog, retired: [], version: 'test' }), 2);
  assert.match(unknown.value.err, /available: explode, fail, invalid, ok, plain/);
});

test('script verbs keep the caller environment when they cross the process seam', async () => {
  const env = { STARCI_ROLE: 'lead', FIXTURE: 'kept' };
  let options;
  const catalog = {
    global: [],
    groups: { demo: { owner: 'runtime', verbs: { script: {
      impl: { script: 'scripts/legacy.mjs' }, flags: [], json: 'flag', roles: ['lead'],
    } } } },
  };
  assert.equal(runtimeMain(['demo', 'script'], {
    catalog,
    env,
    runtimeRoot: path.resolve('fixture-runtime'),
    runScript: (script, args, received) => { options = received; return 0; },
  }), 0);
  assert.equal(options.env, env);
});

test('role helpers default unknown seats to owner and keep exact refusal text', () => {
  assert.equal(currentRole({ env: { STARCI_ROLE: 'lead' } }), 'lead');
  assert.equal(currentRole({ env: { STARCI_ROLE: 'op' } }), 'worker');
  assert.equal(currentRole({ env: { STARCI_ROLE: 'unknown' } }), 'owner');
  assert.equal(requireRole({ role: 'owner', group: 'demo', verb: 'ok', roles: ['lead'] }), null);
  assert.equal(requireRole({ role: 'worker', group: 'demo', verb: 'ok', roles: ['lead'] }), 'starci demo ok: role worker may not run this (allowed: lead)');
});
