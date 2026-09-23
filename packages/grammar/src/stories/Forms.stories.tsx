import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseDate, parseTime } from '@internationalized/date';
import React, { useState } from 'react';
import { userEvent, waitFor } from 'storybook/test';
import * as G from '../common/index.js';
import { Matrix, SearchGlyph, StarGlyph, State, UploadGlyph, noop, showRowStates } from './fixtures.js';

/**
 * Forms: every input renderer shares the Field contract (label, description, error,
 * required/disabled/read-only/invalid), so each story walks the same state matrix.
 */
const meta: Meta = {
  title: 'Forms',
};
export default meta;

type Story = StoryObj;

const planOptions: ReadonlyArray<G.ListOption> = [
  { id: 'starter', label: 'Starter', description: 'For one person' },
  { id: 'team', label: 'Team', description: 'Up to ten people' },
  { id: 'org', label: 'Organisation' },
  { id: 'legacy', label: 'Legacy plan', isDisabled: true },
];

const choiceOptions: ReadonlyArray<G.ChoiceOption> = [
  { value: 'email', label: 'Email', description: 'A daily summary' },
  { value: 'push', label: 'Push notification' },
  { value: 'sms', label: 'Text message', isDisabled: true },
];

const segmentOptions: ReadonlyArray<G.SegmentOption> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const formColumn = 420;

export const Input: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Variants" direction="column">
        <G.Input id="input-primary" name="email" label="Email" kind="email" variant="primary" placeholder="you@example.com" />
        <G.Input id="input-secondary" name="name" label="Display name" variant="secondary" hint="Shown on your profile." />
        <G.Input id="input-password" name="password" label="Password" kind="password" defaultValue="hunter22" revealLabel="Show password" hideLabel="Hide password" />
      </State>
      <State label="Required" direction="column">
        <G.Input id="input-required" name="required" label="Full name" isRequired />
      </State>
      <State label="Invalid" direction="column">
        <G.Input id="input-invalid" name="invalid" label="Email" kind="email" isError errorMessage="Enter a valid email address." defaultValue="not-an-email" />
      </State>
      <State label="Disabled" direction="column">
        <G.Input id="input-disabled" name="disabled" label="Workspace" isDisabled defaultValue="Locked value" />
      </State>
      <State label="Skeleton (pending)" direction="column">
        <G.Input id="input-skeleton" name="skeleton" label="Loading" isSkeleton />
      </State>
    </Matrix>
  ),
};

/** OtpInput has no label prop: the consumer names it with a `<label for>` (and `describedBy` for errors). */
const LabelledOtp = ({ id, label, ...props }: { readonly id: string; readonly label: string } & Omit<G.OtpInputProps, 'id' | 'name'>) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
    <label htmlFor={id}>{label}</label>
    <G.OtpInput id={id} name={id} {...props} />
  </div>
);

export const OtpInput: Story = {
  render: () => (
    <Matrix>
      <State label="Default">
        <LabelledOtp id="otp-default" label="Verification code" />
      </State>
      <State label="Prefilled">
        <LabelledOtp id="otp-filled" label="Partly entered code" defaultValue="428" />
      </State>
      <State label="Invalid">
        <LabelledOtp id="otp-invalid" label="Rejected code" defaultValue="111111" invalid describedBy="otp-invalid-error" />
        <G.Text id="otp-invalid-error" live="polite">That code has expired.</G.Text>
      </State>
      <State label="Disabled">
        <LabelledOtp id="otp-disabled" label="Code (locked)" disabled />
      </State>
    </Matrix>
  ),
};

export const PressableField: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.PressableField label="Search" placeholder="Search lessons" source={SearchGlyph} shortcut="Ctrl K" onPress={noop} />
      </State>
      <State label="Disabled" direction="column">
        <G.PressableField label="Search" placeholder="Search is unavailable" source={SearchGlyph} isDisabled />
      </State>
    </Matrix>
  ),
};

