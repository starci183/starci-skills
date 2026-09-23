import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import * as G from '../common/index.js';
import { Matrix, SettingsGlyph, State, TrashGlyph, UserGlyph, noop } from './fixtures.js';

/**
 * Overlays and feedback. Every overlay story opens by default so the surface is visible, and every
 * overlay portals into the nearest `.grammar-common-root` — the toolbar family root here — so the
 * family scope, tokens and theme still apply to it. `Toaster` must likewise be mounted inside the root.
 */
const meta: Meta = {
  title: 'Overlays',
};
export default meta;

type Story = StoryObj;

const openParameters = { grammar: { minHeight: '38rem' } };

export const Alert: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Tones" direction="column">
        <G.Alert title="Heads up" description="Informative is the default tone." />
        <G.Alert tone="affirmative" title="Saved" description="Your changes are live." />
        <G.Alert tone="cautionary" title="Almost full" description="You have used 90% of your storage." />
        <G.Alert tone="negative" title="Payment failed" description="Update the card on file to keep access." />
        <G.Alert tone="neutral" title="Neutral notice" />
      </State>
      <State label="Pending" direction="column">
        <G.Alert tone="pending" title="Syncing" description="This can take a minute." />
      </State>
      <State label="With action and dismiss" direction="column">
        <G.Alert tone="cautionary" title="New version available" action={{ label: 'Reload', onAction: noop }} dismissLabel="Dismiss" onDismiss={noop} />
      </State>
    </Matrix>
  ),
};

export const Dialog: Story = {
  parameters: openParameters,
  render: () => (
    <G.Dialog
      defaultOpen
      title="Rename project"
      description="The new name is visible to everyone on the team."
      closeLabel="Close"
      trigger={<G.Button variant="secondary">Rename project</G.Button>}
      footer={(close) => (
        <>
          <G.Button variant="ghost" onPress={close}>Cancel</G.Button>
          <G.Button variant="primary" onPress={close}>Save</G.Button>
        </>
      )}
    >
      <G.Input id="dialog-name" name="name" label="Project name" defaultValue="Quarterly plan" />
    </G.Dialog>
  ),
};

export const DialogSmallNotDismissable: Story = {
  name: 'Dialog (small, not dismissable)',
  parameters: openParameters,
  render: () => (
    <G.Dialog
      defaultOpen
      size="sm"
      isDismissable={false}
      isKeyboardDismissDisabled
      title="Session expired"
      description="Sign in again to continue."
      trigger={<G.Button>Show</G.Button>}
      footer={(close) => <G.Button variant="primary" width="fill" onPress={close}>Sign in</G.Button>}
    />
  ),
};

export const AlertDialog: Story = {
  parameters: openParameters,
  render: () => (
    <G.AlertDialog
      defaultOpen
      tone="negative"
      title="Delete this project?"
      description="Its lessons and history are removed for everyone. This cannot be undone."
      confirmLabel="Delete project"
      cancelLabel="Keep project"
      onConfirm={noop}
      trigger={<G.Button variant="outline">Delete project</G.Button>}
    />
  ),
};

export const AlertDialogPending: Story = {
  name: 'AlertDialog (confirm pending)',
  parameters: openParameters,
  render: () => (
    <G.AlertDialog
      defaultOpen
      tone="cautionary"
      title="Leave the team?"
      description="You will lose access to shared projects."
      confirmLabel="Leave"
      cancelLabel="Stay"
      isConfirmPending
      onConfirm={noop}
      trigger={<G.Button variant="outline">Leave team</G.Button>}
    />
  ),
};

const FilterFields = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <G.CheckboxGroup
      label="Status"
      options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }]}
      defaultValue={['active']}
    />
    <G.Select label="Owner" options={[{ id: 'me', label: 'Me' }, { id: 'team', label: 'My team' }]} defaultValue="me" />
  </div>
);

export const Drawer: Story = {
  parameters: openParameters,
  render: () => (
    <G.Drawer
      defaultOpen
      placement="right"
      title="Filters"
      description="Narrow the list."
      closeLabel="Close filters"
      trigger={<G.Button variant="secondary">Filters</G.Button>}
      footer={(close) => (
        <>
          <G.Button variant="ghost" onPress={close}>Clear</G.Button>
          <G.Button variant="primary" onPress={close}>Apply</G.Button>
        </>
      )}
    >
      <FilterFields />
    </G.Drawer>
  ),
};

export const DrawerBottomSheet: Story = {
  name: 'Drawer (bottom sheet with handle)',
  parameters: openParameters,
  render: () => (
    <G.Drawer
      defaultOpen
      placement="bottom"
      showHandle
      title="Share"
      closeLabel="Close"
      trigger={<G.Button variant="secondary">Share</G.Button>}
    >
      <G.Text>Anyone with the link can view.</G.Text>
    </G.Drawer>
  ),
};

