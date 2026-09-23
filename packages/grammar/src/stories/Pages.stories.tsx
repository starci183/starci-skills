import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import * as G from '../common/index.js';
import {
  BellGlyph,
  BookGlyph,
  ChartGlyph,
  FilterGlyph,
  HomeGlyph,
  MenuGlyph,
  SearchGlyph,
  SettingsGlyph,
  UploadGlyph,
  UserGlyph,
  noop,
  pageLabel,
  placeholderImage,
} from './fixtures.js';

/**
 * Page-level compositions built only from Common renderers, pinned to each family so the three
 * families can be compared side by side: a settings form page, a data list with a filter drawer and
 * pagination, and a mobile home with TopBar + BottomNav + Toast. Every overlay and the Toaster sit
 * inside the family GrammarRoot (the preview decorator), which is the portal rule apps must follow.
 */
const meta: Meta = {
  title: 'Compositions/Pages',
  parameters: { grammar: { bleed: true } },
};
export default meta;

type Story = StoryObj;

/* ------------------------------------------------------------------ settings form page */

const settingsNav: ReadonlyArray<G.SidebarGroup> = [
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'profile', label: 'Profile', source: UserGlyph },
      { id: 'notifications', label: 'Notifications', source: BellGlyph },
      { id: 'billing', label: 'Billing', source: ChartGlyph },
      { id: 'advanced', label: 'Advanced', source: SettingsGlyph },
    ],
  },
];

const SettingsFormPage = () => {
  const [selected, setSelected] = useState('profile');
  const [saved, setSaved] = useState(false);
  return (
    <G.WorkspaceShell
      header={
        <G.TopBar
          position="static"
          brand={<G.Link href="#home">Studio</G.Link>}
          actions={<G.Avatar name="Alex Morgan" size="sm" />}
        />
      }
      navigation={<G.Sidebar label="Settings sections" groups={settingsNav} selectedKey={selected} onAction={setSelected} />}
      navigationLabel="Settings"
      primaryLabel="Profile settings"
      primary={
        <G.PageContainer measure="reading">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 0 3rem' }}>
            <G.Breadcrumbs label="Breadcrumb" items={[{ id: 'settings', label: 'Settings', href: '#settings' }, { id: 'profile', label: 'Profile' }]} />
            <G.SectionHeader level={1} title="Profile" description="How you appear to other people in this workspace." />
            {saved ? <G.Alert tone="affirmative" title="Profile saved" dismissLabel="Dismiss" onDismiss={() => setSaved(false)} /> : null}
            <G.Form label="Profile settings" onSubmit={() => setSaved(true)}>
              <G.SurfaceCard label="Public profile">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <G.Input id="settings-name" name="name" label="Display name" defaultValue="Alex Morgan" isRequired />
                  <G.Input id="settings-email" name="email" label="Email" kind="email" defaultValue="alex@example.test" isError errorMessage="Verify this address before saving." />
                  <G.Textarea name="bio" label="Bio" description="A sentence or two." rows={3} defaultValue="Learning something new every week." />
                  <G.FileDropzone label="Photo" prompt="Drop an image or browse" accept="image/*" icon={<G.Icon source={UploadGlyph} usage="heading" />} />
                </div>
              </G.SurfaceCard>
              <G.SurfaceCard label="Preferences">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <G.Select name="language" label="Language" options={[{ id: 'en', label: 'English' }, { id: 'vi', label: 'Tiếng Việt' }, { id: 'fr', label: 'Français' }]} defaultValue="en" />
                  <G.SegmentedControl name="theme" label="Appearance" options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} defaultValue="system" />
                  <G.RadioGroup name="digest" label="Email digest" orientation="horizontal" options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'never', label: 'Never' }]} defaultValue="weekly" />
                  <G.Switch name="reminders" label="Study reminders" defaultSelected />
                  <G.TimeField name="reminderTime" label="Reminder time" isDisabled />
                </div>
              </G.SurfaceCard>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <G.Button type="reset" variant="ghost">Cancel</G.Button>
                <G.Button type="submit" variant="primary">Save changes</G.Button>
              </div>
            </G.Form>
            <G.SurfaceCard label="Danger zone" state="negative">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <G.Text tone="muted">Delete the account and every lesson record.</G.Text>
                <G.AlertDialog
                  tone="negative"
                  title="Delete your account?"
                  description="This cannot be undone."
                  confirmLabel="Delete account"
                  cancelLabel="Keep account"
                  onConfirm={noop}
                  trigger={<G.Button variant="outline">Delete account</G.Button>}
                />
              </div>
            </G.SurfaceCard>
          </div>
        </G.PageContainer>
      }
    />
  );
};

/* ------------------------------------------------------------------ data list page */

