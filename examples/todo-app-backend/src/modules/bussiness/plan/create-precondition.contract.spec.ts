import { CreateTaskCommand, CreateTaskHandler, TaskCreationPolicyRegistry, TaskService } from '@modules/bussiness/task';
import { PlatformEventBus } from '../../platform/events';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { SubscriptionEntity } from '../../platform/databases/postgresql/primary';
import { SubscriptionService } from './subscription.service';
import { PlanCapGuardPolicy } from './cap-guard.policy';

/**
 * contract.plan.create-precondition: proves both halves of the contract together, without editing a
 * single file under `bussiness/task`. The provider half (sds.plan.cap-guard) is PlanCapGuardPolicy
 * itself; the consumer half ("The task create path calls checkCanCreateTask before writing and honors a
 * false result") is task's own, unmodified CreateTaskHandler - constructed here exactly the way
 * PlanModule.onModuleInit wires the real app (registry.register(capGuardPolicy)), then driven through
 * the real command. This is the strongest proof this lane can produce for the consumer obligation: the
 * actual class fr.task.create's real handler depends on (TaskCreationPolicyRegistry), carrying the
 * actual policy this feature registers into it, refusing the actual command task's resolver dispatches.
 */
describe('contract.plan.create-precondition', () => {
  it('the task create path calls the guard before writing and honors a refusal, naming the cap and the upgrade path', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    const capGuardPolicy = new PlanCapGuardPolicy(subscriptionService, taskService);
    const registry = new TaskCreationPolicyRegistry();
    registry.register(capGuardPolicy); // exactly what PlanModule.onModuleInit does in the real app
    const createTaskHandler = new CreateTaskHandler(taskService, registry, new PlatformEventBus());

    for (let i = 0; i < 20; i += 1) {
      await createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: `task-${i}` }));
    }

    await expect(
      createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'the 21st' })),
    ).rejects.toMatchObject({
      code: 'PLAN_CAP_EXCEEDED',
      metadata: expect.objectContaining({ cap: 20, upgradePath: expect.any(String) }),
    });

    // guarantee: "The check reads live state at call time; it is never cached across a create." - a
    // completion frees a slot for the very next call, proving the guard is re-evaluated, not memoized.
    const owned = await taskService.listOwnedBy('owner-1');
    await taskService.complete(owned[0].id, 'owner-1');
    const result = await createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'now allowed' }));
    expect(result.title).toBe('now allowed');
  });

  it('nothing is written when the create is refused', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    const registry = new TaskCreationPolicyRegistry();
    registry.register(new PlanCapGuardPolicy(subscriptionService, taskService));
    const createTaskHandler = new CreateTaskHandler(taskService, registry, new PlatformEventBus());

    for (let i = 0; i < 20; i += 1) {
      await createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: `task-${i}` }));
    }
    await expect(
      createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'refused' })),
    ).rejects.toMatchObject({ code: 'PLAN_CAP_EXCEEDED' });

    expect(await taskService.listOwnedBy('owner-1')).toHaveLength(20);
  });

  it('a paid person is never refused by the same real create path', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    const registry = new TaskCreationPolicyRegistry();
    registry.register(new PlanCapGuardPolicy(subscriptionService, taskService));
    const createTaskHandler = new CreateTaskHandler(taskService, registry, new PlatformEventBus());

    await subscriptionService.tCheckoutStarted('owner-2');
    const subscription = await subscriptionService.getOrCreate('owner-2');
    await subscriptionService.tGatewayConfirmed(subscription.id, new Date());

    for (let i = 0; i < 25; i += 1) {
      await createTaskHandler.execute(new CreateTaskCommand({ ownerId: 'owner-2', title: `task-${i}` }));
    }
    expect(await taskService.listOwnedBy('owner-2')).toHaveLength(25);
  });
});
