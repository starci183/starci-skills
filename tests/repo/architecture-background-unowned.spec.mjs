import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R46 background-unowned (BE_BACKGROUND_UNOWNED): every job processor and consumer is composed by a worker or api app, and a
// sweep/deliver/reconcile/retry method is reachable from a composed processor or consumer. A schedule is a BullMQ job scheduler, so no
// scheduler decorator or timer is judged here (BE_INFRA_OWNER owns them).
const PROCESSOR = "export class SweepProcessor {\n  async process(): Promise<void> { return Promise.resolve(); }\n}\n";
const JOB_MODULE = "import { Module } from '@nestjs/common';\nimport { SweepProcessor } from './sweep.processor';\n@Module({ providers: [SweepProcessor] })\nexport class SweepModule {}\n";
const WORKER_APP = "import { Module } from '@nestjs/common';\nimport { SweepModule } from '../../../src/features/jobs/sweep';\n@Module({ imports: [SweepModule] })\nexport class AppModule {}\n";
const BILLING = {
  'src/modules/domain/billing/index.ts': "export { BillingService } from './billing.service';\n",
  'src/modules/domain/billing/billing.service.ts': 'export class BillingService {\n  async sweepExpired(): Promise<number> { return 0; }\n}\n',
};
const FEATURE = {
  'src/features/jobs/sweep/index.ts': "export { SweepModule } from './sweep.module';\n",
  'src/features/jobs/sweep/sweep.module.ts': JOB_MODULE,
  'src/features/jobs/sweep/application/purge.handler.ts': "import { BillingService } from '../../../../modules/domain/billing';\nexport class PurgeHandler {\n  constructor(private readonly billing: BillingService) {}\n  purge(): Promise<number> { return this.billing.sweepExpired(); }\n}\n",
  'src/features/jobs/sweep/sweep.processor.ts': PROCESSOR,
};
const APPS = [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }];
const DECLARATION = { patterns: ['fenced-job'] };
const hits = report => findings(report, 'BE_BACKGROUND_UNOWNED');
const run = (t, files, apps = APPS) => runArch(archFixture(t, { apps, declaration: DECLARATION, files: { ...BILLING, ...FEATURE, 'apps/jobs/src/main.ts': 'void 0;\n', 'apps/jobs/src/app.module.ts': WORKER_APP, ...files } }));

test('a processor composed by a worker app and a background method reachable from it raise no BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.backgroundUnowned;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.workers, 2, 'the api app and the worker app both compose background transports');
  assert.equal(coverage.composed, 1);
  assert.equal(coverage.backgroundMethods, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_BACKGROUND_UNOWNED'));
});

test('a processor and a consumer no worker or api app composes, or with no worker app declared, are BE_BACKGROUND_UNOWNED', t => {
  const orphan = run(t, {
    'apps/jobs/src/app.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
    'src/features/api/b/index.ts': 'export const b = 1;\n',
    'src/features/api/b/transport/message/paid.consumer.ts': 'export class PaidConsumer {}\n',
  });
  assert.deepEqual(hits(orphan).filter(item => item.role).map(item => `${item.role}:${item.path}`).sort(),
    ['consumer:src/features/api/b/transport/message/paid.consumer.ts', 'processor:src/features/jobs/sweep/sweep.processor.ts']);
  const noWorker = run(t, { 'apps/jobs/src/app.module.ts': null, 'apps/jobs/src/main.ts': null }, [{ name: 'core', kind: 'api' }]);
  assert.ok(hits(noWorker).some(item => item.role === 'processor' && /declares no worker app/.test(item.message)));
});

test('@Cron, @Interval and setInterval are no longer judged here: a schedule is a queue scheduler and BE_INFRA_OWNER owns the libraries', t => {
  const report = run(t, {
    'src/modules/domain/orders/index.ts': "export { OrdersService } from './orders.service';\n",
    'src/modules/domain/orders/orders.service.ts': "import { Cron, Interval } from '@nestjs/schedule';\nexport class OrdersService {\n  @Cron('* * * * *') tick(): void {}\n  @Interval(1000) poll(): void {}\n  start(): void { setInterval(() => this.tick(), 1000); }\n}\n",
  });
  assert.deepEqual(hits(report).filter(item => item.scheduler), []);
});

test('a sweep, deliver, reconcile or retry method no composed processor or consumer reaches is BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, {
    'src/modules/domain/payments/index.ts': "export { PaymentsService } from './payments.service';\n",
    'src/modules/domain/payments/payments.service.ts': 'export class PaymentsService {\n  async deliverReceipts(): Promise<void> {}\n  async reconcile(): Promise<void> {}\n  async retryFailed(): Promise<void> {}\n  async delivery(): Promise<void> {}\n}\n',
  });
  const found = hits(report).filter(item => item.method);
  assert.deepEqual(found.map(item => item.method).sort(), ['deliverReceipts', 'reconcile', 'retryFailed']);
});

test('a processor composed by the root module of an api app is not BE_BACKGROUND_UNOWNED: a service runs its own background work', t => {
  const report = run(t, {
    'apps/jobs/src/app.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
    'apps/core/src/main.ts': 'void 0;\n',
    'apps/core/src/app.module.ts': WORKER_APP,
  });
  assert.deepEqual(hits(report).filter(item => item.role), [], JSON.stringify(hits(report), null, 1));
});
