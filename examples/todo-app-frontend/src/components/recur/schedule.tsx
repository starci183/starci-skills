'use client';

import { useEffect, useState } from 'react';
import { graphql } from '@/modules/api/graphql';
import { useSessionToken } from '@/hooks/auth';
import {
  ScheduleScreenView,
  type RecurFrequency,
  type RecurRule,
  type ScheduleRefusal,
  type ScheduleState,
  type UpcomingOccurrences,
} from './schedule-screen';

/**
 * The connected owner of ui.recur.schedule: it holds the make-recurring draft as intrinsic form
 * state, runs the field validation the record's refused state names, and reaches the recur
 * GraphQL operations (makeRecurring / upcomingOccurrences / endRecurrence) through the shared
 * `graphql` transport.
 *
 * Those three calls live beside the block rather than in src/modules/api because this lane's
 * write scope ends at src/components/recur and src/app/recur; the transport boundary itself
 * (the one place fetch may appear) is unchanged.
 *
 * The screen's task context arrives as the `task` query value on the route: the title of the task
 * the rule is made from, which is exactly the identity the makeRecurring contract accepts. There
 * is no list-rules query to rediscover an existing rule on load, so a fresh visit is no-rule; a
 * created rule's identity comes from the makeRecurring response in this page's own session.
 */
export type ScheduleBlockProps = {
  readonly taskTitle: string | null;
};

const MAKE_RECURRING_DOCUMENT =
  'mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }';

const UPCOMING_OCCURRENCES_DOCUMENT =
  'query UpcomingOccurrences($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }';

const END_RECURRENCE_DOCUMENT =
  'mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }';

/**
 * The wire name each domain frequency travels under. The backend registers RecurFrequencyInput
 * under the GraphQL name `RecurFrequency` without a valuesMap, so the schema's enum literals are
 * the TypeScript keys (verified against the live endpoint) while data.recur.rule.frequency keeps
 * the kebab-case domain values the radios, the rule record and the summary all speak.
 */
