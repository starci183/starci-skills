import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT, hostSettings, serviceRegistry, SERVICES_FILE } from '../../scripts/reconciler/services.mjs';
import { SERVICE_VERBS, serviceScript } from '../../scripts/reconciler/service-scripts.mjs';
import { ENGINE_FILE } from '../../scripts/reconciler/boot.mjs';
import { TASK_DEFINITIONS } from '../../scripts/machine/task-register.mjs';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';

// `reconciler up --check` reported telegram-bridge red ("Cannot find module"): the registry built every connector path as
// the connectors directory plus <name>.mjs, but the bridge lives in the supervisor directory.
// A script that moved was invisible to every spec, because the probes and actuators are only run against a live host.
// Here every service the reconciler can start has its launch paths resolved WITHOUT starting anything and each must exist.

const exists = (rel) => fs.existsSync(path.resolve(SKILL_ROOT, rel));
const rel = (abs) => path.relative(SKILL_ROOT, abs).replaceAll(path.sep, '/');
const PORTS = { harnessUrl: 'http://127.0.0.1:1', harnessPort: 1, harnessPublicUrl: 'https://harness.example.org', gatewayPort: 1, problems: [] };

// service -> how its launch is reached. A service that is added to the registry without a line here fails the first case.
const MANAGED = {
  orca: 'probe', 'harness-ui': 'task', 'harness-tunnel': 'task',
  'ask-gateway': 'verb', 'ask-tunnel': 'verb', 'telegram-bridge': 'verb',
  'sched-task:StarCi-Reconciler': 'task',
};

test('every service the registry can start is classified, so a new one must declare its launch path', () => {
  const names = serviceRegistry({ settings: hostSettings(), ports: PORTS, platform: 'win32' }).filter((e) => e.kind === 'service').map((e) => e.name);
  assert.deepEqual([...names].sort(), Object.keys(MANAGED).sort());
});

test('every script a service probe or actuator launches exists on disk', async () => {
  const launched = new Map();
  const run = async (cmd, args) => { launched.set(`${path.basename(String(cmd))} ${args.join(' ')}`, args.filter((a) => /\.mjs$/.test(a))); return { status: 1, stdout: '', stderr: 'probe stub' }; };
  const registry = serviceRegistry({ settings: hostSettings(), ports: PORTS, run, http: async () => ({ ok: false }), platform: 'win32' });
  for (const entry of registry) {
    await entry.probe();
    const start = entry.start();
    if (start?.args) launched.set(`start ${entry.name}`, start.args.filter((a) => /\.mjs$/.test(a)));
  }
  const scripts = [...launched.values()].flat().map((a) => (path.isAbsolute(a) ? rel(a) : a));
  assert.ok(scripts.length >= 5, `launch paths were collected: ${scripts}`);
  for (const script of new Set(scripts)) assert.ok(exists(script), `${script} does not exist`);
  // The three connector probes are the catalog scripts, not a name guessed from the service.
  for (const name of Object.keys(SERVICE_VERBS)) assert.ok(scripts.includes(serviceScript(name)), `${name} probes ${serviceScript(name)}`);
});

test('every connector service resolves its script from the CLI catalog verb that owns it, and the file exists', () => {
  const catalog = loadCatalog();
  for (const [name, [group, verb]] of Object.entries(SERVICE_VERBS)) {
    const entry = catalog.groups.find((g) => g.group === group)?.verbs.find((v) => v.verb === verb);
    assert.ok(entry, `${name}: no catalog verb ${group} ${verb}`);
    assert.equal(serviceScript(name), entry.impl.script, `${name} is launched at the catalog's script`);
    assert.ok(exists(entry.impl.script), `${name}: ${entry.impl.script} does not exist`);
  }
  assert.equal(serviceScript('telegram-bridge'), 'scripts/supervisor/telegram-bridge.mjs');
  assert.throws(() => serviceScript('no-such-service'), /no CLI verb owns service/);
});

test('the engine, the services actuator, Orca and every scheduled task resolve to files on disk', () => {
  assert.ok(fs.existsSync(ENGINE_FILE), ENGINE_FILE);
  assert.ok(exists(SERVICES_FILE), SERVICES_FILE);
  for (const file of ['scripts/api/orca/terminal-list.mjs', 'scripts/api/orca/status.mjs']) assert.ok(exists(file), file);
  const catalog = loadCatalog();
  const verbs = new Map(catalog.groups.flatMap((g) => g.verbs.map((v) => [`${g.group} ${v.verb}`, v])));
  for (const [name, def] of Object.entries(TASK_DEFINITIONS)) {
    const words = def.action.replace(/^starci\s+/, '').split(/\s+/).filter((w) => !w.startsWith('--'));
    const verb = verbs.get(words.slice(0, 2).join(' '));
    assert.ok(verb, `${name}: task action "${def.action}" is not a catalog verb`);
    const target = verb.impl.script ?? verb.impl.module;
    assert.ok(exists(target), `${name}: ${target} does not exist`);
  }
});

test('every service launched through a Windows task has a registration the owner can run, under exactly the task name the actuator runs', async () => {
  const { startService } = await import('../../scripts/reconciler/services.mjs');
  const { SERVICE_TASKS } = await import('../../scripts/reconciler/task-health.mjs');
  const { taskRegister } = await import('../../scripts/machine/task-register.mjs');
  const taskServices = Object.entries(MANAGED).filter(([, how]) => how === 'task').map(([name]) => name).sort();
  assert.deepEqual(Object.keys(SERVICE_TASKS).sort(), taskServices, 'every task-launched service maps to a runtime task');
  const settings = hostSettings();
  for (const [service, key] of Object.entries(SERVICE_TASKS)) {
    const printed = await taskRegister({ positionals: [key], args: {}, env: {} });
    assert.equal(printed.code, 0, `${service}: starci task register ${key} prints a registration`);
    if (service.startsWith('sched-task:')) { assert.equal(service, `sched-task:${printed.data.taskName}`); continue; }
    const ran = [];
    await startService(service, { platform: 'win32', settings, ports: PORTS, env: {}, tasks: (args) => { ran.push(args); return { status: 0, stdout: '' }; }, powershell: () => ({ status: 0 }) });
    assert.deepEqual(ran.map((args) => args.join(' ')), [`/End /TN ${printed.data.taskName}`, `/Run /TN ${printed.data.taskName}`], `${service} restarts the task ${key} registers`);
    assert.match(printed.text, new RegExp(`Register-ScheduledTask -TaskName '${printed.data.taskName}'`));
  }
});