type Member = { readonly id: string; readonly name: string; readonly role: string; readonly status: string; readonly joined: string };
const ROLES = ['Owner', 'Editor', 'Viewer'] as const;
const STATUSES = ['Active', 'Invited', 'Suspended'] as const;
const NAMES = ['Alex Morgan', 'Sam Lee', 'Robin Park', 'Jordan Kim', 'Taylor Fox', 'Casey Wu', 'Riley Chen', 'Morgan Diaz', 'Avery Brooks', 'Quinn Patel', 'Jamie Ortiz', 'Drew Nguyen'];
const MEMBERS: ReadonlyArray<Member> = Array.from({ length: 36 }, (_, index) => ({
  id: `m${index + 1}`,
  name: `${NAMES[index % NAMES.length] ?? 'Member'} ${Math.floor(index / NAMES.length) + 1}`,
  role: ROLES[index % ROLES.length] ?? 'Viewer',
  status: STATUSES[index % 5 === 0 ? 1 : index % 7 === 0 ? 2 : 0] ?? 'Active',
  joined: `2026-0${(index % 9) + 1}-1${index % 10}`,
}));

const memberColumns: ReadonlyArray<G.DataTableColumn> = [
  { id: 'name', label: 'Name', isRowHeader: true, allowsSorting: true },
  { id: 'role', label: 'Role', allowsSorting: true },
  { id: 'status', label: 'Status' },
  { id: 'joined', label: 'Joined', align: 'end', allowsSorting: true },
];

const statusTone = (status: string): G.BadgeTone => (status === 'Active' ? 'success' : status === 'Invited' ? 'accent' : 'danger');

const PAGE_SIZE = 8;

