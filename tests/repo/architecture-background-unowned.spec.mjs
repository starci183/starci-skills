import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-be-fixture.mjs';

// R46 background-unowned (BE_BACKGROUND_UNOWNED): background entrypoints and the actual methods they call must be owned by
// a worker or api app. File roles and imported framework decorators establish background context; method names never do.
const PROCESSOR = "import { PurgeHandler } from './application/purge.handler';\nexport class SweepProcessor {\n  constructor(private readonly purgeHandler: PurgeHandler) {}\n  async process(): Promise<void> { await this.purgeHandler.purge(); }\n}\n";
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
  assert.equal(coverage.workers, 1, 'only the worker app composes background transports in this fixture');
  assert.equal(coverage.composed, 1);
  assert.equal(coverage.backgroundMethods, 3, 'process calls purge, which calls sweepExpired');
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

test('background-like method names and ordinary timers do not establish background context', t => {
  const report = run(t, {
    'src/modules/domain/orders/index.ts': "export { OrdersService } from './orders.service';\n",
    'src/modules/domain/orders/orders.service.ts': `export class OrdersService {
  sweepExpired(): void {}
  deliverReceipts(): void {}
  reconcile(): void {}
  retryFailed(): void {}
  replayTransfer(): void {}
  delivery(): void {}
  tick(): void {}
  start(): void { setInterval(() => this.tick(), 1000); }
}
`,
  });
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 3);
});

