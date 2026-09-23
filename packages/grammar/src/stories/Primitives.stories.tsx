import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import * as G from '../common/index.js';
import {
  BellGlyph,
  BookGlyph,
  ChartGlyph,
  Matrix,
  SearchGlyph,
  SettingsGlyph,
  StarGlyph,
  State,
  familyScope,
  noop,
  placeholderImage,
} from './fixtures.js';

/**
 * Primitives: the atoms every family restyles. Each story renders one Common renderer in its
 * relevant states (default, disabled, invalid, pending, selected/current, skeleton) inside the
 * family root chosen in the toolbar.
 */
const meta: Meta = {
  title: 'Primitives',
};
export default meta;

type Story = StoryObj;

export const Badge: Story = {
  render: () => (
    <Matrix>
      <State label="Tones">
        <G.Badge>Neutral</G.Badge>
        <G.Badge tone="accent">Accent</G.Badge>
        <G.Badge tone="success">Success</G.Badge>
        <G.Badge tone="warning">Warning</G.Badge>
        <G.Badge tone="danger">Danger</G.Badge>
      </State>
      <State label="With leading content">
        <G.Badge tone="accent" startContent={<G.Icon source={StarGlyph} usage="chip" />}>Featured</G.Badge>
      </State>
      <State label="Skeleton (pending)">
        <G.Badge isSkeleton>Loading</G.Badge>
      </State>
    </Matrix>
  ),
};

export const Button: Story = {
  render: () => (
    <Matrix>
      <State label="Variants">
        <G.Button variant="primary">Primary</G.Button>
        <G.Button variant="secondary">Secondary</G.Button>
        <G.Button variant="tertiary">Tertiary</G.Button>
        <G.Button variant="outline">Outline</G.Button>
        <G.Button variant="ghost">Ghost</G.Button>
      </State>
      <State label="Sizes">
        <G.Button size="sm">Small</G.Button>
        <G.Button size="md">Medium</G.Button>
        <G.Button size="lg">Large</G.Button>
      </State>
      <State label="Disabled">
        <G.Button variant="primary" isDisabled>Primary</G.Button>
        <G.Button variant="secondary" isDisabled>Secondary</G.Button>
        <G.Button variant="outline" isDisabled>Outline</G.Button>
      </State>
      <State label="Pending">
        <G.Button variant="primary" isPending>Saving</G.Button>
        <G.Button variant="secondary" isPending>Loading</G.Button>
      </State>
      <State label="Skeleton">
        <G.Button isSkeleton>Loading</G.Button>
      </State>
      <State label="With icons, destination and fill width" direction="column">
        <G.Button variant="secondary" startContent={<G.Icon source={SearchGlyph} usage="leading" />}>Search</G.Button>
        <G.Button href="#destination" variant="outline">Destination link</G.Button>
        <G.Button variant="primary" width="fill">Full width</G.Button>
      </State>
    </Matrix>
  ),
};

export const Divider: Story = {
  render: () => (
    <Matrix maxWidth={480}>
      <State label="Labelled divider" direction="column">
        <G.Divider label="or" />
        <G.Divider label="Continue with" />
      </State>
    </Matrix>
  ),
};

export const Heading: Story = {
  render: () => (
    <Matrix>
      <State label="Levels" direction="column">
        <G.Heading level={1}>Heading level 1</G.Heading>
        <G.Heading level={2}>Heading level 2</G.Heading>
        <G.Heading level={3}>Heading level 3</G.Heading>
        <G.Heading level={4}>Heading level 4</G.Heading>
      </State>
      <State label="Display scale" direction="column">
        <G.Heading level={2} scale="display">Display heading</G.Heading>
      </State>
      <State label="Skeleton and visually hidden" direction="column">
        <G.Heading level={3} isSkeleton>Loading heading</G.Heading>
        <G.Heading level={3} isVisuallyHidden>Only announced to assistive technology</G.Heading>
      </State>
    </Matrix>
  ),
};

