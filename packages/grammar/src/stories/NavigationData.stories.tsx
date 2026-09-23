import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseDate, type DateValue } from '@internationalized/date';
import React, { useState } from 'react';
import { waitFor } from 'storybook/test';
import * as G from '../common/index.js';
import { BookGlyph, HomeGlyph, Matrix, MenuGlyph, State, noop, pageLabel, placeholderImage, showRowStates } from './fixtures.js';

/**
 * Navigation and data display: wayfinding (tabs, breadcrumbs, pagination, stepper), collections
 * (table, list box, tags, timeline) and disclosure. Selected/current states are shown where they apply.
 */
const meta: Meta = {
  title: 'Navigation & Data',
};
export default meta;

type Story = StoryObj;

const faq: ReadonlyArray<G.AccordionItem> = [
  { id: 'billing', title: 'How does billing work?', content: 'You are billed monthly for active seats.' },
  { id: 'cancel', title: 'Can I cancel any time?', content: 'Yes. Access continues until the end of the period.' },
  { id: 'legacy', title: 'Legacy plans', content: 'No longer available.', isDisabled: true },
];

export const Accordion: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="One expanded (selected)" direction="column">
        <G.Accordion label="Frequently asked questions" items={faq} defaultExpandedIds={['billing']} />
      </State>
      <State label="Multiple expanded" direction="column">
        <G.Accordion label="Details" items={faq} allowsMultipleExpanded defaultExpandedIds={['billing', 'cancel']} headingLevel={4} />
      </State>
    </Matrix>
  ),
};

export const Disclosure: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Collapsed" direction="column">
        <G.Disclosure title="Advanced options">Retention, exports and audit settings.</G.Disclosure>
      </State>
      <State label="Expanded" direction="column">
        <G.Disclosure title="What is included?" defaultExpanded>Every lesson, offline access and certificates.</G.Disclosure>
      </State>
      <State label="Disabled" direction="column">
        <G.Disclosure title="Locked section" isDisabled>Hidden.</G.Disclosure>
      </State>
    </Matrix>
  ),
};

const people: ReadonlyArray<G.AvatarGroupItem> = [
  { id: 'a', name: 'Alex Morgan' },
  { id: 'b', name: 'Sam Lee', src: placeholderImage('S', 200) },
  { id: 'c', name: 'Robin Park' },
  { id: 'd', name: 'Jordan Kim' },
  { id: 'e', name: 'Taylor Fox' },
  { id: 'f', name: 'Casey Wu' },
];

export const AvatarGroup: Story = {
  render: () => (
    <Matrix>
      <State label="Overflow">
        <G.AvatarGroup label="Project members" items={people} max={4} overflowLabel={(count) => `${count} more members`} />
      </State>
      <State label="Sizes">
        <G.AvatarGroup label="Reviewers" items={people.slice(0, 3)} size="sm" overflowLabel={(count) => `${count} more`} />
        <G.AvatarGroup label="Owners" items={people.slice(0, 2)} size="lg" overflowLabel={(count) => `${count} more`} />
      </State>
    </Matrix>
  ),
};

export const Breadcrumbs: Story = {
  render: () => (
    <Matrix>
      <State label="Trail ending at the current page">
        <G.Breadcrumbs
          label="Breadcrumb"
          items={[
            { id: 'home', label: 'Home', href: '#home', leading: <G.Icon source={HomeGlyph} usage="leading" /> },
            { id: 'courses', label: 'Courses', href: '#courses' },
            { id: 'grammar', label: 'Grammar basics' },
          ]}
        />
      </State>
      <State label="Custom separator">
        <G.Breadcrumbs label="Folders" separator="/" items={[{ id: 'a', label: 'Drive', href: '#a' }, { id: 'b', label: 'Shared', href: '#b' }, { id: 'c', label: 'Reports' }]} />
      </State>
    </Matrix>
  ),
};

const isWeekend = (date: DateValue) => {
  const day = new Date(date.year, date.month - 1, date.day).getDay();
  return day === 0 || day === 6;
};