test('consumer, scheduler, saga and event-handler file roles seed all their methods and are owned by their composed module', t => {
  const report = run(t, {
    'src/features/jobs/sweep/sweep.module.ts': `import { Module } from '@nestjs/common';
import { SweepProcessor } from './sweep.processor';
import { PaidConsumer } from './paid.consumer';
import { ClockScheduler } from './clock.scheduler';
import { OrdersSaga } from './orders.saga';
import { PaidHandler } from './paid.event-handler';
@Module({ providers: [SweepProcessor, PaidConsumer, ClockScheduler, OrdersSaga, PaidHandler] })
export class SweepModule {}
`,
    'src/features/jobs/sweep/paid.consumer.ts': 'export class PaidConsumer { consume(): void {} ack(): void {} }\n',
    'src/features/jobs/sweep/clock.scheduler.ts': 'export class ClockScheduler { tick(): void {} start(): void {} }\n',
    'src/features/jobs/sweep/orders.saga.ts': 'export class OrdersSaga { observe(): void {} }\n',
    'src/features/jobs/sweep/paid.event-handler.ts': 'export class PaidHandler { accept(): void {} ack(): void {} }\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 10);
});

test('uncomposed scheduler, saga and event-handler files are reported even when their methods have neutral names', t => {
  const report = run(t, {
    'src/features/jobs/unowned/index.ts': 'export const unowned = 1;\n',
    'src/features/jobs/unowned/clock.scheduler.ts': 'export class ClockScheduler { tick(): void {} start(): void {} }\n',
    'src/features/jobs/unowned/orders.saga.ts': 'export class OrdersSaga { observe(): void {} }\n',
    'src/features/jobs/unowned/paid.event-handler.ts': 'export class PaidHandler { accept(): void {} ack(): void {} }\n',
  });
  assert.deepEqual(hits(report).filter(item => item.role).map(item => `${item.role}:${item.path}`).sort(), [
    'event-handler:src/features/jobs/unowned/paid.event-handler.ts',
    'saga:src/features/jobs/unowned/orders.saga.ts',
    'scheduler:src/features/jobs/unowned/clock.scheduler.ts',
  ]);
  assert.deepEqual(hits(report).filter(item => item.method).map(item => item.method).sort(), ['accept', 'ack', 'observe', 'start', 'tick']);
});

test('imported Processor and EventsHandler class decorators seed every method, including aliases and namespaces', t => {
  const report = run(t, {
    'src/modules/domain/tasks/index.ts': "export { TaskRunner } from './task-runner.service';\nexport { PaidListener } from './paid-listener.service';\n",
    'src/modules/domain/tasks/task-runner.service.ts': `import { Processor as Job } from '@nestjs/bullmq';
@Job('tasks')
export class TaskRunner { process(): void {} assist(): void {} }
`,
    'src/modules/domain/tasks/paid-listener.service.ts': `import * as cqrs from '@nestjs/cqrs';
@cqrs.EventsHandler(class Paid {})
export class PaidListener { handle(): void {} acknowledge(): void {} }
`,
  });
  assert.deepEqual(hits(report).filter(item => !item.method).map(item => item.path).sort(), [
    'src/modules/domain/tasks/paid-listener.service.ts',
    'src/modules/domain/tasks/task-runner.service.ts',
  ]);
  assert.deepEqual(hits(report).filter(item => item.method).map(item => item.method).sort(), ['acknowledge', 'assist', 'handle', 'process']);
});

test('Cron, Interval, Timeout, Saga and OnEvent decorators seed only the decorated method and its actual calls', t => {
  const report = run(t, {
    'src/modules/domain/orders/index.ts': "export { OrdersService } from './orders.service';\nexport { OrdersFlow } from './orders-flow.service';\nexport { OrdersListener } from './orders-listener.service';\n",
    'src/modules/domain/orders/orders.service.ts': `import { Cron as Scheduled, Interval } from '@nestjs/schedule';
import * as schedule from '@nestjs/schedule';
export class OrdersService {
  @Scheduled('* * * * *') tick(): void { this.clean(); }
  @Interval(1000) poll(): void {}
  @schedule.Timeout(1000) wake(): void {}
  clean(): void {}
  retryInteractive(): void {}
}
`,
    'src/modules/domain/orders/orders-flow.service.ts': `import { Saga as Flow } from '@nestjs/cqrs';
export class OrdersFlow {
  @Flow() observe(): void {}
  replayInteractive(): void {}
}
`,
    'src/modules/domain/orders/orders-listener.service.ts': `import * as events from '@nestjs/event-emitter';
export class OrdersListener {
  @events.OnEvent('order.paid') accept(): void {}
  retryInteractive(): void {}
}
`,
  });
  assert.deepEqual(hits(report).filter(item => !item.method).map(item => item.path).sort(), [
    'src/modules/domain/orders/orders-flow.service.ts',
    'src/modules/domain/orders/orders-listener.service.ts',
    'src/modules/domain/orders/orders.service.ts',
  ]);
  assert.deepEqual(hits(report).filter(item => item.method).map(item => item.method).sort(), ['accept', 'clean', 'observe', 'poll', 'tick', 'wake']);
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 9);
});

test('framework class and method contexts are owned when their classes are imported by a composed module', t => {
  const report = run(t, {
    'src/features/jobs/sweep/sweep.module.ts': `import { Module } from '@nestjs/common';
import { SweepProcessor } from './sweep.processor';
import { ExtraRunner, PaidListener, ExtraSchedules } from './extra.service';
@Module({ providers: [SweepProcessor, ExtraRunner, PaidListener, ExtraSchedules] })
export class SweepModule {}
`,
    'src/features/jobs/sweep/extra.service.ts': `import { Processor } from '@nestjs/bull';
import { EventsHandler, Saga } from '@nestjs/cqrs';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, Interval, Timeout } from '@nestjs/schedule';
@Processor('extra')
export class ExtraRunner { process(): void {} assist(): void {} }
@EventsHandler(class Paid {})
export class PaidListener { handle(): void {} acknowledge(): void {} }
export class ExtraSchedules {
  @Cron('* * * * *') tick(): void {}
  @Interval(1000) poll(): void {}
  @Timeout(1000) wake(): void {}
  @Saga() observe(): void {}
  @OnEvent('order.paid') accept(): void {}
  retryInteractive(): void {}
}
`,
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 12);
});

test('same-named local or unrelated-package decorators do not establish background context', t => {
  const report = run(t, {
    'src/modules/domain/manual/index.ts': "export { ManualService } from './manual.service';\n",
    'src/modules/domain/manual/manual.service.ts': `import { Cron, Interval, Timeout, Saga, OnEvent, Processor } from 'manual-decorators';
function EventsHandler(...args: unknown[]): ClassDecorator { return () => {}; }
@Processor('manual')
@EventsHandler()
export class ManualService {
  @Cron('* * * * *') tick(): void {}
  @Interval(1000) poll(): void {}
  @Timeout(1000) wake(): void {}
  @Saga() observe(): void {}
  @OnEvent('paid') accept(): void {}
}
`,
  });
  assert.deepEqual(hits(report), []);
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 3);
});

test('user-triggered retry and replay resolvers, controllers and their services are never background, even when a processor calls them', t => {
  const report = run(t, {
    'src/modules/domain/manual/user.processor.ts': "import { Resolver } from '@nestjs/graphql';\n@Resolver()\nexport class UserResolver { retry(): void {} replay(): void {} }\n",
    'src/modules/domain/manual/user.saga.ts': "import { Controller } from '@nestjs/common';\n@Controller()\nexport class UserController { retry(): void {} replay(): void {} }\n",
    'src/features/jobs/sweep/sweep.processor.ts': `import { PurgeHandler } from './application/purge.handler';
import { RetryResolver } from '../../../modules/domain/manual/retry.resolver';
import { ReplayController } from '../../../modules/domain/manual/replay.controller';
import { GraphqlEndpoint, HttpEndpoint } from '../../../modules/domain/manual/endpoints.service';
export class SweepProcessor {
  constructor(private readonly purgeHandler: PurgeHandler, private readonly resolver: RetryResolver,
    private readonly controller: ReplayController, private readonly graphql: GraphqlEndpoint, private readonly http: HttpEndpoint) {}
  async process(): Promise<void> {
    await this.purgeHandler.purge();
    this.resolver.retryPayment();
    this.controller.replayPayment();
    this.graphql.replayPayment();
    this.http.retryPayment();
  }
}
`,
    'src/modules/domain/manual/index.ts': "export { ManualService } from './manual.service';\n",
    'src/modules/domain/manual/manual.service.ts': 'export class ManualService { retryPayment(): void {} replayPayment(): void {} }\n',
    'src/modules/domain/manual/retry.resolver.ts': `import { ManualService } from './manual.service';
import { Processor } from '@nestjs/bullmq';
@Processor('manual')
export class RetryResolver {
  constructor(private readonly service: ManualService) {}
  retryPayment(): void { this.service.retryPayment(); }
}
`,
    'src/modules/domain/manual/replay.controller.ts': `import { ManualService } from './manual.service';
import { OnEvent } from '@nestjs/event-emitter';
export class ReplayController {
  constructor(private readonly service: ManualService) {}
  @OnEvent('manual') replayPayment(): void { this.service.replayPayment(); }
}
`,
    'src/modules/domain/manual/endpoints.service.ts': `import { ManualService } from './manual.service';
import { Resolver as Graphql, Mutation } from '@nestjs/graphql';
import * as http from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
@Graphql()
export class GraphqlEndpoint {
  constructor(private readonly service: ManualService) {}
  @Mutation() @Cron('* * * * *') replayPayment(): void { this.service.replayPayment(); }
}
@http.Controller('manual')
export class HttpEndpoint {
  constructor(private readonly service: ManualService) {}
  @http.Post('retry') retryPayment(): void { this.service.retryPayment(); }
}
`,
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 3);
});

test('unowned context propagates through actual transitive call targets and platform bridges, without following same-named or unused methods', t => {
  const report = run(t, {
    'src/features/jobs/unowned/index.ts': 'export const unowned = 1;\n',
    'src/features/jobs/unowned/task.processor.ts': `import { SelectedService } from './selected.service';
import { UnusedService } from './unused.service';
export class TaskProcessor {
  constructor(private readonly selected: SelectedService, private readonly unused: UnusedService) {}
  process(): void { this.selected.execute(); }
}
`,
    'src/features/jobs/unowned/selected.service.ts': `import { RelayService } from '../../../modules/platform/relay/relay.service';
export class SelectedService {
  constructor(private readonly relay: RelayService) {}
  execute(): void { this.clean(); }
  clean(): void { this.relay.forward(); }
  retryInteractive(): void {}
}
`,
    'src/features/jobs/unowned/unused.service.ts': 'export class UnusedService { execute(): void {} clean(): void {} retryFailed(): void {} }\n',
    'src/modules/platform/relay/index.ts': "export { RelayService } from './relay.service';\n",
    'src/modules/platform/relay/relay.service.ts': `import { FinalizerService } from '../../domain/finalizer/finalizer.service';
export class RelayService {
  constructor(private readonly finalizer: FinalizerService) {}
  forward(): void { this.finalizer.finish(); }
}
`,
    'src/modules/domain/finalizer/index.ts': "export { FinalizerService } from './finalizer.service';\n",
    'src/modules/domain/finalizer/finalizer.service.ts': 'export class FinalizerService { finish(): void {} replayInteractive(): void {} }\n',
  });
  assert.deepEqual(hits(report).filter(item => item.method).map(item => `${item.path}:${item.method}`).sort(), [
    'src/features/jobs/unowned/selected.service.ts:clean',
    'src/features/jobs/unowned/selected.service.ts:execute',
    'src/features/jobs/unowned/task.processor.ts:process',
    'src/modules/domain/finalizer/finalizer.service.ts:finish',
  ]);
  assert.ok(hits(report).some(item => item.role === 'processor' && item.path === 'src/features/jobs/unowned/task.processor.ts'));
  assert.ok(hits(report).every(item => !item.path.startsWith('src/modules/platform/')));
});

test('processor arrow properties seed background context and follow called service arrow properties', t => {
  const report = run(t, {
    'src/features/jobs/unowned/index.ts': 'export const unowned = 1;\n',
    'src/features/jobs/unowned/task.processor.ts': `import { ArrowService } from '../../../modules/domain/arrows/arrow.service';
export class TaskProcessor {
  constructor(private readonly arrows: ArrowService) {}
  process = (): void => { this.arrows.execute(); };
}
`,
    'src/modules/domain/arrows/index.ts': "export { ArrowService } from './arrow.service';\n",
    'src/modules/domain/arrows/arrow.service.ts': `export class ArrowService {
  execute = (): void => { this.finish(); };
  finish(): void {}
  retryInteractive = (): void => {};
}
`,
  });
  assert.deepEqual(hits(report).filter(item => item.method).map(item => `${item.path}:${item.method}`).sort(), [
    'src/features/jobs/unowned/task.processor.ts:process',
    'src/modules/domain/arrows/arrow.service.ts:execute',
    'src/modules/domain/arrows/arrow.service.ts:finish',
  ]);
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 6);
});

test('inherited processor entrypoints are background while inherited resolver bodies and their service calls remain user-triggered', t => {
  const report = run(t, {
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', experimentalDecorators: true, strictNullChecks: true, noEmit: true }, include: ['src/**/*', 'apps/**/*'] }),
    'src/features/jobs/unowned/index.ts': 'export const unowned = 1;\n',
    'src/features/jobs/unowned/task.processor.ts': "import { BaseRunner } from './base-runner.service';\nexport class TaskProcessor extends BaseRunner {}\n",
    'src/features/jobs/unowned/base-runner.service.ts': `import { SelectedService } from './selected.service';
import { RetryEndpoint } from '../../../modules/domain/manual/retry-endpoint.service';
export class BaseRunner {
  constructor(private readonly selected: SelectedService, private readonly resolver: RetryEndpoint | undefined) {}
  process(): void {
    this.selected.execute();
    this.resolver?.retryPayment();
  }
}
`,
    'src/features/jobs/unowned/selected.service.ts': 'export class SelectedService { execute(): void {} }\n',
    'src/modules/domain/manual/index.ts': "export { RetryEndpoint } from './retry-endpoint.service';\n",
    'src/modules/domain/manual/retry-endpoint.service.ts': `import { Resolver } from '@nestjs/graphql';
import { UserEndpointBase } from './user-endpoint-base.service';
@Resolver()
export class RetryEndpoint extends UserEndpointBase {}
`,
    'src/modules/domain/manual/user-endpoint-base.service.ts': `import { ManualService } from './manual.service';
export class UserEndpointBase {
  constructor(private readonly manual: ManualService) {}
  retryPayment(): void { this.manual.retryPayment(); }
}
`,
    'src/modules/domain/manual/manual.service.ts': 'export class ManualService { retryPayment(): void {} }\n',
  });
  assert.deepEqual(hits(report).filter(item => item.method).map(item => `${item.path}:${item.method}`).sort(), [
    'src/features/jobs/unowned/base-runner.service.ts:process',
    'src/features/jobs/unowned/selected.service.ts:execute',
  ]);
  assert.ok(hits(report).some(item => item.role === 'processor' && item.path === 'src/features/jobs/unowned/task.processor.ts'));
  assert.ok(hits(report).every(item => !item.path.startsWith('src/modules/domain/manual/')));
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 5);
});

