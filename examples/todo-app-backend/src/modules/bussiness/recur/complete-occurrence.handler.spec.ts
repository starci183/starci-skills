import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeRecurEntityManager } from './testing/fake-recur-entity-manager';
import { OccurrenceService } from './occurrence.service';
import { CompleteOccurrenceCommand } from './complete-occurrence.command';
import { CompleteOccurrenceHandler } from './complete-occurrence.handler';

describe('CompleteOccurrenceHandler (sds.recur.occurrence-lifecycle t-complete)', () => {
  it('completes a materialised occurrence for its owner', async () => {
    const entityManager = createFakeRecurEntityManager();
    await entityManager.save(TaskEntity, { id: 'task-1', owner: 'owner-1', title: 'x', complete: false, completedAt: null });
    const occurrenceService = new OccurrenceService(entityManager as never);
    await occurrenceService.materialise({ id: 'task-1', ruleId: 'r1', windowKey: 'r1:2026-09-14', localDate: '2026-09-14', dueAtUtc: new Date() });
    const handler = new CompleteOccurrenceHandler(occurrenceService);

    const result = await handler.execute(new CompleteOccurrenceCommand({ occurrenceId: 'task-1', actorId: 'owner-1' }));

    expect(result.status).toBe('completed');
  });

  it('ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner', async () => {
    const entityManager = createFakeRecurEntityManager();
    await entityManager.save(TaskEntity, { id: 'task-1', owner: 'owner-1', title: 'x', complete: false, completedAt: null });
    const occurrenceService = new OccurrenceService(entityManager as never);
    await occurrenceService.materialise({ id: 'task-1', ruleId: 'r1', windowKey: 'r1:2026-09-14', localDate: '2026-09-14', dueAtUtc: new Date() });
    const handler = new CompleteOccurrenceHandler(occurrenceService);

    await expect(handler.execute(new CompleteOccurrenceCommand({ occurrenceId: 'task-1', actorId: 'owner-2' }))).rejects.toMatchObject({
      code: 'RECUR_OCCURRENCE_FORBIDDEN',
    });
  });
});
