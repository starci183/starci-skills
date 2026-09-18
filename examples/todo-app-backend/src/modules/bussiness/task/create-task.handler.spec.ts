import { AbstractException } from '@modules/shared/exceptions';
import { PlatformEventBus, TaskCreatedEvent } from '../../platform/events';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { TaskCreationPolicy, CreateTaskInputParams, CreateTaskPrincipalParams } from './creation-policy.contracts';
import { TaskCreationPolicyRegistry } from './creation-policy.providers';
import { TaskService } from './task.service';
import { CreateTaskCommand } from './create-task.command';
import { CreateTaskHandler } from './create-task.handler';

describe('CreateTaskHandler', () => {
  let taskService: TaskService;
  let handler: CreateTaskHandler;

  beforeEach(() => {
    taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    handler = new CreateTaskHandler(taskService, new TaskCreationPolicyRegistry(), new PlatformEventBus());
  });

  it('fr.task.create: the task is created, owned by the submitter, not complete', async () => {
    const result = await handler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'Write the report' }));
    const stored = await taskService.findById(result.taskId);
    expect(stored.owner).toBe('owner-1');
    expect(stored.complete).toBe(false);
    expect(result.title).toBe('Write the report');
  });

  it('ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written', async () => {
    await expect(handler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: '   ' }))).rejects.toMatchObject({
      code: 'TASK_TITLE_REQUIRED',
    });
    expect(await taskService.listOwnedBy('owner-1')).toHaveLength(0);
  });

  it('event.task.created: publishes on the PlatformEventBus after the write succeeds', async () => {
    const events = new PlatformEventBus();
    const received: unknown[] = [];
    events.subscribe(event => received.push(event));
    const withEvents = new CreateTaskHandler(taskService, new TaskCreationPolicyRegistry(), events);

    const result = await withEvents.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'Write the report' }));

    expect(received).toHaveLength(1);
    const [published] = received as [TaskCreatedEvent];
    expect(published).toBeInstanceOf(TaskCreatedEvent);
    expect(published.taskId).toBe(result.taskId);
    expect(published.ownerId).toBe('owner-1');
    expect(published.sourceEventId).toEqual(expect.any(String));
  });
});

class TaskCreationRefusedException extends AbstractException {
  constructor() {
    super('Creation refused by policy.', 'TASK_CREATION_REFUSED');
  }
}

class RefusingPolicy extends TaskCreationPolicy {
  async assertMayCreate(_principal: CreateTaskPrincipalParams, _input: CreateTaskInputParams): Promise<void> {
    throw new TaskCreationRefusedException();
  }
}

describe('TaskCreationPolicyRegistry (sds.plan.cap-guard seam)', () => {
  it('sds.plan.cap-guard: a registered policy can refuse creation before the write, and nothing is written', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const registry = new TaskCreationPolicyRegistry();
    registry.register(new RefusingPolicy());
    const handler = new CreateTaskHandler(taskService, registry, new PlatformEventBus());

    await expect(handler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'Blocked' }))).rejects.toMatchObject({
      code: 'TASK_CREATION_REFUSED',
    });
    expect(await taskService.listOwnedBy('owner-1')).toHaveLength(0);
  });

  it('an empty registry (the default) blocks nothing', async () => {
    const taskService = new TaskService(createFakeEntityManager<TaskEntity>('id') as never);
    const registry = new TaskCreationPolicyRegistry();
    const handler = new CreateTaskHandler(taskService, registry, new PlatformEventBus());

    const result = await handler.execute(new CreateTaskCommand({ ownerId: 'owner-1', title: 'Allowed' }));

    expect(result.title).toBe('Allowed');
  });
});