test('uninvoked nested functions and classes inside a processor do not seed background methods or calls', t => {
  const report = run(t, {
    'src/features/jobs/unowned/index.ts': 'export const unowned = 1;\n',
    'src/features/jobs/unowned/task.processor.ts': `import { HiddenService } from '../../../modules/domain/hidden/hidden.service';
export class TaskProcessor {
  constructor(private readonly hidden: HiddenService) {}
  process(): void {
    const hidden = this.hidden;
    function deferred(): void { hidden.execute(); }
    const later = (): void => { this.hidden.execute(); };
    class DeferredHandler { start(): void { hidden.execute(); } }
  }
}
`,
    'src/modules/domain/hidden/index.ts': "export { HiddenService } from './hidden.service';\n",
    'src/modules/domain/hidden/hidden.service.ts': 'export class HiddenService { execute(): void {} }\n',
  });
  assert.deepEqual(hits(report).filter(item => item.method).map(item => `${item.path}:${item.method}`), [
    'src/features/jobs/unowned/task.processor.ts:process',
  ]);
  assert.equal(report.coverage.hfsMachine.backgroundUnowned.backgroundMethods, 4);
});

test('a processor composed by the root module of an api app is not BE_BACKGROUND_UNOWNED: a service runs its own background work', t => {
  const report = run(t, {
    'apps/jobs/src/app.module.ts': "import { Module } from '@nestjs/common';\n@Module({})\nexport class AppModule {}\n",
    'apps/core/src/main.ts': 'void 0;\n',
    'apps/core/src/app.module.ts': WORKER_APP,
  });
  assert.deepEqual(hits(report).filter(item => item.role), [], JSON.stringify(hits(report), null, 1));
});
