import { randomUUID } from 'node:crypto';
import { CreateTaskCommand } from '@modules/bussiness/task';
import { TaskEntity } from '../../platform/databases/postgresql/primary';
import { createFakeRecurEntityManager } from './testing/fake-recur-entity-manager';
import { RuleService } from './rule.service';
import { OccurrenceService } from './occurrence.service';
import { GeneratorService } from './generator.service';

/** A minimal CommandBus stand-in that only knows CreateTaskCommand, writing directly into the same fake
 * entity manager GeneratorService's own services use - close enough to the real seam (dispatch onto a
 * bus, land in the tasks table) without standing up the whole CqrsModule wiring for a unit test. */
function fakeCommandBusOverTasks(entityManager: ReturnType<typeof createFakeRecurEntityManager>) {
  return {
    async execute(command: CreateTaskCommand) {
      const id = randomUUID();
      await entityManager.save(TaskEntity, {
        id,
        owner: command.params.ownerId,
        title: command.params.title,
        complete: false,
        completedAt: null,
      });
      return { taskId: id, title: command.params.title };
    },
  };
}

describe('GeneratorService (sds.recur.generation-engine)', () => {
  const build = () => {
    const entityManager = createFakeRecurEntityManager();
    const ruleService = new RuleService(entityManager as never);
    const occurrenceService = new OccurrenceService(entityManager as never);
    const commandBus = fakeCommandBusOverTasks(entityManager);
    const generator = new GeneratorService(ruleService, occurrenceService, commandBus as never);
    return { ruleService, occurrenceService, generator };
  };

  it('materialises one occurrence per weekday date between startDate and now, skipping weekends', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Morning routine',
      frequency: 'every-weekday',
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-09-14', // Monday
    });

    const summary = await generator.runOnce(new Date('2026-09-18T12:00:00.000Z')); // Friday, after 09:00 UTC

    expect(summary.materialised).toHaveLength(5);
    const occurrences = await occurrenceService.listByRule(rule.id);
    expect(occurrences.map(o => o.localDate)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
    expect(occurrences.every(o => o.status === 'materialised')).toBe(true);
  });

  it('br.recur.generation.once / ac.is-idempotent-on-rerun: running twice for an overlapping window creates no second occurrence', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Daily',
      frequency: 'every-n-days',
      n: 1,
      timeZone: 'Europe/Berlin',
      time: '09:00',
      startDate: '2026-09-14',
    });

    await generator.runOnce(new Date('2026-09-14T12:00:00.000Z'));
    const firstRun = await occurrenceService.listByRule(rule.id);
    expect(firstRun).toHaveLength(1);
    const firstId = firstRun[0].id;
    const firstDueAtUtc = firstRun[0].dueAtUtc.toISOString();

    await generator.runOnce(new Date('2026-09-14T12:00:00.000Z'));
    const secondRun = await occurrenceService.listByRule(rule.id);

    expect(secondRun).toHaveLength(1);
    expect(secondRun[0].id).toBe(firstId);
    expect(secondRun[0].dueAtUtc.toISOString()).toBe(firstDueAtUtc);
    expect(secondRun[0].status).toBe(firstRun[0].status);
  });

  it('decision.recur.generation.backfill: a generator that has never run walks and materialises every missed date, one occurrence per date', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Daily',
      frequency: 'every-n-days',
      n: 1,
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-09-14',
    });

    // Simulates the generator having been down for three days: the first tick after the outage runs at
    // 2026-09-17, and every day since startDate must be backfilled, not only the latest.
    await generator.runOnce(new Date('2026-09-17T12:00:00.000Z'));
    const occurrences = await occurrenceService.listByRule(rule.id);

    expect(occurrences.map(o => o.localDate)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']);
  });

  it('ac.recur.impossible-date.skips.skips-nonexistent-day: a monthly-day-31 rule materialises January and March 2026 but nothing for February', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'End-of-month bill',
      frequency: 'monthly-day',
      dayOfMonth: 31,
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-01-01',
    });

    await generator.runOnce(new Date('2026-03-31T10:00:00.000Z'));
    const occurrences = await occurrenceService.listByRule(rule.id);

    expect(occurrences.map(o => o.localDate)).toEqual(['2026-01-31', '2026-03-31']);
    expect(occurrences.some(o => o.localDate.startsWith('2026-02'))).toBe(false);
  });

  it('br.recur.ending.preserves-history: an ended rule never has a generated occurrence dated after the day it ended', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Daily',
      frequency: 'every-n-days',
      n: 1,
      timeZone: 'UTC',
      time: '09:00',
      startDate: '2026-09-14',
    });
    await ruleService.end(rule.id, 'owner-1', '2026-09-15');

    await generator.runOnce(new Date('2026-09-20T12:00:00.000Z'));
    const occurrences = await occurrenceService.listByRule(rule.id);

    expect(occurrences.map(o => o.localDate)).toEqual(['2026-09-14', '2026-09-15']);
    expect(occurrences.every(o => o.localDate <= '2026-09-15')).toBe(true);
  });

  it('br.recur.timezone.owner-local-time: the materialised occurrence\'s dueAtUtc is resolved from the rule\'s own zone, not the host clock', async () => {
    const { ruleService, occurrenceService, generator } = build();
    const rule = await ruleService.create({
      owner: 'owner-1',
      title: 'Daily',
      frequency: 'every-n-days',
      n: 1,
      timeZone: 'Europe/Berlin',
      time: '02:30',
      startDate: '2026-03-29',
    });

    await generator.runOnce(new Date('2026-03-29T12:00:00.000Z'));
    const occurrences = await occurrenceService.listByRule(rule.id);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dueAtUtc.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });
});