const DataListPage = () => {
  const [query, setQuery] = useState('');
  const [roles, setRoles] = useState<ReadonlyArray<string>>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<G.DataTableSort>({ columnId: 'name', direction: 'ascending' });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = MEMBERS.filter(
    (member) => member.name.toLowerCase().includes(query.toLowerCase()) && (roles.length === 0 || roles.includes(member.role)),
  ).sort((a, b) => {
    const key = sort.columnId as keyof Member;
    const order = a[key].localeCompare(b[key]);
    return sort.direction === 'ascending' ? order : -order;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <G.WorkspaceShell
      header={<G.TopBar position="static" brand={<G.Link href="#home">Studio</G.Link>} actions={<G.Avatar name="Alex Morgan" size="sm" />} />}
      primaryLabel="Members"
      primary={
        <G.PageContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem 0 3rem' }}>
            <G.SectionHeader level={1} title="Members" description={`${filtered.length} people in this workspace.`} action={<G.Button variant="primary">Invite</G.Button>} />
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 16rem' }}>
                <G.SearchField label="Search members" isLabelHidden placeholder="Search by name" value={query} onValueChange={(value) => { setQuery(value); setPage(1); }} clearLabel="Clear search" />
              </div>
              <G.Drawer
                isOpen={drawerOpen}
                onOpenChange={setDrawerOpen}
                placement="right"
                title="Filter members"
                closeLabel="Close filters"
                trigger={<G.Button variant="secondary" startContent={<G.Icon source={FilterGlyph} usage="leading" />}>Filters{roles.length === 0 ? '' : ` (${roles.length})`}</G.Button>}
                footer={(close) => (
                  <>
                    <G.Button variant="ghost" onPress={() => { setRoles([]); setPage(1); }}>Clear</G.Button>
                    <G.Button variant="primary" onPress={close}>Show results</G.Button>
                  </>
                )}
              >
                <G.CheckboxGroup
                  label="Role"
                  options={ROLES.map((role) => ({ value: role, label: role }))}
                  value={roles}
                  onValueChange={(value) => { setRoles(value); setPage(1); }}
                />
              </G.Drawer>
            </div>
            {roles.length === 0 ? null : (
              <G.TagGroup
                label="Active filters"
                items={roles.map((role) => ({ id: role, label: role }))}
                onRemove={(ids) => setRoles((currentRoles) => currentRoles.filter((role) => !ids.includes(role)))}
                removeLabel={(label) => `Remove ${label} filter`}
              />
            )}
            <G.DataTable
              label="Members"
              columns={memberColumns}
              rows={rows}
              sort={sort}
              onSortChange={setSort}
              renderCell={(row, columnId) =>
                columnId === 'status' ? <G.Badge tone={statusTone(row.status)}>{row.status}</G.Badge> : row[columnId as keyof Member]
              }
              emptyContent={<G.EmptyNotice message="No members match." description="Try a different search or clear the filters." />}
            />
            <G.Pagination
              label="Member pages"
              page={current}
              pageCount={pageCount}
              onPageChange={setPage}
              previousLabel="Previous"
              nextLabel="Next"
              pageLabel={pageLabel}
              summary={`Showing ${rows.length} of ${filtered.length}`}
            />
          </div>
        </G.PageContainer>
      }
    />
  );
};

/* ------------------------------------------------------------------ mobile home */

const mobileQueue = G.createToastQueue();

const MobileHomePage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [current, setCurrent] = useState('home');
  const [queue] = useState(() => {
    mobileQueue.clear();
    mobileQueue.add({ title: 'Lesson saved for offline', tone: 'affirmative', timeout: 0, action: { label: 'Undo', onAction: noop } });
    return mobileQueue;
  });
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '5rem' }}>
      <G.TopBar
        position="sticky"
        brand={<G.Link href="#home">Studio</G.Link>}
        actions={<G.IconButton source={SearchGlyph} label="Search" onPress={noop} />}
        menu={{ icon: <G.Icon source={MenuGlyph} />, openLabel: 'Open menu', closeLabel: 'Close menu', isOpen: menuOpen, onOpenChange: setMenuOpen }}
      />
      <main aria-label="Home" style={{ flex: 1 }}>
        <G.PageContainer measure="reading">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem 0' }}>
            <G.SectionHeader composition="context-intro" level={1} title="Good morning" description="Three short lessons today." />
            <G.SurfaceCard label="Continue" fact="Lesson 4 of 12" wholeAction={{ kind: 'link', href: '#lesson-4', label: 'Continue Present simple' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <G.Image src={placeholderImage('Present simple')} alt="" aspect="wide" />
                <G.Heading level={2}>Present simple</G.Heading>
                <G.Progress label="Lesson progress" value={60} />
              </div>
            </G.SurfaceCard>
            <G.SurfaceCard label="This week" fact="3 of 5 days">
              <G.Meter label="Weekly goal" value={3} maxValue={5} valueLabel="3 of 5 days" tone="affirmative" />
            </G.SurfaceCard>
            <G.SurfaceListCard label="Up next">
              <G.StaticStateRow item={{ id: 'n1', label: 'Past continuous', description: '12 minutes', state: 'neutral' }} />
              <G.StaticStateRow item={{ id: 'n2', label: 'Conditionals', description: 'Locked', state: 'unavailable' }} />
            </G.SurfaceListCard>
          </div>
        </G.PageContainer>
      </main>
      <G.BottomNav
        label="Primary"
        visibility="always"
        currentId={current}
        onSelect={setCurrent}
        items={[
          { id: 'home', label: 'Home', icon: <G.Icon source={HomeGlyph} /> },
          { id: 'learn', label: 'Learn', icon: <G.Icon source={BookGlyph} /> },
          { id: 'alerts', label: 'Alerts', icon: <G.Icon source={BellGlyph} />, badge: '2', badgeLabel: '2 unread' },
          { id: 'profile', label: 'Profile', icon: <G.Icon source={UserGlyph} /> },
        ]}
      />
      <G.Toaster label="Notifications" dismissLabel="Dismiss notification" queue={queue} placement="top" />
    </div>
  );
};

/* ------------------------------------------------------------------ stories per family */

const mobile = { viewport: { value: 'mobile2', isRotated: false } };

export const CoreSettings: Story = { name: 'Core · Settings form', globals: { grammarFamily: 'core' }, render: () => <SettingsFormPage /> };
export const CoreDataList: Story = { name: 'Core · Data list with filter drawer', globals: { grammarFamily: 'core' }, render: () => <DataListPage /> };
export const CoreMobileHome: Story = { name: 'Core · Mobile home', globals: { grammarFamily: 'core', ...mobile }, render: () => <MobileHomePage /> };

export const HeritageSettings: Story = { name: 'Heritage · Settings form', globals: { grammarFamily: 'heritage' }, render: () => <SettingsFormPage /> };
export const HeritageDataList: Story = { name: 'Heritage · Data list with filter drawer', globals: { grammarFamily: 'heritage' }, render: () => <DataListPage /> };
export const HeritageMobileHome: Story = { name: 'Heritage · Mobile home', globals: { grammarFamily: 'heritage', ...mobile }, render: () => <MobileHomePage /> };

export const OffsetPopSettings: Story = { name: 'Offset Pop · Settings form', globals: { grammarFamily: 'offset-pop' }, render: () => <SettingsFormPage /> };
export const OffsetPopDataList: Story = { name: 'Offset Pop · Data list with filter drawer', globals: { grammarFamily: 'offset-pop' }, render: () => <DataListPage /> };
export const OffsetPopMobileHome: Story = { name: 'Offset Pop · Mobile home', globals: { grammarFamily: 'offset-pop', ...mobile }, render: () => <MobileHomePage /> };
