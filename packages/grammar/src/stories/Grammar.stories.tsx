import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import {
  Badge,
  Button,
  Divider,
  EmptyNotice,
  Heading,
  Input,
  Label,
  NavigationFeatureNav,
  PageContainer,
  SectionHeader,
  StaticStateRow,
  SurfaceCard,
  SurfaceListCard,
  Text,
  TextAction,
  WorkspaceShell,
} from '../common/index.js';
// @ts-expect-error - asset import for the storybook render only
import turtleUrl from './assets/turtle.png';

/**
 * Reference renders of the shipped Common anatomy in the `core` family,
 * composed into the screen shapes the todo directions target. Direction
 * generation cites these pixels as the anatomy source — component look is
 * never invented from a name.
 */

const meta: Meta = {
  title: 'Grammar/Core anatomy',
  // Pinned to Core with the consumer accent these reference renders were captured with.
  globals: { grammarFamily: 'core' },
  parameters: {
    layout: 'fullscreen',
    grammar: { bleed: true, rootStyle: { ['--starci-core-accent' as string]: '#2F6BFF' } },
  },
};
export default meta;

type Story = StoryObj;

// NavigationFeatureNav owns the `<nav aria-label="Primary">` landmark; the slot takes bare links.
const navDestinations = (
  <div style={{ display: 'flex', gap: '1.5rem' }}>
    <a href="#" aria-current="page">Tasks</a>
    <a href="#">Notifications</a>
    <a href="#">Plan</a>
    <a href="#">Privacy</a>
  </div>
);

const topNav = (
  <NavigationFeatureNav
    identity={<strong>Todo app</strong>}
    navigation={navDestinations}
    navigationLabel="Primary"
    compactNavigationTrigger={<button type="button">Menu</button>}
    compactNavigationTriggerLabel="Open navigation"
    actions={
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span aria-hidden="true">A</span>
        <span>Alex</span>
        <TextAction href="#">Sign out</TextAction>
      </div>
    }
    actionsLabel="Account"
  />
);

const pageFooter = (
  <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem 0', color: 'var(--muted, #555)' }}>
    <TextAction href="#">Privacy policy</TextAction>
    <TextAction href="#">Terms</TextAction>
  </div>
);

/** Full auth composition: brand illustration left, form card right — the split the brand record rules. */
export const SignInScreen: Story = {
  name: 'Sign-in (split-screen composition)',
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
      <section
        aria-label="About Todo app"
        style={{
          background: 'var(--surface-secondary, #f3f4f6)',
          display: 'flex',
          flexDirection: 'column',
          padding: '3rem',
          gap: '1.5rem',
        }}
      >
        <strong>Todo app</strong>
        <div>
          <Heading level={1}>A steady start.</Heading>
          <Text tone="muted">One task at a time.</Text>
        </div>
        <img src={turtleUrl} alt="Todo app turtle mascot" style={{ maxWidth: 420, marginTop: 'auto' }} />
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ maxWidth: 400, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <Heading level={1}>Welcome back</Heading>
            <Text tone="muted">Sign in to keep your tasks moving.</Text>
          </div>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input id="email" name="email" label="Email" kind="email" variant="secondary" defaultValue="alex@example.test" />
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                <TextAction href="#">Forgot password?</TextAction>
              </div>
              <Input id="password" name="password" label="Password" kind="password" variant="secondary" placeholder="Enter your password" />
            </div>
            <Text live="assertive">We couldn&apos;t sign you in. Check your email and password.</Text>
            <Button type="submit" variant="primary" width="fill">Sign in</Button>
            <Text>New here? <TextAction href="#">Create an account</TextAction></Text>
          </form>
          <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
            <TextAction href="#">Privacy policy</TextAction>
            <TextAction href="#">Terms of service</TextAction>
          </div>
        </div>
      </section>
    </div>
  ),
};

const taskRow = (title: string, done: boolean) => (
  <li key={title} className="starci-core-static-row" data-grammar-row="true" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
    <input type="checkbox" defaultChecked={done} aria-label={`Complete ${title}`} />
    <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>{title}</span>
    <TextAction href="#">Share</TextAction>
    <TextAction href="#">Schedule</TextAction>
    <Button variant="outline" size="sm">Delete</Button>
  </li>
);

/** Full tasks screen: shell + composer card + collection card — the anatomy the direction maps. */
export const TasksScreen: Story = {
  name: 'Tasks (shell + composer + SurfaceListCard)',
  render: () => (
    <WorkspaceShell
      header={topNav}
      primaryLabel="Tasks"
      primary={
        <PageContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <Heading level={1}>Your tasks</Heading>
              <Text tone="muted">A little progress, every day.</Text>
            </div>
            <SurfaceCard ariaLabel="New task">
              <form style={{ display: 'flex', gap: '0.75rem', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <Input id="new-task" name="title" label="New task" variant="secondary" placeholder="What needs doing?" />
                </div>
                <Button type="submit" variant="primary">Add task</Button>
              </form>
            </SurfaceCard>
            <SurfaceListCard
              label="All tasks"
              fact="4 tasks"
              footer={<Text tone="muted">Completed tasks stay here until you delete them.</Text>}
            >
              {taskRow('Plan the week', false)}
              {taskRow('Send the project update', false)}
              {taskRow('Book the bike repair', false)}
              {taskRow('Water the plants', true)}
            </SurfaceListCard>
            {pageFooter}
          </div>
        </PageContainer>
      }
    />
  ),
};

/** Primitive inventory — the palette/type/action atoms every direction region maps to. */
export const Primitives: Story = {
  name: 'Primitives (button, input, text, action)',
  render: () => (
    <PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" isPending>Pending</Button>
          <Button variant="primary" isDisabled>Disabled</Button>
        </div>
        <Divider label="or" />
        <Input id="i1" name="a" label="Email" kind="email" variant="primary" placeholder="you@example.com" />
        <Input id="i2" name="b" label="On a surface — secondary" kind="text" variant="secondary" placeholder="secondary field" />
        <Input id="i3" name="c" label="With error" variant="secondary" isError errorMessage="This value is not accepted." defaultValue="bad input" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Heading level={2}>Heading</Heading>
          <Text>Default body text.</Text>
          <Text tone="muted">Muted supporting text.</Text>
          <Text><TextAction href="#">TextAction link</TextAction> beside copy.</Text>
          <Label>Label primitive</Label>
          <Badge>Badge</Badge>
        </div>
      </div>
    </PageContainer>
  ),
};

export const EmptyState: Story = {
  name: 'EmptyNotice (no tasks)',
  render: () => (
    <WorkspaceShell
      header={topNav}
      primaryLabel="Tasks"
      primary={
        <PageContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <Heading level={1}>Your tasks</Heading>
              <Text tone="muted">A little progress, every day.</Text>
            </div>
            <SurfaceListCard label="All tasks" fact="0 tasks">
              <EmptyNotice message="No tasks yet." description="Add the first one above." />
            </SurfaceListCard>
          </div>
        </PageContainer>
      }
    />
  ),
};
