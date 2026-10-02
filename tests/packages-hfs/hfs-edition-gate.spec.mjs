import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../../packages/hfs/bin/hfs.mjs';
import { addKind } from '../../packages/hfs/scaffold/add.mjs';
import { EditionRefusal, refuseInEdition } from '../../packages/hfs/scaffold/edition-gate.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { cleanup, installTypeScript } from '../helpers/hfs-cli-fixture.mjs';

// The edition gate of `hfs add` and `hfs new` (design 8.6 R8): in a lite app a noun whose file tree lands in a slot the
// lite edition does not have (the slot's `editions` exclude it, or its `litePresence` is forbidden) refuses with exit 2
// and "<verb> <noun>: full edition only; run starci app upgrade --edition full" on stderr, nothing written. The slot
// resolver of the app decides - never a noun list.

const made = [];
test.after(() => cleanup(made));

const SIDES = { be: { apps: [{ name: 'core', kind: 'api' }], kinds: ['api'] }, fe: { apps: [{ name: 'web', kind: 'next' }] } };
const LITE = { hfs: 2, kind: 'app', edition: 'lite', project: 'demo', sides: SIDES };
const FULL = { hfs: 2, kind: 'app', project: 'demo', sides: SIDES };

const repo = (declaration) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-gate-'));
  made.push(dir);
  fs.writeFileSync(path.join(dir, 'hfs.json'), `${JSON.stringify(declaration, null, 2)}\n`);
  return dir;
};
const cli = async (argv) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
};
const exists = (dir, relative) => fs.existsSync(path.join(dir, ...relative.split('/')));
const tree = (dir) => {
  const walk = (at) => fs.readdirSync(path.join(dir, ...at.split('/')), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${at}/${entry.name}`) : [`${at}/${entry.name}`]));
  return walk('.').map((p) => p.slice(2)).sort();
};

test('the gate reads the slot resolver of the app: a slot the edition lacks or forbids refuses the verb, never the noun name', () => {
  const manifest = loadSlotManifest();
  const lite = createSlotResolver(manifest, resolveRepoDeclaration(manifest, LITE));
  const full = createSlotResolver(manifest, resolveRepoDeclaration(manifest, FULL));
  const refuses = (resolver, slotIds, command) => assert.throws(
    () => refuseInEdition({ resolver, slotIds, command }),
    (error) => error instanceof EditionRefusal && error.message === `${command}: full edition only; run starci app upgrade --edition full`,
    `${command} over ${slotIds}`);
  // a slot lite forbids (litePresence), the lite-only forbidden slot itself, and an id the manifest never had all refuse
  refuses(lite, ['be.feature.saga'], 'add saga');
  refuses(lite, ['be.tests.world'], 'new spec');
  refuses(lite, ['repo.tests-forbidden'], 'add x');
  refuses(lite, ['be.feature', 'be.feature.saga'], 'add saga'); // one forbidden slot among legal ones is enough
  refuses(lite, ['be.tests.e2e'], 'add x');
  refuses(lite, ['be.no.such.slot'], 'add x');
  // a slot that exists under lite - whatever its presence - does not refuse
  for (const slotIds of [['be.feature', 'be.feature.application', 'be.transport.graphql'], ['be.feature.webhooks.http'], ['be.cli'], ['be.app.cli'], ['be.contract.graphql']]) {
    assert.equal(refuseInEdition({ resolver: lite, slotIds, command: 'add x' }), undefined, slotIds.join(', '));
  }
  // under full the gate never fires, not even over the slots lite forbids
  assert.equal(refuseInEdition({ resolver: full, slotIds: ['be.feature.saga', 'be.tests.world'], command: 'add saga' }), undefined);
});

test('a lite app refuses every add noun whose tree writes a slot lite does not have - exit 2, the exact message, nothing written', async () => {
  const cases = [
    ['job', 'send-receipt'],
    ['queue', 'receipt'],
    ['projection', 'order-summary', '--connection', 'order'],
    ['reactor', 'payment-status', '--event', 'payment-settled', '--from', 'payment', '--service', 'PaymentStatusService=@modules/domain/order'],
    ['saga', 'fulfil', '--owner', 'shop', '--from', 'billing', '--failed', 'invoice-rejected', '--done', 'invoice-issued', '--service', 'FulfilService=@modules/domain/fulfil'],
    ['realtime', 'order-status', '--service', 'orderStatusTopic=@modules/domain/order'],
  ];
  for (const [noun, name, ...opts] of cases) {
    const dir = repo(LITE);
    const result = await cli(['add', noun, name, ...opts, '--repo', dir]);
    assert.deepEqual([result.code, result.out, result.err], [2, '', `add ${noun}: full edition only; run starci app upgrade --edition full\n`], noun);
    assert.deepEqual(tree(dir), ['hfs.json'], `${noun}: nothing written, no partial state`);
    assert.throws(() => addKind({ repoRoot: dir, noun, name }), EditionRefusal, `${noun}: the exported function refuses, not only the CLI`);
  }
  // the refusal precedes the noun's option validation: a saga without its --owner answers the same
  const dir = repo(LITE);
  assert.equal((await cli(['add', 'saga', 'fulfil', '--repo', dir])).err, 'add saga: full edition only; run starci app upgrade --edition full\n');
  assert.deepEqual(tree(dir), ['hfs.json']);
  // `event` is no noun in any edition: the unknown-noun refusal stays as before
  const event = await cli(['add', 'event', 'order-paid', '--repo', repo(LITE)]);
  assert.equal(event.code, 2);
  assert.match(event.err, /HFS_ADD_NOUN_UNKNOWN/);
});

test('a lite app refuses `new service` and `new spec` - the unit spec they write has no test world there', async () => {
  // No node_modules: the refusal precedes even the repository's own TypeScript load.
  const dir = repo(LITE);
  for (const args of [['service', 'be/src/modules/domain/commission', 'commission'], ['spec', 'be/src/modules/domain/commission/commission.service.ts']]) {
    const result = await cli(['new', ...args, '--repo', dir]);
    assert.deepEqual([result.code, result.out, result.err], [2, '', `new ${args[0]}: full edition only; run starci app upgrade --edition full\n`], args[0]);
  }
  assert.deepEqual(tree(dir), ['hfs.json'], 'nothing written');
});

test('the nouns lite keeps are untouched: add api, add webhook and add cli still write their trees', async () => {
  const dir = repo(LITE);
  const api = await cli(['add', 'api', 'checkout', '--service', 'CheckoutService=@modules/domain/order', '--repo', dir]);
  assert.equal(api.code, 0, api.err);
  assert.ok(exists(dir, 'be/src/features/api/checkout/transport/graphql/checkout-graphql.module.ts'));
  const webhook = await cli(['add', 'webhook', 'payment-gateway', '--service', 'PaymentService=@modules/domain/payment', '--repo', dir]);
  assert.equal(webhook.code, 0, webhook.err);
  assert.ok(exists(dir, 'be/src/features/webhooks/payment-gateway/transport/http/payment-gateway.webhook.ts'));
  // add cli wires the new group into the static cli feature root, which exists once the app has a cli
  const cliModule = path.join(dir, 'be', 'src', 'features', 'cli', 'cli.module.ts');
  fs.mkdirSync(path.dirname(cliModule), { recursive: true });
  fs.writeFileSync(cliModule, ['import { Module } from "@nestjs/common"', '', '@Module({ imports: [] })', 'export class CliModule {}', ''].join('\n'));
  const addCli = await cli(['add', 'cli', 'requeue', '--service', 'DeadLetterService=@modules/domain/order', '--repo', dir]);
  assert.equal(addCli.code, 0, addCli.err);
  assert.ok(exists(dir, 'be/src/features/cli/requeue/requeue.cli.ts'));
  // and `new image` is untouched
  assert.equal((await cli(['new', 'image', '--repo', repo(LITE)])).code, 0);
});

test('a full app is unaffected: the nouns lite refuses write as before', async () => {
  const dir = repo(FULL);
  const queue = await cli(['add', 'queue', 'receipt', '--repo', dir]);
  assert.equal(queue.code, 0, queue.err);
  assert.ok(exists(dir, 'be/src/modules/queues/receipt/receipt.queue.ts'));
  installTypeScript(dir);
  const service = await cli(['new', 'service', 'be/src/modules/domain/commission', 'commission', '--repo', dir]);
  assert.equal(service.code, 0, service.err);
  assert.ok(exists(dir, 'be/src/modules/domain/commission/commission.service.spec.ts'));
});