const MenuDemo = () => {
  const [sort, setSort] = useState<readonly string[]>(['recent']);
  return (
    <G.DropdownMenu
      defaultOpen
      trigger={<G.Button variant="secondary">Options</G.Button>}
      entries={[
        { id: 'profile', label: 'Profile', iconSource: UserGlyph, shortcut: ['command', 'P'] },
        { id: 'settings', label: 'Settings', iconSource: SettingsGlyph, description: 'Account and privacy' },
        { id: 'locked', label: 'Billing', isDisabled: true },
        {
          kind: 'section',
          id: 'sort',
          label: 'Sort by',
          selection: { mode: 'single', selectedIds: sort, onChange: setSort },
          items: [{ id: 'recent', label: 'Most recent' }, { id: 'name', label: 'Name' }],
        },
        { kind: 'section', id: 'danger', items: [{ id: 'delete', label: 'Delete', tone: 'negative', iconSource: TrashGlyph }] },
      ]}
      onAction={noop}
    />
  );
};

export const DropdownMenu: Story = {
  parameters: openParameters,
  render: () => <MenuDemo />,
};

export const Popover: Story = {
  parameters: openParameters,
  render: () => (
    <div style={{ paddingTop: '1rem' }}>
      <G.Popover
        defaultOpen
        showArrow
        title="Keyboard shortcuts"
        trigger={<G.Button variant="secondary">Shortcuts</G.Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <G.Text size="sm">Search <G.Kbd keys={['command', 'K']} /></G.Text>
          <G.Text size="sm">New lesson <G.Kbd keys={['command', 'N']} /></G.Text>
        </div>
      </G.Popover>
    </div>
  ),
};

export const Tooltip: Story = {
  render: () => (
    <Matrix>
      <State label="Top (revealed on focus)">
        <div style={{ paddingTop: '2.5rem' }}>
          <G.Tooltip content="Search everything" placement="top">
            <G.Button variant="secondary">Search</G.Button>
          </G.Tooltip>
        </div>
      </State>
      <State label="Bottom">
        <G.Tooltip content="Open settings" placement="bottom">
          <G.IconButton source={SettingsGlyph} label="Settings" />
        </G.Tooltip>
      </State>
    </Matrix>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[data-grammar-tooltip-trigger] button');
    trigger?.focus();
  },
};

const record = (id: string, options: G.ToastOptions): G.ToastRecord => ({ ...options, id, version: 1 });

export const Toast: Story = {
  render: () => (
    <Matrix maxWidth={420}>
      <State label="Tones" direction="column">
        <G.Toast toast={record('t1', { title: 'Saved', tone: 'affirmative', timeout: 0 })} dismissLabel="Dismiss" onDismiss={noop} />
        <G.Toast toast={record('t2', { title: 'Link copied', description: 'Paste it anywhere.', tone: 'informative', timeout: 0 })} dismissLabel="Dismiss" onDismiss={noop} />
        <G.Toast toast={record('t3', { title: 'Storage almost full', tone: 'cautionary', timeout: 0 })} dismissLabel="Dismiss" onDismiss={noop} />
        <G.Toast toast={record('t4', { title: 'Upload failed', description: 'Check your connection.', tone: 'negative', timeout: 0 })} dismissLabel="Dismiss" onDismiss={noop} />
      </State>
      <State label="Pending and with action" direction="column">
        <G.Toast toast={record('t5', { title: 'Uploading 3 files', tone: 'pending', timeout: 0 })} dismissLabel="Dismiss" onDismiss={noop} />
        <G.Toast toast={record('t6', { title: 'Lesson archived', tone: 'neutral', timeout: 0, action: { label: 'Undo', onAction: noop } })} dismissLabel="Dismiss" onDismiss={noop} />
      </State>
    </Matrix>
  ),
};

const seededQueue = () => {
  const queue = G.createToastQueue();
  queue.add({ title: 'Draft saved', tone: 'affirmative', timeout: 0 });
  queue.add({ title: 'Connection lost', description: 'Retrying in 5 seconds.', tone: 'negative', timeout: 0, action: { label: 'Retry', onAction: noop } });
  return queue;
};

const ToasterDemo = () => {
  const [queue] = useState(seededQueue);
  return (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <G.Button variant="secondary" onPress={() => queue.add({ title: 'Reminder set', tone: 'informative' })}>Add toast</G.Button>
      <G.Button variant="ghost" onPress={() => queue.clear()}>Clear</G.Button>
      <G.Toaster label="Notifications" dismissLabel="Dismiss notification" queue={queue} placement="bottom-end" />
    </div>
  );
};

export const Toaster: Story = {
  parameters: openParameters,
  render: () => <ToasterDemo />,
};
