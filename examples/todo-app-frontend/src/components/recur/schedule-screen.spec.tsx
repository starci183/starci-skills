import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ScheduleScreenView,
  type RecurRule,
  type ScheduleScreenViewProps,
} from './schedule-screen';

const noop = () => {};

const baseProps = (overrides: Partial<ScheduleScreenViewProps> = {}): ScheduleScreenViewProps => ({
  state: 'no-rule',
  frequency: 'every-n-days',
  n: '',
  dayOfMonth: '',
  time: '09:00',
  timeZone: 'Asia/Bangkok',
  startDate: '2026-09-21',
  refusal: null,
  isSaving: false,
  rule: null,
  upcoming: null,
  isConfirmingEnd: false,
  isEnding: false,
  onFrequencyChange: noop,
  onNChange: noop,
  onDayOfMonthChange: noop,
  onTimeChange: noop,
  onTimeZoneChange: noop,
  onStartDateChange: noop,
  onSubmit: noop,
  onEndRule: noop,
  onConfirmEndRule: noop,
  onCancelEndRule: noop,
  ...overrides,
});

const rule = (overrides: Partial<RecurRule> = {}): RecurRule => ({
  ruleId: 'rule-1',
  title: 'Water the plants',
  frequency: 'every-n-days',
  n: 2,
  dayOfMonth: null,
  time: '09:00',
  timeZone: 'Asia/Bangkok',
  startDate: '2026-09-21',
  endedAt: null,
  ...overrides,
});

describe('ScheduleScreenView', () => {
  it('ui.recur.schedule: no-rule shows only the make-recurring form and no upcoming list', () => {
    render(<ScheduleScreenView {...baseProps()} />);
    expect(screen.getByRole('radio', { name: 'Every N days' })).toBeChecked();
    expect(screen.getByLabelText('Every (days)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeInTheDocument();
    expect(screen.queryByText('Upcoming occurrences')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End rule' })).not.toBeInTheDocument();
  });

  it('ui.recur.schedule: refused retains the invalid value and names the field assertively', () => {
    render(
      <ScheduleScreenView
        {...baseProps({
          state: 'refused',
          n: '0',
          refusal: { field: 'n', message: 'Enter a number of days greater than zero.' },
        })}
      />,
    );
    expect(screen.getByLabelText('Every (days)')).toHaveValue('0');
    expect(screen.getByLabelText('Time of day')).toHaveValue('09:00');
    expect(screen.getByLabelText('Time zone')).toHaveValue('Asia/Bangkok');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-09-21');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number of days greater than zero.');
    expect(screen.queryByText('Upcoming occurrences')).not.toBeInTheDocument();
  });

  it('ui.recur.schedule: monthly-day asks for a day of the month instead of an interval', () => {
    render(<ScheduleScreenView {...baseProps({ frequency: 'monthly-day', dayOfMonth: '31' })} />);
    expect(screen.getByRole('textbox', { name: 'Day of the month' })).toHaveValue('31');
    expect(screen.queryByRole('textbox', { name: 'Every (days)' })).not.toBeInTheDocument();
  });

  it('ui.recur.schedule: active shows the rule summary, upcoming previews and the end action', () => {
    render(
      <ScheduleScreenView
        {...baseProps({
          state: 'active',
          rule: rule(),
          upcoming: { materialised: [], previewDates: ['2026-09-21', '2026-09-23'] },
        })}
      />,
    );
    expect(screen.getByText(/Repeats every 2 days at 09:00 \(Asia\/Bangkok\)/)).toBeInTheDocument();
    expect(screen.getByText('Upcoming occurrences')).toBeInTheDocument();
    expect(screen.getByText('2026-09-23')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End rule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save schedule' })).not.toBeInTheDocument();
  });

  it('ui.recur.schedule: ended keeps materialised history and drops the preview and end action', () => {
    render(
      <ScheduleScreenView
        {...baseProps({
          state: 'ended',
          rule: rule({ endedAt: '2026-09-18' }),
          upcoming: {
            materialised: [
              { occurrenceId: 'occ-1', localDate: '2026-09-15', status: 'completed' },
              { occurrenceId: 'occ-2', localDate: '2026-09-17', status: 'orphaned' },
            ],
            previewDates: ['2026-09-21'],
          },
        })}
      />,
    );
    expect(screen.getByText(/ended 2026-09-18\./)).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('orphaned')).toBeInTheDocument();
    expect(screen.getByText('Nothing upcoming')).toBeInTheDocument();
    expect(screen.queryByText('2026-09-21')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End rule' })).not.toBeInTheDocument();
  });

  it('ui.recur.schedule: active end-rule asks for the consequence confirmation in place', () => {
    render(<ScheduleScreenView {...baseProps({ state: 'active', rule: rule(), isConfirmingEnd: true })} />);
    expect(screen.getByText(/No new occurrences are created/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep rule' })).toBeInTheDocument();
  });

  it('fr.recur.make-recurring: submitting the form calls onSubmit exactly once', () => {
    const onSubmit = vi.fn();
    render(<ScheduleScreenView {...baseProps({ onSubmit })} />);
    screen.getByRole('button', { name: 'Save schedule' }).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