export const Calendar: Story = {
  render: () => (
    <Matrix>
      <State label="Selected date, weekends unavailable">
        <G.Calendar label="Delivery date" defaultValue={parseDate('2026-09-23')} isDateUnavailable={isWeekend} previousLabel="Previous month" nextLabel="Next month" />
      </State>
      <State label="Read-only and disabled">
        <G.Calendar label="Published on" value={parseDate('2026-09-10')} isReadOnly previousLabel="Previous month" nextLabel="Next month" />
        <G.Calendar label="Closed" defaultValue={parseDate('2026-09-10')} isDisabled previousLabel="Previous month" nextLabel="Next month" />
      </State>
    </Matrix>
  ),
};

type Lesson = { readonly id: string; readonly title: string; readonly level: string; readonly minutes: number };
const lessons: ReadonlyArray<Lesson> = [
  { id: 'l1', title: 'Articles', level: 'A1', minutes: 12 },
  { id: 'l2', title: 'Present simple', level: 'A1', minutes: 18 },
  { id: 'l3', title: 'Past continuous', level: 'A2', minutes: 22 },
  { id: 'l4', title: 'Conditionals', level: 'B1', minutes: 30 },
];
const lessonColumns: ReadonlyArray<G.DataTableColumn> = [
  { id: 'title', label: 'Lesson', isRowHeader: true, allowsSorting: true },
  { id: 'level', label: 'Level', allowsSorting: true },
  { id: 'minutes', label: 'Minutes', align: 'end', allowsSorting: true },
];
const lessonCell = (row: Lesson, columnId: string) => (columnId === 'title' ? row.title : columnId === 'level' ? row.level : row.minutes);

const SortableTable = () => {
  const [sort, setSort] = useState<G.DataTableSort>({ columnId: 'title', direction: 'ascending' });
  const sorted = [...lessons].sort((a, b) => {
    const key = sort.columnId as keyof Lesson;
    const order = String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true });
    return sort.direction === 'ascending' ? order : -order;
  });
  return (
    <G.DataTable
      label="Lessons"
      columns={lessonColumns}
      rows={sorted}
      renderCell={lessonCell}
      sort={sort}
      onSortChange={setSort}
      selectionMode="multiple"
      defaultSelectedIds={['l2']}
      selectAllLabel="Select all lessons"
      selectRowLabel={(row) => `Select ${row.title}`}
      emptyContent="No lessons match."
    />
  );
};

export const DataTable: Story = {
  render: () => (
    <Matrix maxWidth={720}>
      <State label="Sortable with a selected row" direction="column"><SortableTable /></State>
      <State label="Loading (pending)" direction="column">
        <G.DataTable label="Lessons loading" columns={lessonColumns} rows={[] as ReadonlyArray<Lesson>} renderCell={lessonCell} isLoading loadingContent="Loading lessons" emptyContent="No lessons." />
      </State>
      <State label="Empty" direction="column">
        <G.DataTable label="No lessons" columns={lessonColumns} rows={[] as ReadonlyArray<Lesson>} renderCell={lessonCell} emptyContent="No lessons match these filters." />
      </State>
    </Matrix>
  ),
};

export const DescriptionList: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Columns, divided" direction="column">
        <G.DescriptionList
          isDivided
          items={[
            { id: 'plan', term: 'Plan', description: 'Team' },
            { id: 'seats', term: 'Seats', description: '8 of 10' },
            { id: 'renews', term: 'Renews', description: '1 October 2026' },
          ]}
        />
      </State>
      <State label="Stacked" direction="column">
        <G.DescriptionList layout="stacked" items={[{ id: 'owner', term: 'Owner', description: 'Alex Morgan' }, { id: 'created', term: 'Created', description: '2 March 2026' }]} />
      </State>
    </Matrix>
  ),
};

const listItems: ReadonlyArray<G.ListBoxItem> = [
  { id: 'inbox', label: 'Inbox', description: '3 unread', leading: <G.Icon source={BookGlyph} usage="leading" /> },
  { id: 'drafts', label: 'Drafts' },
  { id: 'archive', label: 'Archive', trailing: <G.Badge>12</G.Badge> },
  { id: 'spam', label: 'Spam', isDisabled: true },
];

