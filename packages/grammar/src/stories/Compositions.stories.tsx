import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import * as G from '../common/index.js';
import {
  BellGlyph,
  BookGlyph,
  ChartGlyph,
  HomeGlyph,
  MenuGlyph,
  SearchGlyph,
  SettingsGlyph,
  State,
  UserGlyph,
  noop,
} from './fixtures.js';

/**
 * Composition renderers: page shells, layout and application chrome. Each story shows the
 * renderer with its current/selected destination; page-level recipes live in `Compositions/Pages`.
 */
const meta: Meta = {
  title: 'Compositions/Renderers',
  parameters: { grammar: { bleed: true } },
};
export default meta;

type Story = StoryObj;

const Placeholder = ({ label, height = 120 }: { readonly label: string; readonly height?: number }) => (
  <G.SurfaceCard label={label}>
    <div style={{ minHeight: height }}><G.Text tone="muted">{label} content</G.Text></div>
  </G.SurfaceCard>
);

const links = (
  <>
    <G.Link href="#learn" isCurrent>Learn</G.Link>
    <G.Link href="#practice">Practice</G.Link>
    <G.Link href="#progress">Progress</G.Link>
  </>
);

/** TopBar's `navigation` slot takes the app's own `<nav>`. */
const inlineNav = <nav aria-label="Primary" style={{ display: 'flex', gap: '1rem' }}>{links}</nav>;

/** NavigationFeatureNav owns the `<nav>` landmark itself, so its slot takes bare links. */
const inlineLinks = <div style={{ display: 'flex', gap: '1rem' }}>{links}</div>;

export const PageContainer: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 0' }}>
      {(['reading', 'product', 'full'] as const).map((measure) => (
        <G.PageContainer key={measure} measure={measure}>
          <State label={`measure="${measure}"`} direction="column"><Placeholder label={`${measure} measure`} height={40} /></State>
        </G.PageContainer>
      ))}
    </div>
  ),
};

export const PrimaryRailLayout: Story = {
  render: () => (
    <G.PageContainer>
      <div style={{ padding: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <State label="Standard rail, primary first" direction="column">
          <G.PrimaryRailLayout primary={<Placeholder label="Primary" />} rail={<Placeholder label="Rail" />} />
        </State>
        <State label="Wide rail, stretched, rail first when collapsed" direction="column">
          <G.PrimaryRailLayout railWidth="wide" align="stretch" collapsedOrder="rail-first" primary={<Placeholder label="Primary" />} rail={<Placeholder label="Rail" />} />
        </State>
      </div>
    </G.PageContainer>
  ),
};

const TopBarDemo = ({ initialOpen }: { readonly initialOpen: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <G.TopBar
      position="static"
      brand={<G.Link href="#home">Studio</G.Link>}
      navigation={inlineNav}
      actions={<G.IconButton source={BellGlyph} label="Notifications" onPress={noop} />}
      menu={{ icon: <G.Icon source={MenuGlyph} />, openLabel: 'Open menu', closeLabel: 'Close menu', isOpen: open, onOpenChange: setOpen, visibility: 'always' }}
    />
  );
};

export const TopBar: Story = {
  name: 'TopBar (current destination, menu closed)',
  render: () => <TopBarDemo initialOpen={false} />,
};

export const TopBarMenuOpen: Story = {
  name: 'TopBar (menu open)',
  render: () => <TopBarDemo initialOpen />,
};

const bottomItems: ReadonlyArray<G.BottomNavItem> = [
  { id: 'home', label: 'Home', icon: <G.Icon source={HomeGlyph} />, href: '#home' },
  { id: 'learn', label: 'Learn', icon: <G.Icon source={BookGlyph} />, href: '#learn' },
  { id: 'alerts', label: 'Alerts', icon: <G.Icon source={BellGlyph} />, badge: '3', badgeLabel: '3 unread' },
  { id: 'profile', label: 'Profile', icon: <G.Icon source={UserGlyph} />, isDisabled: true },
];

const BottomNavDemo = ({ label }: { readonly label: string }) => {
  const [current, setCurrent] = useState('home');
  return <G.BottomNav label={label} items={bottomItems} currentId={current} onSelect={setCurrent} position="static" visibility="always" />;
};

export const BottomNav: Story = {
  render: () => (
    <div style={{ maxWidth: 420, padding: '1.5rem' }}>
      <State label="Current item, badge and a disabled item" direction="column"><BottomNavDemo label="Primary" /></State>
    </div>
  ),
};

export const Footer: Story = {
  render: () => (
    <G.Footer
      label="Site"
      brand={<G.Text weight="semibold">Studio</G.Text>}
      externalHint="(opens in a new tab)"
      groups={[
        { id: 'product', label: 'Product', links: [{ id: 'features', label: 'Features', href: '#features', isCurrent: true }, { id: 'pricing', label: 'Pricing', href: '#pricing' }] },
        { id: 'support', label: 'Support', links: [{ id: 'help', label: 'Help centre', href: '#help' }, { id: 'status', label: 'Status', href: 'https://status.example.com', kind: 'external' }] },
      ]}
      legal={<G.Text size="xs" tone="muted">© 2026 Studio. All rights reserved.</G.Text>}
    />
  ),
};

export const NavigationFeatureNav: Story = {
  render: () => (
    <G.NavigationFeatureNav
      identity={<strong>Studio</strong>}
      navigation={inlineLinks}
      navigationLabel="Primary"
      compactNavigationTrigger={<G.IconButton source={MenuGlyph} label="Open navigation" />}
      compactNavigationTriggerLabel="Open navigation"
      actions={<G.Avatar name="Alex Morgan" size="sm" />}
      actionsLabel="Account"
      featureNavigation={<G.TextAction href="#new" appearance="route">What is new</G.TextAction>}
      featureNavigationLabel="Features"
      position="static"
    />
  ),
};

const sidebarGroups: ReadonlyArray<G.SidebarGroup> = [
  {
    id: 'main',
    items: [
      { id: 'home', label: 'Home', source: HomeGlyph },
      { id: 'lessons', label: 'Lessons', source: BookGlyph, trailing: <G.Badge>12</G.Badge> },
      { id: 'progress', label: 'Progress', source: ChartGlyph },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'settings', label: 'Settings', source: SettingsGlyph },
      { id: 'billing', label: 'Billing', source: UserGlyph, isDisabled: true },
    ],
  },
];

const SidebarDemo = ({ initialCollapsed }: { readonly initialCollapsed: boolean }) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [selected, setSelected] = useState('lessons');
  return (
    <div style={{ height: 420, display: 'flex' }}>
      <G.Sidebar
        label={initialCollapsed ? 'Workspace (collapsed)' : 'Workspace'}
        groups={sidebarGroups}
        selectedKey={selected}
        onAction={setSelected}
        isCollapsed={collapsed}
        onCollapsedChange={setCollapsed}
        collapseLabel="Collapse sidebar"
        expandLabel="Expand sidebar"
        toggleSource={MenuGlyph}
        header={<G.Text weight="semibold">Studio</G.Text>}
        footer={<G.Avatar name="Alex Morgan" size="sm" />}
      />
    </div>
  );
};