export const Icon: Story = {
  render: () => (
    <Matrix>
      <State label="Usages (decorative)">
        <G.Icon source={SearchGlyph} usage="heading" />
        <G.Icon source={SearchGlyph} usage="leading" />
        <G.Icon source={SearchGlyph} usage="chip" />
      </State>
      <State label="Meaningful (labelled)">
        <G.Icon source={BellGlyph} ariaLabel="Notifications" usage="leading" />
      </State>
      <State label="Skeleton">
        <G.Icon source={SearchGlyph} isSkeleton />
      </State>
    </Matrix>
  ),
};

export const IconButton: Story = {
  render: () => (
    <Matrix>
      <State label="Default">
        <G.IconButton source={SearchGlyph} label="Search" onPress={noop} />
        <G.IconButton source={SettingsGlyph} label="Settings" onPress={noop} />
      </State>
      <State label="Active (selected)">
        <G.IconButton source={BellGlyph} label="Notifications" isActive onPress={noop} />
      </State>
      <State label="Disabled">
        <G.IconButton source={SearchGlyph} label="Search unavailable" isDisabled />
      </State>
      <State label="Skeleton">
        <G.IconButton source={SearchGlyph} label="Loading" isSkeleton />
      </State>
    </Matrix>
  ),
};

export const IconTile: Story = {
  render: () => (
    <Matrix>
      <State label="Tones">
        <G.IconTile source={BookGlyph} />
        <G.IconTile source={BookGlyph} tone="accent" />
        <G.IconTile source={ChartGlyph} tone="success" />
        <G.IconTile source={BellGlyph} tone="warning" />
        <G.IconTile source={SettingsGlyph} tone="danger" ariaLabel="Needs attention" />
      </State>
      <State label="Sizes">
        <G.IconTile source={StarGlyph} size="sm" tone="accent" />
        <G.IconTile source={StarGlyph} size="md" tone="accent" />
      </State>
      <State label="Skeleton">
        <G.IconTile source={StarGlyph} isSkeleton />
      </State>
    </Matrix>
  ),
};

export const IncludedMark: Story = {
  render: () => (
    <Matrix>
      <State label="Decorative and labelled">
        <G.IncludedMark />
        <G.IncludedMark label="Included" />
        <G.Text startContent={<G.IncludedMark />}>Offline access</G.Text>
      </State>
    </Matrix>
  ),
};

export const Label: Story = {
  render: () => (
    <Matrix>
      <State label="Depths" direction="column">
        <G.Label>Top-level label</G.Label>
        <G.Label depth="nested">Nested label</G.Label>
        <G.Label as="h3">Label as heading</G.Label>
      </State>
    </Matrix>
  ),
};

export const LeadingNumber: Story = {
  render: () => (
    <Matrix>
      <State label="Positions">
        <G.LeadingNumber position={1} />
        <G.LeadingNumber position={2} />
        <G.LeadingNumber position={12} />
      </State>
    </Matrix>
  ),
};

export const Progress: Story = {
  render: () => (
    <Matrix maxWidth={420}>
      <State label="Determinate" direction="column">
        <G.Progress label="Upload" value={0} />
        <G.Progress label="Course progress" value={45} />
        <G.Progress label="Complete" value={100} />
      </State>
      <State label="Indeterminate (pending)" direction="column">
        <G.Progress label="Preparing" />
      </State>
      <State label="Skeleton" direction="column">
        <G.Progress label="Loading" isSkeleton />
      </State>
    </Matrix>
  ),
};

export const RankArtwork: Story = {
  render: () => (
    <Matrix>
      <State label="Kinds">
        <G.RankArtwork kind="first" label="First place" width={48} height={48} />
        <G.RankArtwork kind="second" label="Second place" width={48} height={48} />
        <G.RankArtwork kind="third" label="Third place" width={48} height={48} />
        <G.RankArtwork kind="cup" label="Trophy" width={48} height={48} />
      </State>
    </Matrix>
  ),
};

export const StateMark: Story = {
  render: () => (
    <Matrix>
      <State label="Presentation states">
        {G.PRESENTATION_STATES.map((state) => (
          <span key={state} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <G.StateMark state={state} />
            <G.Text size="sm">{state}</G.Text>
          </span>
        ))}
      </State>
    </Matrix>
  ),
};

