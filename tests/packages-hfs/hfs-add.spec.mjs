import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parse } from 'yaml';
import { main } from '../../packages/hfs/bin/hfs.mjs';
import { addKind } from '../../packages/hfs/scaffold/add.mjs';
import { APP, cleanup, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

// `hfs add <noun> <name>`: exactly one kind's file tree, generated FROM the pattern knowledge files (the files: tree is the single
// source of the paths; each entry names its one template body). The specs generate into a temporary app and read the files back.
const ts = createRequire(import.meta.url)('typescript');
const made = [];
test.after(() => cleanup(made));

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const repo = () => {
  const dir = installTypeScript(writeCleanRepo(APP));
  made.push(dir);
  return dir;
};
const cli = async (argv) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
};
const read = (dir, relative) => fs.readFileSync(path.join(dir, ...relative.split('/')), 'utf8');
const exists = (dir, relative) => fs.existsSync(path.join(dir, ...relative.split('/')));
const parses = (text) => ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { experimentalDecorators: true } }).diagnostics.length === 0;
const tree = (topic) => parse(fs.readFileSync(path.join(ROOT, 'knowledge', 'patterns', 'be', `${topic}.yaml`), 'utf8')).files;
const hfsJson = (dir) => JSON.parse(read(dir, 'hfs.json'));

/** The platform capabilities of a topic exist: every platform file of its tree is present (empty), as after the pattern lane wrote them. */
const withPlatform = (dir, ...topics) => {
  for (const topic of topics) {
    for (const entry of tree(topic)) {
      if (!entry.path.startsWith('src/modules/platform/') || /<[^>]+>/.test(entry.path)) continue;
      const target = path.join(dir, 'be', ...entry.path.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'export {}\n');
    }
  }
};

test('the files trees and the template bodies are one set: every named template exists and every template is named', () => {
  const named = new Set();
  for (const topic of ['jobs', 'reactors', 'queues', 'projections', 'event-bus']) for (const entry of tree(topic)) if (entry.template) named.add(entry.template);
  const dir = path.join(ROOT, 'packages', 'hfs', 'templates', 'be', 'patterns');
  const present = new Set(fs.readdirSync(dir).flatMap((topic) => fs.readdirSync(path.join(dir, topic)).map((file) => `${topic}/${file}`)));
  assert.deepEqual([...named].filter((name) => !present.has(name)), [], 'a named template is missing');
  assert.deepEqual([...present].filter((name) => !named.has(name)), [], 'a template no files tree names is a second copy');
});