export const Sidebar: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '2rem', padding: '1.5rem' }}>
      <State label="Expanded, selected item, disabled item" direction="column"><SidebarDemo initialCollapsed={false} /></State>
      <State label="Collapsed" direction="column"><SidebarDemo initialCollapsed /></State>
    </div>
  ),
};

export const WorkspaceShell: Story = {
  render: () => (
    <G.WorkspaceShell
      header={
        <G.TopBar
          position="static"
          brand={<G.Link href="#home">Studio</G.Link>}
          actions={<G.IconButton source={SearchGlyph} label="Search" onPress={noop} />}
        />
      }
      navigation={<SidebarDemo initialCollapsed={false} />}
      navigationLabel="Workspace navigation"
      rail={<Placeholder label="Details" />}
      railLabel="Details"
      primaryLabel="Lessons"
      primary={
        <G.PageContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem 0' }}>
            <G.SectionHeader title="Lessons" description="Everything in this workspace." level={1} />
            <Placeholder label="Primary" height={240} />
          </div>
        </G.PageContainer>
      }
    />
  ),
};

const ChatDemo = () => {
  const [railOpen, setRailOpen] = useState(false);
  return (
    <div style={{ height: '36rem', display: 'flex' }}>
      <G.ChatWorkspace
        label="Tutor chat"
        header={<G.Text weight="semibold">Tutor chat</G.Text>}
        conversationLabel="Messages"
        conversation={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
            <G.SurfaceCard ariaLabel="Tutor message" depth="nested"><G.Text>Try the sentence again with “an”.</G.Text></G.SurfaceCard>
            <G.SurfaceCard ariaLabel="Your message" depth="nested" isHighlight><G.Text>An hour ago, I finished it.</G.Text></G.SurfaceCard>
          </div>
        }
        composer={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', padding: '1rem' }}>
            <div style={{ flex: 1 }}><G.Textarea label="Message" isLabelHidden rows={1} placeholder="Write a reply" /></div>
            <G.Button variant="primary">Send</G.Button>
          </div>
        }
        rail={<Placeholder label="Lesson notes" />}
        railLabel="Lesson notes"
        railOpenLabel="Show lesson notes"
        railCloseLabel="Hide lesson notes"
        isRailOpen={railOpen}
        onRailOpenChange={setRailOpen}
      />
    </div>
  );
};

export const ChatWorkspace: Story = {
  render: () => <ChatDemo />,
};