export const Text: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Tones" direction="column">
        <G.Text>Default body text.</G.Text>
        <G.Text tone="muted">Muted supporting text.</G.Text>
        <G.Text tone="accent">Accent text.</G.Text>
      </State>
      <State label="Sizes and weights" direction="column">
        <G.Text size="xs">Extra small</G.Text>
        <G.Text size="sm" weight="medium">Small medium</G.Text>
        <G.Text size="md" weight="semibold">Medium semibold</G.Text>
        <G.Text size="metric-lead" weight="semibold">1,284</G.Text>
      </State>
      <State label="Overflow" direction="column">
        <G.Text overflow="truncate">A long sentence that is truncated to a single line when it runs out of room in its container.</G.Text>
        <G.Text overflow="clamp-2">A long paragraph clamped to two lines. It keeps going so that the clamp has something to cut, and it keeps going a little further still to be sure.</G.Text>
      </State>
      <State label="Superseded, live and skeleton" direction="column">
        <G.Text isSuperseded>Superseded value</G.Text>
        <G.Text live="polite">Saved just now.</G.Text>
        <G.Text isSkeleton>Loading text</G.Text>
      </State>
    </Matrix>
  ),
};

export const TextAction: Story = {
  render: () => (
    <Matrix>
      <State label="Appearances">
        <G.TextAction href="#inline">Inline</G.TextAction>
        <G.TextAction href="#muted" appearance="muted">Muted</G.TextAction>
        <G.TextAction onPress={noop} appearance="choice">Choice</G.TextAction>
        <G.TextAction href="#route" appearance="route">Route</G.TextAction>
        <G.TextAction onPress={noop} appearance="disclosure">Disclosure</G.TextAction>
      </State>
      <State label="Current (selected)">
        <G.TextAction href="#route" appearance="route" isCurrent>Current route</G.TextAction>
        <G.TextAction onPress={noop} appearance="choice" isCurrent>Selected choice</G.TextAction>
      </State>
      <State label="Disabled">
        <G.TextAction onPress={noop} isDisabled>Unavailable</G.TextAction>
      </State>
      <State label="Pending">
        <G.TextAction onPress={noop} isPending>Refreshing</G.TextAction>
      </State>
      <State label="Skeleton">
        <G.TextAction href="#loading" isSkeleton>Loading</G.TextAction>
      </State>
    </Matrix>
  ),
};

export const Link: Story = {
  render: () => (
    <Matrix>
      <State label="Kinds">
        <G.Link href="#internal">Internal link</G.Link>
        <G.Link href="https://example.com" kind="external" externalHint="(opens in a new tab)">External link</G.Link>
      </State>
      <State label="Current">
        <G.Link href="#current" isCurrent>Current page</G.Link>
      </State>
      <State label="Disabled">
        <G.Link href="#disabled" isDisabled>Unavailable link</G.Link>
      </State>
      <State label="Uniform visited styling">
        <G.Link href="#uniform" visited="uniform">Uniform link</G.Link>
      </State>
    </Matrix>
  ),
};

export const Avatar: Story = {
  render: () => (
    <Matrix>
      <State label="Initials fallback and image">
        <G.Avatar name="Alex Morgan" />
        <G.Avatar name="Sam Lee" src={placeholderImage('S', 200)} />
      </State>
      <State label="Sizes">
        <G.Avatar name="Robin Park" size="sm" />
        <G.Avatar name="Robin Park" size="md" />
        <G.Avatar name="Robin Park" size="lg" />
      </State>
      <State label="Current (selected)">
        <G.Avatar name="Jordan Kim" isCurrent />
      </State>
      <State label="Decorative">
        <G.Avatar name="Taylor Fox" isDecorative />
        <G.Text>Taylor Fox</G.Text>
      </State>
    </Matrix>
  ),
};

export const Image: Story = {
  render: () => (
    <Matrix>
      <State label="Aspects">
        <div style={{ width: 200 }}><G.Image src={placeholderImage('Landscape')} alt="Landscape placeholder artwork" aspect="landscape" /></div>
        <div style={{ width: 140 }}><G.Image src={placeholderImage('Square', 160)} alt="Square placeholder artwork" aspect="square" /></div>
        <div style={{ width: 120 }}><G.Image src={placeholderImage('Portrait', 40)} alt="Portrait placeholder artwork" aspect="portrait" fit="contain" /></div>
      </State>
      <State label="Error (invalid source) with fallback">
        <div style={{ width: 200 }}>
          <G.Image src="/missing-story-image.png" alt="Missing artwork" aspect="landscape" fallback={<G.Text tone="muted">Image unavailable</G.Text>} />
        </div>
      </State>
    </Matrix>
  ),
};