export const Field: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default with description" direction="column">
        <G.Field label="Nickname" description="Shown to other people." name="nickname">
          {(control) => <input {...control} placeholder="nickname" />}
        </G.Field>
      </State>
      <State label="Required and invalid" direction="column">
        <G.Field label="Nickname" isRequired isInvalid errorMessage="Choose a longer nickname." name="nick-invalid">
          {(control) => <input {...control} defaultValue="a" />}
        </G.Field>
      </State>
      <State label="Disabled and read-only" direction="column">
        <G.Field label="Plan" isDisabled>
          {(control) => <select {...control}><option>Starter</option></select>}
        </G.Field>
        <G.Field label="Account id" isReadOnly>
          {(control) => <input {...control} defaultValue="acct-0042" />}
        </G.Field>
      </State>
    </Matrix>
  ),
};

export const Textarea: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.Textarea label="Bio" description="A sentence or two." placeholder="Tell people about yourself" rows={3} />
      </State>
      <State label="Invalid" direction="column">
        <G.Textarea label="Bio" isInvalid errorMessage="Keep it under 20 characters." defaultValue="This bio is a little too long." maxLength={20} />
      </State>
      <State label="Disabled and read-only" direction="column">
        <G.Textarea label="Notes" isDisabled defaultValue="Disabled notes" />
        <G.Textarea label="Audit trail" isReadOnly defaultValue="Read-only history" />
      </State>
    </Matrix>
  ),
};

export const SearchField: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.SearchField label="Search" isLabelHidden placeholder="Search lessons" clearLabel="Clear search" />
      </State>
      <State label="With value" direction="column">
        <G.SearchField label="Search" defaultValue="grammar" clearLabel="Clear search" />
      </State>
      <State label="Pending" direction="column">
        <G.SearchField label="Search" defaultValue="loading" isPending clearLabel="Clear search" />
      </State>
      <State label="Invalid" direction="column">
        <G.SearchField label="Search" isInvalid errorMessage="Enter at least two characters." defaultValue="a" clearLabel="Clear search" />
      </State>
      <State label="Disabled" direction="column">
        <G.SearchField label="Search" isDisabled placeholder="Search is off" clearLabel="Clear search" />
      </State>
    </Matrix>
  ),
};

export const NumberField: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.NumberField label="Seats" defaultValue={3} minValue={1} maxValue={50} />
      </State>
      <State label="Currency format, no steppers" direction="column">
        <G.NumberField label="Budget" defaultValue={1200} formatOptions={{ style: 'currency', currency: 'USD' }} hideSteppers />
      </State>
      <State label="Invalid" direction="column">
        <G.NumberField label="Seats" defaultValue={0} isInvalid errorMessage="At least one seat is required." />
      </State>
      <State label="Disabled" direction="column">
        <G.NumberField label="Seats" defaultValue={5} isDisabled />
      </State>
    </Matrix>
  ),
};

export const Checkbox: Story = {
  render: () => (
    <Matrix>
      <State label="Default">
        <G.Checkbox label="Remember me" />
      </State>
      <State label="Selected">
        <G.Checkbox label="Subscribe" defaultSelected />
      </State>
      <State label="Indeterminate">
        <G.Checkbox label="Select all" isIndeterminate />
      </State>
      <State label="Invalid">
        <G.Checkbox label="Accept the terms" isRequired isInvalid errorMessage="Required to continue." />
      </State>
      <State label="Disabled">
        <G.Checkbox label="Disabled" isDisabled />
        <G.Checkbox label="Disabled selected" isDisabled defaultSelected />
      </State>
    </Matrix>
  ),
};

export const CheckboxGroup: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.CheckboxGroup label="Notifications" description="Choose any." options={choiceOptions} defaultValue={['email']} />
      </State>
      <State label="Horizontal" direction="column">
        <G.CheckboxGroup label="Days" orientation="horizontal" options={[{ value: 'mon', label: 'Mon' }, { value: 'tue', label: 'Tue' }, { value: 'wed', label: 'Wed' }]} />
      </State>
      <State label="Invalid" direction="column">
        <G.CheckboxGroup label="Topics" isRequired isInvalid errorMessage="Pick at least one topic." options={choiceOptions} />
      </State>
      <State label="Disabled" direction="column">
        <G.CheckboxGroup label="Locked" isDisabled options={choiceOptions} defaultValue={['push']} />
      </State>
    </Matrix>
  ),
};

