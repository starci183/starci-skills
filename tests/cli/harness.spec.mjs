import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseYaml } from '../../engine/yaml.mjs';
import { main as runtimeMain } from '../../scripts/cli/main.mjs';
import { harnessStatus, openHarness } from '../../ui/harness-process.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const readYaml = (relative) => parseYaml(fs.readFileSync(path.join(root, relative), 'utf8'));
const global = readYaml('modules/cli/commands/_global.yaml');
const group = readYaml('modules/cli/commands/harness/_group.yaml');
const verbs = Object.fromEntries(['start', 'stop', 'status', 'open'].map((verb) => [
  verb,
  readYaml(`modules/cli/commands/harness/${verb}.yaml`),
]));
const catalog = {
  schema: 'starci/cli-catalog@1',
  global: global.flags,
  commands: global.commands,
  groups: { harness: { summary: group.summary, owner: group.owner, verbs } },
};

const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: (text) => { value.out += text; }, stderr: (text) => { value.err += text; } };
};

test('harness catalog dispatches all four function-backed verbs and validates flags', async () => {
  assert.deepEqual(Object.values(verbs).map(({ impl }) => impl.module), Array(4).fill('ui/harness-verbs.mjs'));
  const calls = [];
  const module = Object.fromEntries(['harnessStartVerb', 'harnessStopVerb', 'harnessStatusVerb', 'harnessOpenVerb'].map((name) => [name, async (ctx) => {
    calls.push({ name, ctx });
    return { code: 0, text: name, data: { name } };
  }]));
  const io = { catalog, importModule: async () => module, env: { STARCI_ROLE: 'lead' }, ...capture() };
  assert.equal(await runtimeMain(['harness', 'start', '--tunnel'], io), 0);
  assert.equal(await runtimeMain(['harness', 'stop', '--json'], { ...io, ...capture() }), 0);
  assert.equal(await runtimeMain(['harness', 'status'], io), 0);
  assert.equal(await runtimeMain(['harness', 'open'], io), 0);
  assert.deepEqual(calls.map(({ name }) => name), ['harnessStartVerb', 'harnessStopVerb', 'harnessStatusVerb', 'harnessOpenVerb']);
  assert.equal(calls[0].ctx.args.tunnel, true);
  assert.equal(calls[1].ctx.global.json, true);
  assert.equal(await runtimeMain(['harness', 'start', '--port', '3100'], { ...io, stderr: () => {} }), 2);
});

test('harness status reuses an injected health probe and open uses its seam', async () => {
  const seen = [];
  const status = await harnessStatus({
    url: 'http://127.0.0.1:4547',
    probe: async (url) => { seen.push(url); return { ok: true, status: 200 }; },
  });
  assert.deepEqual(status, { ok: true, running: true, url: 'http://127.0.0.1:4547', status: 200 });
  assert.deepEqual(seen, ['http://127.0.0.1:4547/healthz']);
  assert.deepEqual(await openHarness({ url: status.url, open: (url) => ({ ok: true, url }) }), { ok: true, url: status.url });
});