const WIRE_FREQUENCY: Record<RecurFrequency, string> = {
  'every-weekday': 'EveryWeekday',
  'every-n-days': 'EveryNDays',
  'monthly-day': 'MonthlyDay',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const DAY_OF_MONTH_PATTERN = /^([1-9]|[12]\d|3[01])$/;

/** The local calendar date in the rule's own zone, shaped YYYY-MM-DD for endRecurrence. */
const todayInZone = (timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

/** The make-recurring form's draft: every field as the owner typed it, before validation. */
export type ScheduleDraft = {
  readonly frequency: RecurFrequency;
  readonly n: string;
  readonly dayOfMonth: string;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
};

/** fr.recur.make-recurring's draft validation, in the form's field order; first failure wins. */
const validateDraft = (draft: ScheduleDraft): ScheduleRefusal | null => {
  if (draft.frequency === 'every-n-days' && !POSITIVE_INTEGER_PATTERN.test(draft.n)) {
    return { field: 'n', message: 'Enter a number of days greater than zero.' };
  }
  if (draft.frequency === 'monthly-day' && !DAY_OF_MONTH_PATTERN.test(draft.dayOfMonth)) {
    return { field: 'dayOfMonth', message: 'Enter a day of the month from 1 to 31.' };
  }
  if (!TIME_PATTERN.test(draft.time)) return { field: 'time', message: 'Enter a time of day as HH:MM.' };
  if (draft.timeZone.trim() === '') return { field: 'timeZone', message: 'Enter an IANA time zone, like Europe/Berlin.' };
  if (!DATE_PATTERN.test(draft.startDate)) return { field: 'startDate', message: 'Enter a start date as YYYY-MM-DD.' };
  return null;
};

/** The connected schedule block: owns the draft, the refusal, and the created rule's lifecycle. */
export const ScheduleBlock = (props: ScheduleBlockProps) => {
  const token = useSessionToken();
  const [frequency, setFrequency] = useState<RecurFrequency>('every-weekday');
  const [n, setN] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [time, setTime] = useState('09:00');
  const [timeZone, setTimeZone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [rule, setRule] = useState<RecurRule | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingOccurrences | null>(null);
  const [refusal, setRefusal] = useState<ScheduleRefusal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingEnd, setIsConfirmingEnd] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // fr.recur.make-recurring: time zone and start date default to the owner's own. Resolved after
  // mount rather than in initial state so the server render and the client's first render agree.
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimeZone(current => (current === '' ? zone : current));
    setStartDate(current => (current === '' ? todayInZone(zone) : current));
  }, []);

  const refreshUpcoming = async (ruleId: string): Promise<void> => {
    const result = await graphql<UpcomingOccurrences>(UPCOMING_OCCURRENCES_DOCUMENT, { ruleId }, token);
    setUpcoming(result.ok ? result.data : { materialised: [], previewDates: [] });
  };

  const submit = async (): Promise<void> => {
    const draft = { frequency, n, dayOfMonth, time, timeZone, startDate };
    const draftRefusal = validateDraft(draft);
    if (draftRefusal !== null) {
      setRefusal(draftRefusal);
      return;
    }
    if (props.taskTitle === null) {
      setRefusal({ field: 'form', message: 'Open a task\u2019s schedule before saving a rule.' });
      return;
    }
    setIsSaving(true);
    setRefusal(null);
    const result = await graphql<{ ruleId: string; title: string; frequency: string; timeZone: string; time: string; startDate: string }>(
      MAKE_RECURRING_DOCUMENT,
      {
        input: {
          title: props.taskTitle,
          frequency: WIRE_FREQUENCY[frequency],
          ...(frequency === 'every-n-days' ? { n: Number.parseInt(n, 10) } : {}),
          ...(frequency === 'monthly-day' ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) } : {}),
          timeZone,
          time,
          startDate,
        },
      },
      token,
    );
    if (!result.ok) {
      setIsSaving(false);
      setRefusal({ field: 'form', message: result.reason });
      return;
    }
    setRule({
      ruleId: result.data.ruleId,
      title: result.data.title,
      frequency,
      n: frequency === 'every-n-days' ? Number.parseInt(n, 10) : null,
      dayOfMonth: frequency === 'monthly-day' ? Number.parseInt(dayOfMonth, 10) : null,
      time: result.data.time,
      timeZone: result.data.timeZone,
      startDate: result.data.startDate,
      endedAt: null,
    });
    setIsSaving(false);
    await refreshUpcoming(result.data.ruleId);
  };

  const confirmEndRule = async (): Promise<void> => {
    if (rule === null) return;
    setIsEnding(true);
    const endedAt = todayInZone(rule.timeZone);
    const result = await graphql<{ ruleId: string; endedAt: string; orphanedCount: number }>(
      END_RECURRENCE_DOCUMENT,
      { input: { ruleId: rule.ruleId, endedAt } },
      token,
    );
    setIsEnding(false);
    if (!result.ok) {
      setRefusal({ field: 'form', message: result.reason });
      return;
    }
    setRule({ ...rule, endedAt: result.data.endedAt });
    setIsConfirmingEnd(false);
    await refreshUpcoming(rule.ruleId);
  };

  const state: ScheduleState = rule === null ? (refusal === null ? 'no-rule' : 'refused') : rule.endedAt === null ? 'active' : 'ended';

  return (
    <ScheduleScreenView
      state={state}
      frequency={frequency}
      n={n}
      dayOfMonth={dayOfMonth}
      time={time}
      timeZone={timeZone}
      startDate={startDate}
      refusal={refusal}
      isSaving={isSaving}
      rule={rule}
      upcoming={upcoming}
      isConfirmingEnd={isConfirmingEnd}
      isEnding={isEnding}
      onFrequencyChange={setFrequency}
      onNChange={setN}
      onDayOfMonthChange={setDayOfMonth}
      onTimeChange={setTime}
      onTimeZoneChange={setTimeZone}
      onStartDateChange={setStartDate}
      onSubmit={submit}
      onEndRule={() => setIsConfirmingEnd(true)}
      onConfirmEndRule={confirmEndRule}
      onCancelEndRule={() => setIsConfirmingEnd(false)}
    />
  );
};