export const RadioGroup: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default (selected)" direction="column">
        <G.RadioGroup label="Delivery" options={choiceOptions} defaultValue="email" />
      </State>
      <State label="Horizontal" direction="column">
        <G.RadioGroup label="Size" orientation="horizontal" options={[{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }]} defaultValue="m" />
      </State>
      <State label="Invalid" direction="column">
        <G.RadioGroup label="Delivery" isRequired isInvalid errorMessage="Choose a delivery method." options={choiceOptions} />
      </State>
      <State label="Disabled" direction="column">
        <G.RadioGroup label="Delivery" isDisabled options={choiceOptions} defaultValue="push" />
      </State>
    </Matrix>
  ),
};

export const Switch: Story = {
  render: () => (
    <Matrix>
      <State label="Default">
        <G.Switch label="Dark mode" />
      </State>
      <State label="Selected">
        <G.Switch label="Notifications" defaultSelected />
      </State>
      <State label="Invalid">
        <G.Switch label="Required toggle" isInvalid errorMessage="Turn this on to continue." />
      </State>
      <State label="Disabled">
        <G.Switch label="Disabled" isDisabled />
        <G.Switch label="Disabled on" isDisabled defaultSelected />
      </State>
    </Matrix>
  ),
};

export const Slider: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Single value" direction="column">
        <G.Slider label="Volume" defaultValue={40} />
      </State>
      <State label="Range" direction="column">
        <G.Slider label="Price" defaultValue={[20, 80]} thumbLabels={['Minimum', 'Maximum']} formatOptions={{ style: 'currency', currency: 'USD' }} />
      </State>
      <State label="Disabled" direction="column">
        <G.Slider label="Locked" defaultValue={60} isDisabled />
      </State>
    </Matrix>
  ),
};

export const DateField: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.DateField label="Start date" defaultValue={parseDate('2026-09-23')} />
      </State>
      <State label="Invalid" direction="column">
        <G.DateField label="Birth date" isInvalid errorMessage="Enter a date in the past." defaultValue={parseDate('2030-01-01')} />
      </State>
      <State label="Disabled and read-only" direction="column">
        <G.DateField label="Created" isDisabled defaultValue={parseDate('2026-01-15')} />
        <G.DateField label="Renews" isReadOnly defaultValue={parseDate('2027-01-15')} />
      </State>
    </Matrix>
  ),
};

export const TimeField: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.TimeField label="Reminder" defaultValue={parseTime('09:30')} />
      </State>
      <State label="24-hour" direction="column">
        <G.TimeField label="Start" defaultValue={parseTime('18:45')} hourCycle={24} />
      </State>
      <State label="Invalid" direction="column">
        <G.TimeField label="Quiet hours" isInvalid errorMessage="Pick a time after 20:00." defaultValue={parseTime('12:00')} />
      </State>
      <State label="Disabled" direction="column">
        <G.TimeField label="Locked" isDisabled defaultValue={parseTime('07:00')} />
      </State>
    </Matrix>
  ),
};

export const DatePicker: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.DatePicker label="Due date" defaultValue={parseDate('2026-10-01')} />
      </State>
      <State label="Invalid" direction="column">
        <G.DatePicker label="Due date" isInvalid errorMessage="Pick a date after today." defaultValue={parseDate('2020-01-01')} />
      </State>
      <State label="Disabled" direction="column">
        <G.DatePicker label="Due date" isDisabled />
      </State>
    </Matrix>
  ),
};

export const DateRangePicker: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.DateRangePicker label="Trip" defaultValue={{ start: parseDate('2026-10-01'), end: parseDate('2026-10-08') }} />
      </State>
      <State label="Invalid" direction="column">
        <G.DateRangePicker label="Trip" isInvalid errorMessage="The range must be at most two weeks." />
      </State>
      <State label="Disabled" direction="column">
        <G.DateRangePicker label="Trip" isDisabled />
      </State>
    </Matrix>
  ),
};

