import { TaskService } from '@modules/bussiness/task';
import { TaskEntity, SubscriptionEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { SubscriptionService } from './subscription.service';
import { PlanUsageQuery } from './plan-usage.query';
import { PlanUsageHandler } from './plan-usage.handler';

describe('PlanUsageHandler (fr.plan.usage.view)', () => {
  let taskService: TaskService;
  let subscriptionService: SubscriptionService;
  let handler: PlanUsageHandler;

  beforeEach(() => {
    taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    handler = new PlanUsageHandler(subscriptionService, taskService);
  });

  it('a free person under the cap sees their count against 20', async () => {
    for (let i = 0; i < 5; i += 1) await taskService.create('owner-1', `task-${i}`);

    const result = await handler.execute(new PlanUsageQuery({ ownerId: 'owner-1' }));

    expect(result.plan).toBe('free');
    expect(result.cap).toBe(20);
    expect(result.activeCount).toBe(5);
  });

  it('ac.plan.active-scope.excludes-complete: the shown count excludes completed tasks', async () => {
    for (let i = 0; i < 19; i += 1) await taskService.create('owner-1', `task-${i}`);
    const completed = await taskService.create('owner-1', 'the 20th');
    await taskService.complete(completed.id, 'owner-1');

    const result = await handler.execute(new PlanUsageQuery({ ownerId: 'owner-1' }));
    expect(result.activeCount).toBe(19);
  });

  it('fr.plan.usage.view mainFlow: a paid person sees no cap', async () => {
    await subscriptionService.tCheckoutStarted('owner-1');
    const subscription = await subscriptionService.getOrCreate('owner-1');
    await subscriptionService.tGatewayConfirmed(subscription.id, new Date());
    for (let i = 0; i < 40; i += 1) await taskService.create('owner-1', `task-${i}`);

    const result = await handler.execute(new PlanUsageQuery({ ownerId: 'owner-1' }));

    expect(result.plan).toBe('paid');
    expect(result.cap).toBeNull();
    expect(result.activeCount).toBe(40);
  });
});
