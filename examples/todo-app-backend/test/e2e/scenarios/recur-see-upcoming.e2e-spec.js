'use strict';

/**
 * fr.recur.see-upcoming - proven through the public GraphQL door only.
 * Check command: npm run test:e2e -- recur/see-upcoming
 */

const { call, persona } = require('../lib/client');
const { scenario, assertImplemented } = require('../lib/scenario');
const {
  uniqueTitle, makeRule, endRule, upcoming, occurrencesAfterTick, localDates, localDateOffset,
} = require('../lib/fixtures');

const GROUP = 'recur/see-upcoming';

scenario(GROUP, 'fr.recur.see-upcoming.main-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('see-both-halves'), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-3),
  });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 3);
  expect(occurrences.materialised.length).toBeGreaterThanOrEqual(3);
  expect(occurrences.materialised.every((occurrence) => typeof occurrence.status === 'string' && occurrence.status.length > 0)).toBe(true);
  expect(occurrences.previewDates.length).toBeGreaterThan(0);

  const previewOnly = occurrences.previewDates.filter((date) => !localDates(occurrences).includes(date));
  expect(previewOnly.length).toBeGreaterThan(0);
  const readTwice = await call('upcomingOccurrences', {
    variables: { ruleId: rule.ruleId },
    token: (await persona('owner')).token,
    note: 'read the same rule again to show the preview is computed, not stored',
  });
  expect(readTwice.data.upcomingOccurrences.previewDates).toEqual(occurrences.previewDates);
});

scenario(GROUP, 'fr.recur.see-upcoming.exception-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('ended-shows-no-preview'), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-2),
  });
  const before = await occurrencesAfterTick(rule.ruleId, 'owner', 2);
  expect(before.materialised.length).toBeGreaterThan(0);

  const endedAt = localDates(before)[before.materialised.length - 1];
  const ended = await endRule('owner', rule.ruleId, endedAt);
  expect(ended.errors).toBeNull();

  const after = await upcoming('owner', rule.ruleId, 'upcomingOccurrences once the rule has ended');
  expect(after.data.upcomingOccurrences.previewDates).toEqual([]);
  expect(after.data.upcomingOccurrences.materialised.length).toBe(before.materialised.length);
});

scenario(GROUP, 'fr.recur.see-upcoming.post-1', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('preview-is-not-a-row'), frequency: 'every-n-days', n: 1, timeZone: 'UTC', time: '09:00', startDate: localDateOffset(-1),
  });
  const seen = await occurrencesAfterTick(rule.ruleId, 'owner', 1);
  const tomorrow = localDateOffset(1);
  const previewedNotMade = seen.previewDates.filter((date) => !localDates(seen).includes(date));
  expect(previewedNotMade.length).toBeGreaterThan(0);
  for (const date of previewedNotMade) {
    expect(localDates(seen)).not.toContain(date);
  }
  void tomorrow;
});

scenario(GROUP, 'ac.recur.impossible-date.skips.skips-nonexistent-day', async () => {
  const rule = await makeRule('owner', {
    title: uniqueTitle('see-upcoming-r3'), frequency: 'monthly-day', dayOfMonth: 31, timeZone: 'UTC', time: '09:00', startDate: '2026-01-01',
  });
  const occurrences = await occurrencesAfterTick(rule.ruleId, 'owner', 2);
  const dates = localDates(occurrences);
  expect(dates).toContain('2026-01-31');
  expect(dates).toContain('2026-03-31');
  expect(dates.filter((date) => date.startsWith('2026-02'))).toEqual([]);
});

assertImplemented(GROUP);