export const Select: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.Select label="Plan" placeholder="Choose a plan" options={planOptions} />
      </State>
      <State label="Selected" direction="column">
        <G.Select label="Plan" options={planOptions} defaultValue="team" />
      </State>
      <State label="Pending" direction="column">
        <G.Select label="Plan" options={planOptions} isPending placeholder="Loading plans" />
      </State>
      <State label="Invalid" direction="column">
        <G.Select label="Plan" options={planOptions} isRequired isInvalid errorMessage="Choose a plan." />
      </State>
      <State label="Disabled" direction="column">
        <G.Select label="Plan" options={planOptions} isDisabled defaultValue="starter" />
      </State>
    </Matrix>
  ),
};

/** Open the listbox of a Select/ComboBox and show a selected, a hovered and a keyboard-focused option. */
const openWithRowStates = async (canvasElement: HTMLElement, trigger: string) => {
  const control = canvasElement.querySelector<HTMLElement>(trigger);
  if (control !== null) await userEvent.click(control);
  const root = canvasElement.ownerDocument;
  const options = await waitFor(() => {
    const found = root.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]');
    if (found.length < 3) throw new Error('options not open yet');
    return found;
  });
  await showRowStates(options[2], undefined);
  await userEvent.keyboard('{ArrowDown}');
};

export const SelectOpenRowStates: Story = {
  name: 'Select (open: selected, hover, focus rows)',
  parameters: { grammar: { minHeight: '28rem' } },
  render: () => (
    <div style={{ maxWidth: formColumn }}>
      <G.Select label="Plan" options={planOptions} defaultValue="starter" />
    </div>
  ),
  play: async ({ canvasElement }) => openWithRowStates(canvasElement, 'button'),
};

export const ComboBoxOpenRowStates: Story = {
  name: 'ComboBox (open: selected, hover, focus rows)',
  parameters: { grammar: { minHeight: '28rem' } },
  render: () => (
    <div style={{ maxWidth: formColumn }}>
      <G.ComboBox label="Plan" options={planOptions} defaultValue="starter" menuTrigger="focus" />
    </div>
  ),
  play: async ({ canvasElement }) => openWithRowStates(canvasElement, 'input'),
};

export const ComboBox: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.ComboBox label="Plan" placeholder="Type to filter" options={planOptions} />
      </State>
      <State label="Selected" direction="column">
        <G.ComboBox label="Plan" options={planOptions} defaultValue="org" />
      </State>
      <State label="Pending" direction="column">
        <G.ComboBox label="Plan" options={planOptions} isPending placeholder="Searching" />
      </State>
      <State label="Invalid" direction="column">
        <G.ComboBox label="Plan" options={planOptions} isInvalid errorMessage="Pick a plan from the list." defaultInputValue="Unknown" />
      </State>
      <State label="Disabled" direction="column">
        <G.ComboBox label="Plan" options={planOptions} isDisabled />
      </State>
    </Matrix>
  ),
};

export const SegmentedControl: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Selected" direction="column">
        <G.SegmentedControl label="Range" options={segmentOptions} defaultValue="week" />
      </State>
      <State label="Fill width with a disabled option" direction="column">
        <G.SegmentedControl label="View" width="fill" options={[...segmentOptions, { value: 'year', label: 'Year', isDisabled: true }]} defaultValue="day" />
      </State>
      <State label="Disabled" direction="column">
        <G.SegmentedControl label="Range" options={segmentOptions} defaultValue="month" isDisabled />
      </State>
    </Matrix>
  ),
};

export const ButtonGroup: Story = {
  render: () => (
    <Matrix>
      <State label="Horizontal">
        <G.ButtonGroup label="Text alignment">
          <G.Button variant="secondary">Left</G.Button>
          <G.Button variant="secondary">Centre</G.Button>
          <G.Button variant="secondary">Right</G.Button>
        </G.ButtonGroup>
      </State>
      <State label="Vertical">
        <G.ButtonGroup label="Actions" orientation="vertical">
          <G.Button variant="outline">Duplicate</G.Button>
          <G.Button variant="outline">Archive</G.Button>
        </G.ButtonGroup>
      </State>
      <State label="Disabled">
        <G.ButtonGroup label="History" isDisabled>
          <G.Button variant="secondary">Undo</G.Button>
          <G.Button variant="secondary">Redo</G.Button>
        </G.ButtonGroup>
      </State>
    </Matrix>
  ),
};

