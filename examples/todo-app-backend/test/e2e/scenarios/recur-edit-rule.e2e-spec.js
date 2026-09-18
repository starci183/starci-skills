'use strict';

/**
 * fr.recur.edit-rule - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- recur/edit-rule
 *
 * Not run, by the registry: ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner - the public
 * surface registers no operation that completes or skips an occurrence, so the refusal this criterion is
 * about cannot be requested from outside at all.
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const {
  uniqueTitle, makeRule, editRule, upcoming, occurrencesAfterTick, localDates, localDateOffset,
} = require('../lib/fixtures');

const GROUP = 'recur/edit-rule';

scenario(GROUP, 'fr.recur.edit-rule.main-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('edit-main-1'), frequency: 'monthly-day', dayOfMonth: 1, timeZone: 'Asia/Ho_Chi_Minh', time: '09:00', startDate: '2026-09-01',
  });
  const observed = await editRule('owner', { ruleId: rule.ruleId, time: '18:00' });
  expect(observed.errors).toBeNull();
  expect(observed.data.editRecurrence).toEqual({
    ruleId: rule.ruleId, frequency: 'monthly-day', timeZone: 'Asia/Ho_Chi_Minh', time: '18:00',
  });
});

scenario(GROUP, 'fr.recur.edit-rule.main-2', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('edit-main-2'), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-2),
  });
  const before = await occurrencesAfterTick(rule.ruleId, 'owner', 2);
  await editRule('owner', { ruleId: rule.ruleId, time: '17:30' });
  const after = await upcoming('owner', rule.ruleId, 'upcomingOccurrences after the edit');
  const afterByDate = new Map(after.data.upcomingOccurrences.materialised.map((row) => [row.localDate, row]));
  for (const row of before.materialised) {
    expect(afterByDate.get(row.localDate)).toEqual(row);
  }
});

scenario(GROUP, 'fr.recur.edit-rule.main-3', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('edit-main-3'), frequency: 'every-n-days', n: 7, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-21),
  });
  const before = await occurrencesAfterTick(rule.ruleId, 'owner', 3);
  expect(localDates(before).length).toBeGreaterThanOrEqual(3);

  const edited = await editRule('owner', { ruleId: rule.ruleId, frequency: 'every-n-days', n: 5, time: '18:00' });
  expect(edited.errors).toBeNull();

  const grown = await occurrencesAfterTick(rule.ruleId, 'owner', before.materialised.length + 1);
  const newly = grown.materialised.filter((row) => !before.materialised.some((old) => old.occurrenceId === row.occurrenceId));
  expect(newly.length).toBeGreaterThan(0);
  for (const row of newly) {
    expect(row.dueAtUtc.endsWith('T18:00:00.000Z')).toBe(true);
  }
  for (const row of grown.materialised.filter((occurrence) => before.materialised.some((old) => old.occurrenceId === occurrence.occurrenceId))) {
    expect(before.materialised.find((old) => old.occurrenceId === row.occurrenceId)).toEqual(row);
  }
});

scenario(GROUP, 'fr.recur.edit-rule.exception-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('edit-stranger'), frequency: 'monthly-day', dayOfMonth: 1, timeZone: 'UTC', time: '09:00', startDate: '2026-09-01',
  });
  const stranger = await persona('other');
  const observed = await call('editRecurrence', {
    variables: { input: { ruleId: rule.ruleId, time: '23:00' } },
    token: stranger.token,
    note: "somebody who is not the rule's owner edits it",
  });
  expect(observed.errorCode).toBe('RECUR_RULE_FORBIDDEN');
  const asOwner = await call('upcomingOccurrences', {
    variables: { ruleId: rule.ruleId },
    token: (await persona('owner')).token,
    note: 'the owner reads the rule the stranger tried to edit',
  });
  expect(asOwner.errors).toBeNull();
  const unchanged = await editRule('owner', { ruleId: rule.ruleId });
  expect(unchanged.errors).toBeNull();
  expect(unchanged.data.editRecurrence.time).toBe('09:00');
});

scenario(GROUP, 'fr.recur.edit-rule.post-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('edit-post-1'), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '08:00', startDate: localDateOffset(-2),
  });
  const before = await occurrencesAfterTick(rule.ruleId, 'owner', 2);
  const edited = await editRule('owner', { ruleId: rule.ruleId, timeZone: 'America/New_York', time: '20:00' });
  expect(edited.data.editRecurrence.timeZone).toBe('America/New_York');
  expect(edited.data.editRecurrence.time).toBe('20:00');
  const after = await upcoming('owner', rule.ruleId, 'upcomingOccurrences to check the old rows');
  for (const row of after.data.upcomingOccurrences.materialised.filter((occurrence) => localDates(before).includes(occurrence.localDate))) {
    const original = before.materialised.find((occurrence) => occurrence.localDate === row.localDate);
    expect(row.dueAtUtc).toBe(original.dueAtUtc);
    expect(row.status).toBe(original.status);
  }
});

assertImplemented(GROUP);
