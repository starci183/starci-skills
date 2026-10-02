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
  for (const topic of ['jobs', 'reactors', 'queues', 'projections', 'event-bus', 'api', 'webhooks', 'realtime']) for (const entry of tree(topic)) if (entry.template) named.add(entry.template);
  const dir = path.join(ROOT, 'packages', 'hfs', 'templates', 'be', 'patterns');
  const walk = (folder, prefix) => fs.readdirSync(path.join(dir, folder), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${folder}/${entry.name}`, prefix) : [`${folder}/${entry.name}`]));
  const present = new Set(fs.readdirSync(dir).flatMap((topic) => walk(topic, topic)));
  assert.deepEqual([...named].filter((name) => !present.has(name)), [], 'a named template is missing');
  assert.deepEqual([...present].filter((name) => !named.has(name)), [], 'a template no files tree names is a second copy');
});

test('hfs add job writes the job tree from the knowledge, registers the patterns and the kind, and every file parses', async () => {
  const dir = repo();
  withPlatform(dir, 'jobs', 'queues');
  const result = await cli(['add', 'job', 'send-receipt', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/jobs/send-receipt';
  assert.ok(exists(dir, 'be/src/modules/queues/send-receipt/send-receipt.queue.ts'), 'a job is the consumer of its queue: the queue is generated with it');
  assert.match(read(dir, `${base}/transport/queue/send-receipt.processor.ts`), /readonly queue = SEND_RECEIPT_QUEUE/);
  for (const file of ['index.ts', 'send-receipt.module.ts', 'transport/queue/send-receipt.processor.ts', 'transport/queue/send-receipt-queue.module.ts', 'steps/send-receipt.step.ts']) {
    assert.ok(exists(dir, `${base}/${file}`), file);
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  assert.match(read(dir, `${base}/transport/queue/send-receipt.processor.ts`), /export class SendReceiptProcessor extends FencedProcessor/);
  assert.match(read(dir, `${base}/steps/send-receipt.step.ts`), /implements JobStep/);
  assert.match(read(dir, `${base}/steps/send-receipt.step.ts`), /step: "send-receipt"/);
  assert.match(result.out, /created be\/src\/features\/jobs\/send-receipt\/transport\/queue\/send-receipt\.processor\.ts/);
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
  assert.ok(exists(dir, 'be/src/features/jobs/expire-orders/transport/queue/expire-orders.processor.ts'));
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

test('hfs add generates a missing platform capability from its templates: jobs and queue come with the first job and every file parses', async () => {
  const dir = repo();
  const result = await cli(['add', 'job', 'send-receipt', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  for (const file of ['jobs/job-claim.service.ts', 'jobs/job-runner.service.ts', 'jobs/fenced.processor.ts', 'jobs/persistence/jobs.sql.ts', 'jobs/job-claim.service.spec.ts', 'queue/queue-relay.service.ts', 'queue/bullmq-queue-transport.client.ts', 'queue/persistence/queue.sql.ts', 'queue/queue-worker.service.spec.ts']) {
    assert.ok(parses(read(dir, `be/src/modules/platform/${file}`)), `${file} parses`);
  }
  const createdFiles = result.out.split('\n').filter((line) => line.startsWith('created ')).map((line) => line.slice('created '.length));
  const migration = createdFiles.find((file) => file.endsWith('-create-jobs.ts'));
  assert.ok(migration, 'the jobs migration is created');
  const stamp = /(\d{13})-create-jobs/.exec(migration)[1];
  assert.match(read(dir, 'be/src/modules/platform/jobs/persistence/connection.ts'), new RegExp('jobsMigrations = \\[CreateJobs' + stamp + '\\]'));
  assert.match(read(dir, 'be/src/modules/platform/jobs/job-claim.service.ts'), /fencing_token|runKey/);
  for (const file of createdFiles) assert.ok(parses(read(dir, file)), file);
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['fenced-job', 'queue']);
  const second = await cli(['add', 'job', 'expire-orders', '--repo', dir]);
  assert.equal(second.code, 0, second.err);
  assert.doesNotMatch(second.out, /platform/, 'a capability that exists is not written again');
});

test('hfs add reactor brings the event-bus platform capability with its first member when it is missing', async () => {
  const dir = repo();
  const result = await cli(['add', 'reactor', 'payment-status', '--event', 'payment-settled', '--from', 'payment', '--service', 'PaymentStatusService=@modules/domain/order', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  for (const file of ['event-bus.module.ts', 'event-bus.service.ts', 'event-relay.service.ts', 'event-runner.service.ts', 'kafka-event-transport.client.ts', 'persistence/event-bus.sql.ts']) {
    assert.ok(parses(read(dir, `be/src/modules/platform/event-bus/${file}`)), `${file} parses`);
  }
  const created = result.out.split('\n').filter((line) => line.startsWith('created '));
  assert.ok(created.some((line) => /migrations\/\d{13}-create-event-outbox\.ts$/.test(line)));
  assert.ok(exists(dir, 'be/src/features/reactors/payment-status/transport/message/payment-settled.consumer.ts'));
});

test('hfs add webhook writes the transport/http door tree with its signature proof and request, and registers the kind and its pattern', async () => {
  const dir = repo();
  const missing = await cli(['add', 'webhook', 'payment-gateway', '--repo', dir]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /HFS_ADD_OPTION_MISSING.*--service/);
  const result = await cli(['add', 'webhook', 'payment-gateway', '--service', 'PaymentService=@modules/domain/payment', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/webhooks/payment-gateway';
  for (const file of ['index.ts', 'transport/http/payment-gateway-http.module.ts', 'transport/http/payment-gateway.webhook.ts', 'transport/http/payment-gateway.webhook.spec.ts', 'transport/http/dto/payment-gateway.request.ts']) {
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  const door = read(dir, `${base}/transport/http/payment-gateway.webhook.ts`);
  assert.match(door, /export class PaymentGatewayWebhook/);
  assert.ok(door.includes('@Public({ reason: PublicReason.SignedWebhook })'));
  assert.ok(door.includes('this.signature.verify({ provider: "payment-gateway"'));
  assert.ok(door.includes('this.deliveries.acceptPaymentGatewayDelivery(delivery)'));
  assert.ok(read(dir, `${base}/index.ts`).includes('export { PaymentGatewayHttpModule }'));
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['webhooks']);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api', 'webhooks']);
});

test('hfs add realtime writes the transport/graphql subscription tree and registers the kind and its pattern', async () => {
  const dir = repo();
  const result = await cli(['add', 'realtime', 'order-status', '--service', 'orderStatusTopic=@modules/domain/order', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/realtime/order-status';
  for (const file of ['index.ts', 'transport/graphql/order-status-graphql.module.ts', 'transport/graphql/order-status.subscription.ts', 'transport/graphql/order-status.subscription.spec.ts', 'transport/graphql/dto/order-status-changed.type.ts', 'transport/graphql/dto/order-status.input.ts']) {
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  const door = read(dir, `${base}/transport/graphql/order-status.subscription.ts`);
  assert.match(door, /export class OrderStatusSubscription/);
  assert.ok(door.includes('this.hub.subscribe(orderStatusTopic(principal.id, input.id))'));
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['realtime']);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api', 'realtime']);
});

test('hfs add refuses an unknown noun, a bad name and a repository that is not an app root', async () => {
  const dir = repo();
  assert.match((await cli(['add', 'widget', 'x', '--repo', dir])).err, /HFS_ADD_NOUN_UNKNOWN/);
  assert.match((await cli(['add', 'queue', 'Bad_Name', '--repo', dir])).err, /HFS_ADD_NAME_INVALID/);
  assert.match((await cli(['add', 'queue', 'x', '--repo', path.join(dir, 'be')])).err, /HFS_ADD_NOT_AN_APP/);
  assert.match((await cli(['add', 'queue'])).err, /takes `<noun> <name>`/);
});

test('hfs add api writes a feature with one operation: the application, the graphql door and its module, and registers the api kind', async () => {
  const dir = repo();
  const missing = await cli(['add', 'api', 'checkout', '--repo', dir]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /HFS_ADD_OPTION_MISSING.*--service/);
  const result = await cli(['add', 'api', 'checkout', '--service', 'CheckoutService=@modules/domain/order', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  const base = 'be/src/features/checkout';
  const files = ['index.ts', 'checkout.module.ts', 'application/checkout.command.ts', 'application/checkout.handler.ts', 'application/checkout.contracts.ts', 'transport/graphql/checkout.resolver.ts', 'transport/graphql/checkout.mapper.ts', 'transport/graphql/dto/checkout.input.ts', 'transport/graphql/dto/checkout.type.ts', 'transport/graphql/checkout-graphql.module.ts'];
  for (const file of files) assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  assert.match(read(dir, `${base}/application/checkout.handler.ts`), /this\.checkoutService\.checkout\(command\.params\.request\)/);
  assert.match(read(dir, `${base}/transport/graphql/checkout.resolver.ts`), /@Mutation\(\(\) => CheckoutType, \{ name: "checkout" \}\)/);
  assert.equal(exists(dir, `${base}/transport/http`), false, 'an optional entry is not generated');
  assert.deepEqual(hfsJson(dir).sides.be.patterns ?? [], []);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api']);
});

test('hfs add cli writes the command line capability with the first command, its entry registered with the registry, and declares the cli pattern and kind', async () => {
  const dir = repo();
  const result = await cli(['add', 'cli', 'requeue-dead-letter', '--service', 'DeadLetterService=@modules/domain/order', '--repo', dir]);
  assert.equal(result.code, 0, result.err);
  for (const file of ['index.ts', 'cli.module.ts', 'cli.port.ts', 'cli.contracts.ts', 'cli.decorators.ts', 'cli-runner.service.ts', 'cli-runner.service.spec.ts']) {
    assert.ok(parses(read(dir, `be/src/modules/platform/cli/${file}`)), `platform/cli/${file} parses`);
  }
  const base = 'be/src/features/cli/requeue-dead-letter';
  for (const file of ['index.ts', 'requeue-dead-letter.module.ts', 'application/requeue-dead-letter.command.ts', 'application/requeue-dead-letter.handler.ts', 'application/requeue-dead-letter.contracts.ts', 'transport/cli/requeue-dead-letter.cli.ts', 'transport/cli/requeue-dead-letter-cli.module.ts']) {
    assert.ok(parses(read(dir, `${base}/${file}`)), `${file} parses`);
  }
  assert.match(read(dir, `${base}/transport/cli/requeue-dead-letter.cli.ts`), /export class RequeueDeadLetterCli implements CliCommand/);
  assert.match(read(dir, `${base}/transport/cli/requeue-dead-letter-cli.module.ts`), /this\.registry\.add\(this\.entry\)/);
  assert.deepEqual(hfsJson(dir).sides.be.patterns, ['cli']);
  assert.deepEqual(hfsJson(dir).sides.be.kinds, ['api', 'cli']);
  assert.equal((await cli(['add', 'cli', 'rebuild', '--service', 'DeadLetterService=@modules/domain/order', '--repo', dir])).code, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'be/src/modules/platform/cli/cli.module.ts'), 'utf8'), read(dir, 'be/src/modules/platform/cli/cli.module.ts'), 'the capability is written once');
});
