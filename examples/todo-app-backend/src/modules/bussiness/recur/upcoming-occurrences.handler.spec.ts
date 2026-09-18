import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeRecurEntityManager } from './testing/fake-recur-entity-manager';
import { RuleService } from './rule.service';
import { OccurrenceService } from './occurrence.service';
import { UpcomingOccurrencesQuery } from './upcoming-occurrences.query';
import { UpcomingOccurrencesHandler } from './upcoming-occurrences.handler';

describe('UpcomingOccurrencesHandler (fr.recur.see-upcoming)', () => {
  const build = () => {
    const entityManager = createFakeRecurEntityManager();
    const ruleService = new RuleService(entityManager as never);
    const occurrenceService = new OccurrenceService(entityManager as never);
    const handler = new UpcomingOccurrencesHandler(ruleService, occurrenceService);
    return { entityManager, ruleService, occurrenceService, handler };
  };

  it('preview dates never land on a weekend for an every-weekday rule', async () => {
    const { ruleService, handler } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Morning routine',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2020-01-01',
    });

    const result = await handler.execute(new UpcomingOccurrencesQuery({ ruleId: rule.id, actorId: 'owner-1' }));

    for (const date of result.previewDates) {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(5);
    }
    expect(result.previewDates.length).toBeGreaterThan(0);
  });

  it('exceptionFlows: an ended rule shows no upcoming preview, only its history', async () => {
    const { ruleService, occurrenceService, entityManager, handler } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'x',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2020-01-01',
    });
    await entityManager.save(TaskEntity, { id: 'task-1', owner: 'owner-1', title: 'x', complete: false, completedAt: null });
    await occurrenceService.materialise({ id: 'task-1', ruleId: rule.id, windowKey: `${rule.id}:2020-01-01`, localDate: '2020-01-01', dueAtUtc: new Date() });
    await ruleService.end(rule.id, 'owner-1', '2020-01-02');

    const result = await handler.execute(new UpcomingOccurrencesQuery({ ruleId: rule.id, actorId: 'owner-1' }));

    expect(result.previewDates).toEqual([]);
    expect(result.materialised).toHaveLength(1);
  });

  it('only the rule\'s own owner may query its upcoming occurrences', async () => {
    const { ruleService, handler } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'x',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2020-01-01',
    });

    await expect(handler.execute(new UpcomingOccurrencesQuery({ ruleId: rule.id, actorId: 'owner-2' }))).rejects.toMatchObject({
      code: 'RECUR_RULE_FORBIDDEN',
    });
  });
});