export const ListBox: Story = {
  render: () => (
    <Matrix maxWidth={360}>
      <State label="Single selection (selected)" direction="column">
        <G.ListBox label="Folders" items={listItems} selectionMode="single" defaultSelectedIds={['inbox']} />
      </State>
      <State label="Multiple selection" direction="column">
        <G.ListBox label="Labels" items={listItems} selectionMode="multiple" defaultSelectedIds={['drafts', 'archive']} />
      </State>
      <State label="Empty" direction="column">
        <G.ListBox label="Nothing here" items={[]} emptyContent="No folders yet." />
      </State>
    </Matrix>
  ),
};

const rowsIn = (canvasElement: HTMLElement, selector: string, minimum: number) =>
  waitFor(() => {
    const found = canvasElement.querySelectorAll<HTMLElement>(selector);
    if (found.length < minimum) throw new Error(`waiting for ${selector}`);
    return found;
  });

/** ListBox interactive rows: selected, hovered and keyboard-focused in one frame. */
export const ListBoxRowStates: Story = {
  name: 'ListBox (selected, hover, focus rows)',
  render: () => (
    <Matrix maxWidth={360}>
      <State label="Inbox selected, Drafts hovered, Archive keyboard-focused" direction="column">
        <G.ListBox label="Folders with row states" items={listItems} selectionMode="single" defaultSelectedIds={['inbox']} />
      </State>
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    const options = await rowsIn(canvasElement, '[role="option"]', 3);
    await showRowStates(options[1], options[2]);
  },
};

/** Selectable DataTable rows: selected, hovered and keyboard-focused in one frame. */
export const DataTableRowStates: Story = {
  name: 'DataTable (selected, hover, focus rows)',
  render: () => (
    <Matrix maxWidth={720}>
      <State label="Present simple selected, Past continuous hovered, Conditionals keyboard-focused" direction="column">
        <G.DataTable
          label="Lessons with row states"
          columns={lessonColumns}
          rows={lessons}
          renderCell={lessonCell}
          selectionMode="multiple"
          defaultSelectedIds={['l2']}
          selectAllLabel="Select all lessons"
          selectRowLabel={(row) => `Select ${row.title}`}
          onRowAction={noop}
          emptyContent="No lessons."
        />
      </State>
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    const rows = await rowsIn(canvasElement, '[data-grammar-table-row]', 4);
    await showRowStates(rows[2], rows[3]);
  },
};

const PaginationDemo = ({ label, pageCount, initial }: { readonly label: string; readonly pageCount: number; readonly initial: number }) => {
  const [page, setPage] = useState(initial);
  return (
    <G.Pagination
      label={label}
      page={page}
      pageCount={pageCount}
      onPageChange={setPage}
      previousLabel="Previous"
      nextLabel="Next"
      pageLabel={pageLabel}
      summary={`Page ${page} of ${pageCount}`}
    />
  );
};

export const Pagination: Story = {
  render: () => (
    <Matrix>
      <State label="First page (previous disabled)"><PaginationDemo label="Short results pages" pageCount={5} initial={1} /></State>
      <State label="Middle page with ellipses (current)"><PaginationDemo label="Long results pages" pageCount={20} initial={10} /></State>
      <State label="Last page"><PaginationDemo label="Final results pages" pageCount={20} initial={20} /></State>
    </Matrix>
  ),
};

const steps: ReadonlyArray<G.StepperStep> = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile', description: 'Name and photo' },
  { id: 'billing', label: 'Billing' },
  { id: 'done', label: 'Done', isDisabled: true },
];

export const Stepper: Story = {
  render: () => (
    <Matrix maxWidth={720}>
      <State label="Horizontal, current step" direction="column">
        <G.Stepper label="Sign-up progress" steps={steps} currentStepId="profile" onStepSelect={noop} />
      </State>
      <State label="Vertical with an error step" direction="column">
        <G.Stepper
          label="Import progress"
          orientation="vertical"
          steps={[{ id: 'upload', label: 'Upload' }, { id: 'map', label: 'Map columns', state: 'error', description: 'Two columns are missing.' }, { id: 'review', label: 'Review' }]}
          currentStepId="map"
        />
      </State>
    </Matrix>
  ),
};

