'use strict';

/**
 * fr.recur.make-recurring - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- recur/make-recurring
 *
 * The generator's own walk (sds.recur.generation-engine, driven in-process by integration.recur.scheduler
 * at a per-second RECUR_TICK_CRON this run sets) is what materialises occurrences: no scenario calls it,
 * every scenario waits for a real tick and reads the rows back through upcomingOccurrences.
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const { uniqueTitle, makeRule, upcoming, occurrencesAfterTick, localDates } = require('../lib/fixtures');

const GROUP = 'recur/make-recurring';
const FAR = 999;

scenario(GROUP, 'fr.recur.make-recurring.main-1', async () => {
  const shapes = [
    { frequency: 'every-weekday', time: '08:15', timeZone: 'Europe/Berlin' },
    { frequency: 'every-n-days', n: 3, time: '11:45', timeZone: 'Asia/Ho_Chi_Minh' },
    { frequency: 'monthly-day', dayOfMonth: 15, time: '19:05', timeZone: 'America/New_York' },
  ];
  for (const shape of shapes) {
    const rule = await makeRule('owner', { title: uniqueTitle('frequencies'), startDate: '2026-01-01', ...shape });
    expect(rule.frequency).toBe(shape.frequency);
    expect(rule.timeZone).toBe(shape.timeZone);
    expect(rule.time).toBe(shape.time);
  }
});

scenario(GROUP, 'fr.recur.make-recurring.main-2', async () => {
  const title = uniqueTitle('created-and-previewed');
  const rule = await makeRule('owner', { title, frequency: 'monthly-day', dayOfMonth: 1, timeZone: 'UTC', time: '09:00', startDate: '2026-09-01' });
  expect(rule.title).toBe(title);

  // An independent calendar fact, not the app's arithmetic: the first day of the month after today's UTC
  // date is the next date a monthly-day-1 rule fires on, and it is always inside the preview horizon.
  const now = new Date();
  const nextFirstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  const asOwner = await call('upcomingOccurrences', {
    variables: { ruleId: rule.ruleId },
    token: (await persona('owner')).token,
    note: 'upcomingOccurrences for the rule the submitter just created',
  });
  expect(asOwner.errors).toBeNull();
  expect(asOwner.data.upcomingOccurrences.previewDates).toContain(nextFirstOfMonth);

  const asStranger = await call('upcomingOccurrences', {
    variables: { ruleId: rule.ruleId },
    token: (await persona('other')).token,
    note: 'another person tries to read the same rule',
  });
  expect(asStranger.errorCode).toBe('RECUR_RULE_FORBIDDEN');
});

scenario(GROUP, 'fr.recur.make-recurring.exception-1', async () => {
  const rule = await makeRule('owner', { title: uniqueTitle('day-31'), frequency: 'monthly-day', dayOfMonth: 31, timeZone: 'UTC', time: '09:00', startDate: '2026-01-01' });
  expect(rule.ruleId).toBeTruthy();
  expect(rule.frequency).toBe('monthly-day');
});

scenario(GROUP, 'fr.recur.make-recurring.post-1', async () => {
  const rule = await makeRule('owner', { title: uniqueTitle('exists-anyway'), frequency: 'monthly-day', dayOfMonth: 31, timeZone: 'UTC', time: '09:00', startDate: '2026-09-30' });
  const read = await call('upcomingOccurrences', {
    variables: { ruleId: rule.ruleId },
    token: (await persona('owner')).token,
    note: 'read the rule back in a month that has no 31st',
  });
  expect(read.errors).toBeNull();
  expect(read.data.upcomingOccurrences.ruleId).toBe(rule.ruleId);
});

scenario(GROUP, 'ac.recur.impossible-date.skips.skips-nonexistent-day', async () => {
  const rule = await makeRule('owner', { title: uniqueTitle('r3'), frequency: 'monthly-day', dayOfMonth: 31, timeZone: 'UTC', time: '09:00', startDate: '2026-01-01' });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 2);
  const dates = localDates(occurrences);
  expect(dates).toContain('2026-01-31');
  expect(dates).toContain('2026-03-31');
  expect(dates.filter((date) => date.startsWith('2026-02'))).toEqual([]);
  expect(occurrences.materialised.every((occurrence) => occurrence.status === 'materialised')).toBe(true);
});

scenario(GROUP, 'ac.recur.timezone.owner-local-time.dst-spring-forward-shifts-by-gap', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('berlin-gap'), frequency: 'every-n-days', n: FAR, timeZone: 'Europe/Berlin', time: '02:30', startDate: '2026-03-29',
  });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 1);
  const onGapDay = occurrences.materialised.filter((occurrence) => occurrence.localDate === '2026-03-29');
  expect(onGapDay).toHaveLength(1);
  expect(onGapDay[0].dueAtUtc).toBe('2026-03-29T01:30:00.000Z');
});

scenario(GROUP, 'ac.recur.timezone.owner-local-time.dst-fall-back-picks-earliest', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('newyork-fold'), frequency: 'every-n-days', n: FAR, timeZone: 'America/New_York', time: '01:30', startDate: '2024-11-03',
  });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 1);
  const onFoldDay = occurrences.materialised.filter((occurrence) => occurrence.localDate === '2024-11-03');
  expect(onFoldDay).toHaveLength(1);
  expect(onFoldDay[0].dueAtUtc).toBe('2024-11-03T05:30:00.000Z');
});

scenario(GROUP, 'ac.recur.timezone.owner-local-time.distinct-zones-differ', async () => {
  const due = {};
  for (const [zone, date] of [['Asia/Ho_Chi_Minh', '2026-01-15'], ['Europe/Berlin', '2026-01-15'], ['Asia/Ho_Chi_Minh', '2026-07-15'], ['Europe/Berlin', '2026-07-15']]) {
    const rule = await makeRule('owner', {
      title: uniqueTitle(`zones-${zone}-${date}`), frequency: 'every-n-days', n: FAR, timeZone: zone, time: '09:00', startDate: date,
    });
    const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 1);
    const onDate = occurrences.materialised.filter((occurrence) => occurrence.localDate === date);
    expect(onDate).toHaveLength(1);
    due[`${zone}@${date}`] = onDate[0].dueAtUtc;
  }
  expect(due['Asia/Ho_Chi_Minh@2026-01-15']).toBe('2026-01-15T02:00:00.000Z');
  expect(due['Asia/Ho_Chi_Minh@2026-07-15']).toBe('2026-07-15T02:00:00.000Z');
  expect(due['Europe/Berlin@2026-01-15']).toBe('2026-01-15T08:00:00.000Z');
  expect(due['Europe/Berlin@2026-07-15']).toBe('2026-07-15T07:00:00.000Z');
  expect(due['Asia/Ho_Chi_Minh@2026-01-15']).not.toBe(due['Europe/Berlin@2026-01-15']);
  expect(due['Asia/Ho_Chi_Minh@2026-07-15']).not.toBe(due['Europe/Berlin@2026-07-15']);
});

assertImplemented(GROUP);