export const Kbd: Story = {
  render: () => (
    <Matrix>
      <State label="Chords">
        <G.Kbd keys={['command', 'K']} />
        <G.Kbd keys={['ctrl', 'shift', 'P']} />
        <G.Kbd keys={['escape']} />
        <G.Kbd keys={['enter']} />
      </State>
    </Matrix>
  ),
};

export const CloseButton: Story = {
  render: () => (
    <Matrix>
      <State label="Sizes">
        <G.CloseButton label="Close" size="sm" onPress={noop} />
        <G.CloseButton label="Close" size="md" onPress={noop} />
      </State>
      <State label="Disabled">
        <G.CloseButton label="Close" isDisabled />
      </State>
    </Matrix>
  ),
};

export const Spinner: Story = {
  render: () => (
    <Matrix>
      <State label="Sizes (pending)">
        <G.Spinner label="Loading" size="sm" />
        <G.Spinner label="Loading" size="md" />
        <G.Spinner label="Loading" size="lg" />
      </State>
      <State label="Current colour">
        <G.Text tone="muted" startContent={<G.Spinner label="Syncing" tone="current" size="sm" />}>Syncing</G.Text>
      </State>
    </Matrix>
  ),
};

export const Skeleton: Story = {
  render: () => (
    <Matrix maxWidth={420}>
      <State label="Text lines" direction="column">
        <G.Skeleton shape="text" lines={3} />
      </State>
      <State label="Rect ratios">
        <div style={{ width: 120 }}><G.Skeleton shape="rect" ratio="square" /></div>
        <div style={{ width: 160 }}><G.Skeleton shape="rect" ratio="landscape" /></div>
        <div style={{ width: 200 }}><G.Skeleton shape="rect" ratio="wide" /></div>
      </State>
      <State label="Circles">
        <G.Skeleton shape="circle" size="sm" />
        <G.Skeleton shape="circle" size="md" />
        <G.Skeleton shape="circle" size="lg" />
      </State>
    </Matrix>
  ),
};

export const Meter: Story = {
  render: () => (
    <Matrix maxWidth={420}>
      <State label="Tones" direction="column">
        <G.Meter label="Storage" value={32} tone="neutral" />
        <G.Meter label="Goal" value={80} tone="affirmative" valueLabel="8 of 10 lessons" />
        <G.Meter label="Quota" value={72} tone="cautionary" />
        <G.Meter label="Errors" value={95} tone="negative" />
        <G.Meter label="Sync" value={50} tone="pending" />
      </State>
      <State label="Hidden label" direction="column">
        <G.Meter label="Battery" value={64} isLabelHidden />
      </State>
    </Matrix>
  ),
};

export const ProgressCircle: Story = {
  render: () => (
    <Matrix>
      <State label="Determinate">
        <G.ProgressCircle label="Lesson" value={25} size="sm" />
        <G.ProgressCircle label="Lesson" value={60} size="md" />
        <G.ProgressCircle label="Lesson" value={100} size="lg" />
      </State>
      <State label="Indeterminate (pending)">
        <G.ProgressCircle label="Loading" isIndeterminate />
      </State>
    </Matrix>
  ),
};

export const GrammarRoot: Story = {
  render: (_args, { globals }) => {
    const scope = familyScope(globals);
    return (
      <Matrix>
        <State label="Nested explicit themes in the toolbar family (the outer root comes from the toolbar)">
          {(['light', 'dark', 'system'] as const).map((theme) => (
            <G.GrammarRoot key={theme} theme={theme} {...scope} style={{ padding: '1rem', borderRadius: '0.75rem', minWidth: 160 }}>
              <G.Text weight="semibold">{theme} scope</G.Text>
              <G.Text tone="muted" size="sm">Tokens resolve here.</G.Text>
              <div style={{ marginTop: '0.5rem' }}><G.Button size="sm">Action</G.Button></div>
            </G.GrammarRoot>
          ))}
        </State>
      </Matrix>
    );
  },
};