const tags: ReadonlyArray<G.TagGroupItem> = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocab', label: 'Vocabulary' },
  { id: 'listening', label: 'Listening' },
  { id: 'archived', label: 'Archived', isDisabled: true },
];

const RemovableTags = () => {
  const [items, setItems] = useState(tags);
  return (
    <G.TagGroup
      label="Active filters"
      items={items}
      onRemove={(ids) => setItems((current) => current.filter((item) => !ids.includes(item.id)))}
      removeLabel={(label) => `Remove ${label}`}
      emptyContent="No filters."
    />
  );
};

export const TagGroup: Story = {
  render: () => (
    <Matrix>
      <State label="Selectable (selected)">
        <G.TagGroup label="Topics" items={tags} selectionMode="multiple" defaultSelectedIds={['grammar']} />
      </State>
      <State label="Removable"><RemovableTags /></State>
      <State label="Sizes">
        <G.TagGroup label="Small tags" size="sm" items={tags.slice(0, 2)} />
        <G.TagGroup label="Large tags" size="lg" items={tags.slice(0, 2)} />
      </State>
    </Matrix>
  ),
};

export const Timeline: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="States with a current item" direction="column">
        <G.Timeline
          label="Order history"
          items={[
            { id: 'placed', title: 'Order placed', dateTime: '2026-09-20T09:00', timeLabel: '20 Sep, 09:00', state: 'affirmative' },
            { id: 'packed', title: 'Packed', dateTime: '2026-09-21T14:30', timeLabel: '21 Sep, 14:30', state: 'affirmative' },
            { id: 'transit', title: 'In transit', description: 'Arriving tomorrow.', state: 'pending', isCurrent: true },
            { id: 'delivered', title: 'Delivered', state: 'neutral' },
          ]}
        />
      </State>
      <State label="Negative item" direction="column">
        <G.Timeline label="Build log" items={[{ id: 'b1', title: 'Build started', state: 'informative' }, { id: 'b2', title: 'Tests failed', state: 'negative', description: '2 failures.' }]} />
      </State>
    </Matrix>
  ),
};

const tabItems: ReadonlyArray<G.TabItem> = [
  { id: 'overview', label: 'Overview' },
  { id: 'lessons', label: 'Lessons', leading: <G.Icon source={BookGlyph} usage="leading" /> },
  { id: 'members', label: 'Members' },
];

const TabsDemo = () => {
  const [selected, setSelected] = useState('overview');
  return (
    <div>
      <G.Tabs label="Course sections" items={tabItems} selectedKey={selected} onSelect={setSelected} panelId={(key) => `story-tab-panel-${key}`} labelVisibility="always" />
      {tabItems.map((item) => (
        <div key={item.id} role="tabpanel" id={`story-tab-panel-${item.id}`} aria-label={item.label} hidden={item.id !== selected} style={{ paddingTop: '1rem' }}>
          <G.Text>{item.label} panel</G.Text>
        </div>
      ))}
    </div>
  );
};

export const Tabs: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Selected tab controls its panel" direction="column"><TabsDemo /></State>
    </Matrix>
  ),
};

const SubnavDemo = ({ label, initialOpen }: { readonly label: string; readonly initialOpen: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <G.Subnav
      label={label}
      title="Grammar basics"
      leading={<G.Icon source={BookGlyph} usage="leading" />}
      menuIcon={<G.Icon source={MenuGlyph} />}
      openMenuLabel="Open section menu"
      closeMenuLabel="Close section menu"
      isMenuOpen={open}
      onMenuOpenChange={setOpen}
      position="static"
      visibility="always"
    />
  );
};

export const Subnav: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Menu closed" direction="column"><SubnavDemo label="Lesson sections" initialOpen={false} /></State>
      <State label="Menu open (expanded)" direction="column"><SubnavDemo label="Course sections" initialOpen /></State>
    </Matrix>
  ),
};
