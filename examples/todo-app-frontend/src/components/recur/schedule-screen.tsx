import type { FormEvent } from 'react';
import { Button, Input, SurfaceCard, Text } from '@starci/grammar/common';
import { Heading } from '@/components/leaves/Heading';
import { EndRuleConfirm } from './end-rule-confirm';
import { UpcomingList } from './upcoming-list';
import {
  FIELD_CONTROL_CLASS_NAME,
  FIELD_GROUP_CLASS_NAME,
  FIELD_LABEL_CLASS_NAME,
  RADIO_GROUP_CLASS_NAME,
  RADIO_INPUT_CLASS_NAME,
  RADIO_OPTION_CLASS_NAME,
  SCHEDULE_ACTIONS_CLASS_NAME,
  SCHEDULE_FORM_CLASS_NAME,
  SUMMARY_STACK_CLASS_NAME,
  UNDER_CONTROL_CLASS_NAME,
} from './classNames';
import { ROUTES } from './routes';

/**
 * ui.recur.schedule states: no-rule, active, ended, refused. Every branch below is one of those
 * four names; there is no fifth rendering path. The connected owner in ./index.tsx resolves which
 * state applies and hands it down explicitly; this view never re-derives it from the API results.
 *
 * no-rule and refused share the make-recurring form (the record's refused behavior is that the
 * form keeps every submitted value and names the invalid field); active and ended replace it with
 * the rule summary and the occurrence collection.
 */
export type ScheduleState = 'no-rule' | 'active' | 'ended' | 'refused';

/** The one beside-it inventory the ScheduleState closed vocabulary is checked against. */
export const SCHEDULE_STATES: ReadonlyArray<ScheduleState> = ['no-rule', 'active', 'ended', 'refused'] as const;

/** data.recur.rule.frequency's three values, in the direction's radio order. */
export type RecurFrequency = 'every-weekday' | 'every-n-days' | 'monthly-day';

/** The fields the refused state can name; 'form' is the whole submission, not one input. */
export type ScheduleField = 'n' | 'dayOfMonth' | 'time' | 'timeZone' | 'startDate' | 'form';

/** A refused submission: which field needs attention and the sentence that says why. */
export type ScheduleRefusal = {
  readonly field: ScheduleField;
  readonly message: string;
};

/** The rule this screen created and may end; endedAt is null while the rule is active. */
export type RecurRule = {
  readonly ruleId: string;
  readonly title: string;
  readonly frequency: RecurFrequency;
  readonly n: number | null;
  readonly dayOfMonth: number | null;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
  readonly endedAt: string | null;
};

/** One materialised occurrence row from upcomingOccurrences. */
export type MaterialisedOccurrence = {
  readonly occurrenceId: string;
  readonly localDate: string;
  readonly status: string;
};

/** fr.recur.see-upcoming's read shape: stored rows plus a live-computed preview. */
export type UpcomingOccurrences = {
  readonly materialised: ReadonlyArray<MaterialisedOccurrence>;
  readonly previewDates: ReadonlyArray<string>;
};

const FREQUENCY_OPTIONS: ReadonlyArray<{ readonly value: RecurFrequency; readonly label: string }> = [
  { value: 'every-weekday', label: 'Every weekday' },
  { value: 'every-n-days', label: 'Every N days' },
  { value: 'monthly-day', label: 'Day of the month' },
] as const;

const frequencySummary = (rule: RecurRule): string => {
  if (rule.frequency === 'every-weekday') return 'every weekday';
  if (rule.frequency === 'every-n-days') return rule.n === 1 ? 'every day' : `every ${rule.n ?? '?'} days`;
  return `on day ${rule.dayOfMonth ?? '?'} of the month`;
};

/** The one sentence the active and ended states both show above the collection. */
export const ruleSummary = (rule: RecurRule): string => {
  const base = `Repeats ${frequencySummary(rule)} at ${rule.time} (${rule.timeZone}), starting ${rule.startDate}`;
  return rule.endedAt === null ? `${base}.` : `${base}; ended ${rule.endedAt}.`;
};

/** The public props of the pure schedule screen view. */
export type ScheduleScreenViewProps = {
  readonly state: ScheduleState;
  readonly frequency: RecurFrequency;
  readonly n: string;
  readonly dayOfMonth: string;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
  readonly refusal: ScheduleRefusal | null;
  readonly isSaving: boolean;
  readonly rule: RecurRule | null;
  readonly upcoming: UpcomingOccurrences | null;
  readonly isConfirmingEnd: boolean;
  readonly isEnding: boolean;
  readonly onFrequencyChange: (value: RecurFrequency) => void;
  readonly onNChange: (value: string) => void;
  readonly onDayOfMonthChange: (value: string) => void;
  readonly onTimeChange: (value: string) => void;
  readonly onTimeZoneChange: (value: string) => void;
  readonly onStartDateChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onEndRule: () => void;
  readonly onConfirmEndRule: () => void;
  readonly onCancelEndRule: () => void;
};

/** The props of one refusal line: the refusal in flight and the field this line answers for. */
export type RefusalLineProps = {
  readonly refusal: ScheduleRefusal | null;
  readonly field: ScheduleField;
};