export const FileDropzone: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.FileDropzone label="Attachments" description="PNG or PDF, up to 5 MB." prompt="Drop files here or browse" icon={<G.Icon source={UploadGlyph} usage="heading" />} accept="image/png,application/pdf" multiple />
      </State>
      <State label="Invalid" direction="column">
        <G.FileDropzone label="Avatar" prompt="Drop an image" isRequired isInvalid errorMessage="An image is required." />
      </State>
      <State label="Disabled" direction="column">
        <G.FileDropzone label="Attachments" prompt="Uploads are paused" isDisabled />
      </State>
    </Matrix>
  ),
};

export const Rating: Story = {
  render: () => (
    <Matrix>
      <State label="Interactive">
        <G.Rating label="Rate this lesson" defaultValue={3} valueLabel={(value, max) => `${value} of ${max} stars`} />
      </State>
      <State label="Custom icon, ten steps">
        <G.Rating label="Difficulty" max={10} defaultValue={7} icon={<G.Icon source={StarGlyph} />} valueLabel={(value, max) => `${value} of ${max}`} />
      </State>
      <State label="Read-only">
        <G.Rating label="Average rating" value={4} isReadOnly valueLabel={(value, max) => `${value} of ${max} stars`} />
      </State>
      <State label="Disabled">
        <G.Rating label="Rating closed" value={2} isDisabled valueLabel={(value, max) => `${value} of ${max} stars`} />
      </State>
    </Matrix>
  ),
};

export const Fieldset: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column">
        <G.Fieldset legend="Profile" description="Visible to your team.">
          <G.Input id="fs-name" name="name" label="Name" />
          <G.Input id="fs-role" name="role" label="Role" />
        </G.Fieldset>
      </State>
      <State label="Invalid with actions" direction="column">
        <G.Fieldset legend="Address" errorMessage="Complete the address before saving." actions={<G.Button size="sm" variant="secondary">Reset</G.Button>}>
          <G.Input id="fs-street" name="street" label="Street" isError errorMessage="Required." />
        </G.Fieldset>
      </State>
      <State label="Disabled" direction="column">
        <G.Fieldset legend="Billing" isDisabled>
          <G.Switch label="Invoices by email" />
        </G.Fieldset>
      </State>
    </Matrix>
  ),
};

const FormDemo = ({ label, isPending, withErrors }: { readonly label: string; readonly isPending?: boolean; readonly withErrors?: boolean }) => {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <G.Form
      label={label}
      isPending={isPending === true}
      {...(withErrors === true ? { validationErrors: { message: 'Add a short note so they know who invited them.' } } : {})}
      onSubmit={(data) => setSubmitted(String(data.get('role') ?? ''))}
    >
      <G.Textarea label="Message" name="message" rows={2} placeholder="Optional note" />
      <G.Select label="Role" name="role" options={planOptions} defaultValue="team" />
      <G.Checkbox label="Send a copy to me" name="copy" />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <G.Button type="submit" variant="primary" isPending={isPending === true}>Send invite</G.Button>
        <G.Button type="reset" variant="ghost">Reset</G.Button>
      </div>
      {submitted === null ? null : <G.Text live="polite">Submitted with role {submitted}.</G.Text>}
    </G.Form>
  );
};

export const Form: Story = {
  render: () => (
    <Matrix maxWidth={formColumn}>
      <State label="Default" direction="column"><FormDemo label="Invite a teammate" /></State>
      <State label="Server validation errors (invalid)" direction="column"><FormDemo label="Invite with server errors" withErrors /></State>
      <State label="Pending" direction="column"><FormDemo label="Invite being sent" isPending /></State>
    </Matrix>
  ),
};