test('hfs add job writes the job tree from the knowledge, registers the patterns and the kind, and every file parses', async () => {
  const dir = repo();
  withPlatform(dir, 'jobs', 'queues');
  const result = await cli(['add', 'job', 'send-receipt', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/jobs/send-receipt';
  for (const file of ['index.ts', 'send-receipt.module.ts', 'send-receipt.processor.ts', 'steps/send-receipt.step.ts']) {
    assert.ok(exists(dir, `${base}/${file}`), file);
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  assert.match(read(dir, `${base}/send-receipt.processor.ts`), /export class SendReceiptProcessor extends FencedProcessor/);
  assert.match(read(dir, `${base}/steps/send-receipt.step.ts`), /implements JobStep/);
  assert.match(read(dir, `${base}/steps/send-receipt.step.ts`), /step: "send-receipt"/);
  assert.match(result.out, /created be\/src\/features\/jobs\/send-receipt\/send-receipt\.processor\.ts/);
  const declaration = hfsJson(dir);
  assert.deepEqual(declaration.sides.be.patterns, ['fenced-job', 'queue']);
  assert.deepEqual(declaration.sides.be.kinds, ['api', 'jobs']);
  assert.equal(declaration.project, 'demo', 'the rest of hfs.json is kept');
});

test('hfs add refuses an existing instance, writing nothing, and a second kind adds to the registration', async () => {
  const dir = repo();
  withPlatform(dir, 'jobs', 'queues');
  assert.equal((await cli(['add', 'job', 'send-receipt', '--repo', dir])).code, 0);
  const again = await cli(['add', 'job', 'send-receipt', '--repo', dir]);
  assert.equal(again.code, 2);
  assert.match(again.err, /HFS_ADD_EXISTS/);
  assert.equal((await cli(['add', 'job', 'expire-orders', '--repo', dir])).code, 0);
  assert.ok(exists(dir, 'be/src/features/jobs/expire-orders/expire-orders.processor.ts'));
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api', 'jobs']);
});

test('hfs add reactor needs its options, then writes the consumer named after the event and the dispatching handler', async () => {
  const dir = repo();
  withPlatform(dir, 'event-bus');
  const missing = await cli(['add', 'reactor', 'payment-status', '--repo', dir]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /HFS_ADD_OPTION_MISSING.*--event/);
  const bad = await cli(['add', 'reactor', 'payment-status', '--event', 'payment-settled', '--from', 'payment', '--service', 'PaymentStatusService', '--repo', dir]);
  assert.match(bad.err, /HFS_ADD_OPTION_INVALID/);
  const result = await cli(['add', 'reactor', 'payment-status', '--event', 'payment-settled', '--from', 'payment', '--service', 'PaymentStatusService=@modules/domain/order', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/reactors/payment-status';
  for (const file of ['index.ts', 'payment-status.module.ts', 'application/payment-status.command.ts', 'application/payment-status.handler.ts', 'application/payment-status.contracts.ts', 'transport/message/payment-settled.consumer.ts', 'transport/message/payment-status-message.module.ts']) {
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  assert.match(read(dir, `${base}/transport/message/payment-settled.consumer.ts`), /export class PaymentSettledConsumer implements EventConsumer<PaymentSettledEvent>/);
  assert.match(read(dir, `${base}/transport/message/payment-settled.consumer.ts`), /eventId: delivery\.eventId/);
  assert.match(read(dir, `${base}/application/payment-status.handler.ts`), /import \{ PaymentStatusService \} from "@modules\/domain\/order"/);
  assert.match(read(dir, `${base}/application/payment-status.handler.ts`), /this\.paymentStatusService\.apply\(command\.params\.request\)/);
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['event-bus']);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api', 'reactors']);
});

test('hfs add queue and projection write their module trees; the projection needs a connection and stamps its migration', async () => {
  const dir = repo();
  withPlatform(dir, 'queues');
  assert.equal((await cli(['add', 'queue', 'receipt', '--repo', dir])).code, 0);
  assert.match(read(dir, 'be/src/modules/queues/receipt/receipt.queue.ts'), /export const RECEIPT_QUEUE = "receipt"/);
  assert.match(read(dir, 'be/src/modules/queues/receipt/receipt.queue.ts'), /enqueueReceipt\(payload: ReceiptPayload, tx: EntityManager\)/);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api'], 'a queue is no trigger kind');
  assert.equal((await cli(['add', 'projection', 'order-summary', '--repo', dir])).code, 2);
  const created = addKind({ repoRoot: dir, noun: 'projection', name: 'order-summary', options: { connection: 'order' }, now: () => 1789800006000 });
  assert.ok(created.created.includes('be/src/modules/projections/order-summary/persistence/migrations/1789800006000-create-order-summary.ts'));
  const projection = read(dir, 'be/src/modules/projections/order-summary/order-summary.projection.ts');
  assert.match(projection, /InjectOrderEntityManager/);
  assert.match(projection, /async recomputeOrderSummary\(id: string\)/);
  assert.match(projection, /async getOrderSummary\(id: string\)/);
  assert.match(read(dir, 'be/src/modules/projections/order-summary/persistence/connection.ts'), /orderSummaryMigrations = \[CreateOrderSummaryProjection1789800006000\]/);
  for (const file of created.created) assert.ok(parses(read(dir, file)), `${file} parses`);
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['projection', 'queue']);
});

test('hfs add generates a missing platform capability from its tree, and refuses (writing nothing) while the capability has no template', async () => {
  const dir = repo();
  const before = read(dir, 'hfs.json');
  const refused = await cli(['add', 'job', 'send-receipt', '--repo', dir]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /HFS_ADD_TEMPLATE_PENDING/);
  assert.equal(exists(dir, 'be/src/features/jobs'), false, 'nothing was written');
  assert.equal(read(dir, 'hfs.json'), before, 'hfs.json is unchanged');
});

test('hfs add refuses an unknown noun, a bad name and a repository that is not an app root', async () => {
  const dir = repo();
  assert.match((await cli(['add', 'widget', 'x', '--repo', dir])).err, /HFS_ADD_NOUN_UNKNOWN/);
  assert.match((await cli(['add', 'queue', 'Bad_Name', '--repo', dir])).err, /HFS_ADD_NAME_INVALID/);
  assert.match((await cli(['add', 'queue', 'x', '--repo', path.join(dir, 'be')])).err, /HFS_ADD_NOT_AN_APP/);
  assert.match((await cli(['add', 'queue'])).err, /takes `<noun> <name>`/);
});
