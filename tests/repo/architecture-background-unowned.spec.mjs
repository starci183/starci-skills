import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R46 background-unowned (BE_BACKGROUND_UNOWNED): every job and consumer is composed by an app (the api app that owns it or a worker app), no @Cron/@Interval/
// setInterval outside platform/scheduling, and a sweep/deliver/reconcile/retry method is reachable from a composed job or consumer.
const JOB = "export class SweepJob {\n  readonly name = 'sweep';\n  run(): Promise<void> { return Promise.resolve(); }\n}\n";
const SCHEDULE_MODULE = "import { Module } from '@nestjs/common';\nimport { SweepJob } from './sweep.job';\n@Module({ providers: [SweepJob] })\nexport class AScheduleModule {}\n";
const WORKER_APP = "import { Module } from '@nestjs/common';\nimport { AScheduleModule } from '../../../src/features/api/a';\n@Module({ imports: [AScheduleModule] })\nexport class AppModule {}\n";
const BILLING = {
  'src/modules/domain/billing/index.ts': "export { BillingService } from './billing.service';\n",
  'src/modules/domain/billing/billing.service.ts': 'export class BillingService {\n  async sweepExpired(): Promise<number> { return 0; }\n}\n',
};
const FEATURE = {
  'src/features/api/a/index.ts': "export { AScheduleModule } from './transport/schedule/a-schedule.module';\n",
  'src/features/api/a/a.module.ts': "export class AModule {}\n",
  'src/features/api/a/application/purge.handler.ts': "import { BillingService } from '../../../../modules/domain/billing';\nexport class PurgeHandler {\n  constructor(private readonly billing: BillingService) {}\n  purge(): Promise<number> { return this.billing.sweepExpired(); }\n}\n",
  'src/features/api/a/transport/schedule/sweep.job.ts': JOB,
  'src/features/api/a/transport/schedule/a-schedule.module.ts': SCHEDULE_MODULE,
};
const APPS = [{ name: 'core', kind: 'api' }, { name: 'jobs', kind: 'worker' }];
const hits = report => findings(report, 'BE_BACKGROUND_UNOWNED');
const run = (t, files, apps = APPS) => runArch(archFixture(t, { apps, files: { ...BILLING, ...FEATURE, 'apps/jobs/src/main.ts': 'void 0;\n', 'apps/jobs/src/app.module.ts': WORKER_APP, ...files } }));

test('a job composed by a worker app and a background method reachable from it raise no BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  const coverage = report.coverage.hfsMachine.backgroundUnowned;
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.workers, 2, 'the api app and the worker app both compose background transports');
  assert.equal(coverage.composed, 1);
  assert.equal(coverage.backgroundMethods, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_BACKGROUND_UNOWNED'));
});

test('a job and a consumer no worker app composes, or with no worker app declared, are BE_BACKGROUND_UNOWNED', t => {
  const orphan = run(t, {
    'apps/jobs/src/app.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
    'src/features/api/b/index.ts': 'export const b = 1;\n',
    'src/features/api/b/transport/message/paid.consumer.ts': 'export class PaidConsumer {}\n',
  });
  assert.deepEqual(hits(orphan).filter(item => item.role).map(item => `${item.role}:${item.path}`).sort(),
    ['consumer:src/features/api/b/transport/message/paid.consumer.ts', 'job:src/features/api/a/transport/schedule/sweep.job.ts']);
  const noWorker = run(t, { 'apps/jobs/src/app.module.ts': null, 'apps/jobs/src/main.ts': null }, [{ name: 'core', kind: 'api' }]);
  assert.ok(hits(noWorker).some(item => item.role === 'job' && /no app composes/.test(item.message)), 'an api app that does not compose the job leaves it unowned');
});

test('a job composed by the api app that owns it, with no worker app at all, raises no BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, { 'apps/jobs/src/app.module.ts': null, 'apps/jobs/src/main.ts': null, 'apps/core/src/app.module.ts': WORKER_APP }, [{ name: 'core', kind: 'api' }]);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.composed, 1);
});

test('@Cron, @Interval and setInterval outside platform/scheduling are BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, {
    'src/modules/domain/orders/index.ts': "export { OrdersService } from './orders.service';\n",
    'src/modules/domain/orders/orders.service.ts': "import { Cron, Interval } from '@nestjs/schedule';\nexport class OrdersService {\n  @Cron('* * * * *') tick(): void {}\n  @Interval(1000) poll(): void {}\n  start(): void { setInterval(() => this.tick(), 1000); }\n}\n",
    'src/modules/platform/scheduling/index.ts': "export { SchedulingService } from './scheduling.service';\n",
    'src/modules/platform/scheduling/scheduling.service.ts': "import { Interval } from '@nestjs/schedule';\nexport class SchedulingService {\n  @Interval(1000) tick(): void {}\n  start(): void { setInterval(() => this.tick(), 1000); }\n}\n",
  });
  const found = hits(report).filter(item => item.scheduler);
  assert.deepEqual(found.map(item => item.scheduler).sort(), ['Cron', 'Interval', 'setInterval']);
  assert.ok(found.every(item => item.path === 'src/modules/domain/orders/orders.service.ts'));
});

test('a sweep, deliver, reconcile or retry method no composed job or consumer reaches is BE_BACKGROUND_UNOWNED', t => {
  const report = run(t, {
    'src/modules/domain/payments/index.ts': "export { PaymentsService } from './payments.service';\n",
    'src/modules/domain/payments/payments.service.ts': 'export class PaymentsService {\n  async deliverReceipts(): Promise<void> {}\n  async reconcile(): Promise<void> {}\n  async retryFailed(): Promise<void> {}\n  async delivery(): Promise<void> {}\n}\n',
  });
  const found = hits(report).filter(item => item.method);
  assert.deepEqual(found.map(item => item.method).sort(), ['deliverReceipts', 'reconcile', 'retryFailed']);
});