const RefusalLine = (props: RefusalLineProps) =>
  props.refusal !== null && props.refusal.field === props.field ? (
    <div className={UNDER_CONTROL_CLASS_NAME}>
      <Text live="assertive">{props.refusal.message}</Text>
    </div>
  ) : null;

const fieldProps = (isSaving: boolean) => ({ kind: 'text' as const, isDisabled: isSaving });

/** The make-recurring form ui.recur.schedule shows in its no-rule and refused states. */
const ScheduleForm = (props: ScheduleScreenViewProps) => {
  const state = props.state;
  const isSaving = props.isSaving;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit();
  };
  return (
    <SurfaceCard ariaLabel="Schedule">
      {/* The record's `Input (id: recur-rule, label: Repeat)` is this whole repeat-rule form. */}
      <form id="recur-rule" aria-label="Repeat" data-state={state} onSubmit={onSubmit} className={SCHEDULE_FORM_CLASS_NAME}>
        <Heading level={2}>Schedule</Heading>
        <div role="group" aria-labelledby="recur-frequency-label" className={FIELD_GROUP_CLASS_NAME}>
          <span id="recur-frequency-label" className={FIELD_LABEL_CLASS_NAME}>Frequency</span>
          <div className={FIELD_CONTROL_CLASS_NAME}>
            <div className={RADIO_GROUP_CLASS_NAME}>
              {FREQUENCY_OPTIONS.map(option => (
                <label key={option.value} className={RADIO_OPTION_CLASS_NAME}>
                  <input
                    type="radio"
                    name="recur-frequency"
                    value={option.value}
                    checked={props.frequency === option.value}
                    disabled={isSaving}
                    onChange={() => props.onFrequencyChange(option.value)}
                    className={RADIO_INPUT_CLASS_NAME}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        {props.frequency === 'every-n-days' ? (
          <div>
            <Input
              id="recur-n"
              name="n"
              label="Every (days)"
              {...fieldProps(isSaving)}
              value={props.n}
              onValueChange={props.onNChange}
            />
            <RefusalLine refusal={props.refusal} field="n" />
          </div>
        ) : null}
        {props.frequency === 'monthly-day' ? (
          <div>
            <Input
              id="recur-day-of-month"
              name="dayOfMonth"
              label="Day of the month"
              {...fieldProps(isSaving)}
              value={props.dayOfMonth}
              onValueChange={props.onDayOfMonthChange}
            />
            <RefusalLine refusal={props.refusal} field="dayOfMonth" />
          </div>
        ) : null}
        <div>
          <Input
            id="recur-time"
            name="time"
            label="Time of day"
            hint="Use 24-hour format (e.g. 14:30)."
            {...fieldProps(isSaving)}
            value={props.time}
            onValueChange={props.onTimeChange}
          />
          <RefusalLine refusal={props.refusal} field="time" />
        </div>
        <div>
          <Input
            id="recur-time-zone"
            name="timeZone"
            label="Time zone"
            hint="Uses your selected local time zone."
            {...fieldProps(isSaving)}
            value={props.timeZone}
            onValueChange={props.onTimeZoneChange}
          />
          <RefusalLine refusal={props.refusal} field="timeZone" />
        </div>
        <div>
          <Input
            id="recur-start-date"
            name="startDate"
            label="Start date"
            hint="The first time this task should occur."
            {...fieldProps(isSaving)}
            value={props.startDate}
            onValueChange={props.onStartDateChange}
          />
          <RefusalLine refusal={props.refusal} field="startDate" />
        </div>
        <RefusalLine refusal={props.refusal} field="form" />
        <div className={SCHEDULE_ACTIONS_CLASS_NAME}>
          <Button type="submit" variant="primary" isDisabled={isSaving} isPending={isSaving}>
            {isSaving ? 'Saving...' : 'Save schedule'}
          </Button>
          <Button variant="outline" href={ROUTES.tasks}>
            Cancel
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
};

/** The pure render of ui.recur.schedule; every one of its four states is decided by `state`. */
export const ScheduleScreenView = (props: ScheduleScreenViewProps) => {
  const state = props.state;
  if (state === 'no-rule' || state === 'refused') {
    return <ScheduleForm {...props} />;
  }
  const rule = props.rule;
  return (
    <>
      <SurfaceCard ariaLabel="Schedule">
        <div className={SUMMARY_STACK_CLASS_NAME}>
          <Heading level={2}>Schedule</Heading>
          {rule === null ? null : <Text>{ruleSummary(rule)}</Text>}
          <RefusalLine refusal={props.refusal} field="form" />
          {state === 'active' ? (
            props.isConfirmingEnd ? (
              <EndRuleConfirm isEnding={props.isEnding} onConfirm={props.onConfirmEndRule} onCancel={props.onCancelEndRule} />
            ) : (
              <Button type="button" variant="outline" onPress={props.onEndRule}>
                End rule
              </Button>
            )
          ) : null}
        </div>
      </SurfaceCard>
      <UpcomingList isEnded={state === 'ended'} upcoming={props.upcoming} />
    </>
  );
};
