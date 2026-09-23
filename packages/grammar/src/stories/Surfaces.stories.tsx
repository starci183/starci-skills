import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';
import * as G from '../common/index.js';
import { BookGlyph, Matrix, PlusGlyph, State, noop, placeholderImage } from './fixtures.js';

/**
 * Surfaces: cards, collections, reading frames and scroll regions — the containers every family
 * gives its material treatment (Offset Pop's ink outline and hard offset shadow, Heritage's paper, …).
 */
const meta: Meta = {
  title: 'Surfaces',
};
export default meta;

type Story = StoryObj;

export const SurfaceCard: Story = {
  render: () => (
    <Matrix maxWidth={640}>
      <State label="Labelled with a fact" direction="column">
        <G.SurfaceCard label="This week" fact="3 lessons">
          <G.Text>Keep the streak going with one short lesson a day.</G.Text>
        </G.SurfaceCard>
      </State>
      <State label="Whole-card action (link) and highlight (selected)" direction="column">
        <G.SurfaceCard ariaLabel="Grammar basics" wholeAction={{ kind: 'link', href: '#course', label: 'Open Grammar basics' }}>
          <G.Heading level={3}>Grammar basics</G.Heading>
          <G.Text tone="muted">12 lessons</G.Text>
        </G.SurfaceCard>
        <G.SurfaceCard label="Recommended" isHighlight>
          <G.Text>Highlighted surface.</G.Text>
        </G.SurfaceCard>
      </State>
      <State label="States" direction="column">
        <G.SurfaceCard label="Pending" state="pending"><G.Text>Syncing…</G.Text></G.SurfaceCard>
        <G.SurfaceCard label="Unavailable (disabled)" state="unavailable"><G.Text>Not included in your plan.</G.Text></G.SurfaceCard>
        <G.SurfaceCard label="Negative (invalid)" state="negative"><G.Text>The import failed.</G.Text></G.SurfaceCard>
      </State>
      <State label="Nested and frameless" direction="column">
        <G.SurfaceCard label="Outer">
          <G.SurfaceCard label="Nested" depth="nested"><G.Text>Nested depth.</G.Text></G.SurfaceCard>
        </G.SurfaceCard>
        <G.SurfaceCard ariaLabel="Frameless" frame="frameless"><G.Text>Frameless surface.</G.Text></G.SurfaceCard>
      </State>
    </Matrix>
  ),
};

export const SurfaceListCard: Story = {
  render: () => (
    <Matrix maxWidth={640}>
      <State label="Rows with states" direction="column">
        <G.SurfaceListCard label="Checks" fact="4 items" footer={<G.Text tone="muted" size="sm">Updated just now.</G.Text>}>
          <G.StaticStateRow item={{ id: 'a', label: 'Email verified', state: 'affirmative' }} />
          <G.StaticStateRow item={{ id: 'b', label: 'Payment method', description: 'Expires soon', state: 'cautionary' }} />
          <G.StaticStateRow item={{ id: 'c', label: 'Two-factor', state: 'negative' }} />
          <G.StaticStateRow item={{ id: 'd', label: 'Backup', state: 'pending' }} />
        </G.SurfaceListCard>
      </State>
      <State label="Verdict collection" direction="column">
        <G.SurfaceListCard label="Movement" isVerdict>
          <G.StaticStateRow item={{ id: 'up', label: 'Ada', verdict: 'success' }} />
          <G.StaticStateRow item={{ id: 'down', label: 'Grace', verdict: 'danger' }} />
        </G.SurfaceListCard>
      </State>
      <State label="Loading (pending)" direction="column">
        <G.SurfaceListCard label="Loading" isLoading>
          <G.StaticStateRow item={{ id: 'l', label: 'Loading row', state: 'pending' }} />
        </G.SurfaceListCard>
      </State>
      <State label="Empty (notice, not a list)" direction="column">
        <G.SurfaceListCard label="Saved" empty={<G.EmptyNotice message="Nothing saved yet." description="Saved lessons appear here." />} />
      </State>
      <State label="Contained scroll (focusable list)" direction="column">
        <div style={{ height: 160, display: 'flex', flexDirection: 'column' }}>
          <G.SurfaceListCard label="History" isScrollable>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <G.StaticStateRow key={day} item={{ id: day, label: day, description: 'One lesson', state: 'affirmative' }} />
            ))}
          </G.SurfaceListCard>
        </div>
      </State>
    </Matrix>
  ),
};

const StaticRows = () => (
  <G.SurfaceListCard ariaLabel="Every presentation state" labelHidden>
    {G.PRESENTATION_STATES.map((state) => (
      <G.StaticStateRow key={state} item={{ id: state, label: state, description: `A ${state} row` , state }} />
    ))}
  </G.SurfaceListCard>
);

export const StaticStateRow: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Every presentation state" direction="column"><StaticRows /></State>
    </Matrix>
  ),
};

type Summary = { readonly title: string; readonly meta: string };

const AccordionCardDemo = () => {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(['week-1']));
  const weeks = [
    { id: 'week-1', summary: { title: 'Week 1', meta: '3 lessons' }, body: 'Articles, plurals and pronouns.' },
    { id: 'week-2', summary: { title: 'Week 2', meta: '4 lessons' }, body: 'Present tenses.' },
    { id: 'week-3', summary: { title: 'Week 3', meta: 'Locked' }, body: 'Past tenses.', isDisabled: true },
  ];
  return (
    <G.SurfaceAccordionCard<Summary, string>
      label="Course outline"
      items={weeks.map((week) => ({
        id: week.id,
        isOpen: open.has(week.id),
        isDisabled: week.isDisabled === true,
        summaryRender: week.summary,
        bodyRender: week.body,
      }))}
      onItemOpenChange={(id, isOpen) =>
        setOpen((current) => {
          const next = new Set(current);
          if (isOpen) next.add(id);
          else next.delete(id);
          return next;
        })
      }
      renderSummary={(summary) => (
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
          <span>{summary.title}</span>
          <G.Text as="span" tone="muted" size="sm">{summary.meta}</G.Text>
        </span>
      )}
      renderBody={(body) => <G.Text>{body}</G.Text>}
    />
  );
};

const SingleAccordionDemo = () => {
  const [isOpen, setOpen] = useState(false);
  return (
    <G.SurfaceAccordionCard<string, string>
      ariaLabel="Refund policy"
      isOpen={isOpen}
      onOpenChange={setOpen}
      summaryRender="Refund policy"
      bodyRender="Refunds are available within 14 days."
      renderSummary={(summary) => summary}
      renderBody={(body) => <G.Text>{body}</G.Text>}
    />
  );
};

export const SurfaceAccordionCard: Story = {
  render: () => (
    <Matrix maxWidth={640}>
      <State label="Rows: one open (selected), one disabled" direction="column"><AccordionCardDemo /></State>
      <State label="Single item, collapsed" direction="column"><SingleAccordionDemo /></State>
    </Matrix>
  ),
};

export const SurfaceCopyGroup: Story = {
  render: () => (
    <Matrix maxWidth={480}>
      <State label="Compact and comfortable" direction="column">
        <G.SurfaceCard ariaLabel="Compact copy">
          <G.SurfaceCopyGroup density="compact">
            <G.Heading level={3}>Compact rhythm</G.Heading>
            <G.Text tone="muted">Title and explanation sit 0.5rem apart.</G.Text>
          </G.SurfaceCopyGroup>
        </G.SurfaceCard>
        <G.SurfaceCard ariaLabel="Comfortable copy">
          <G.SurfaceCopyGroup density="comfortable">
            <G.Heading level={3}>Comfortable rhythm</G.Heading>
            <G.Text tone="muted">A looser pairing for longer copy.</G.Text>
          </G.SurfaceCopyGroup>
        </G.SurfaceCard>
      </State>
    </Matrix>
  ),
};

export const EmptyNotice: Story = {
  render: () => (
    <Matrix maxWidth={560}>
      <State label="Message only" direction="column">
        <G.EmptyNotice message="No lessons yet." />
      </State>
      <State label="With icon and action" direction="column">
        <G.EmptyNotice message="No saved lessons." description="Save a lesson to find it here." iconSource={BookGlyph} actionLabel="Browse lessons" actionStartContent={<G.Icon source={PlusGlyph} usage="leading" />} onAction={noop} />
      </State>
      <State label="Action pending" direction="column">
        <G.EmptyNotice message="Nothing to import." actionLabel="Refresh" actionVariant="secondary" isActionPending onAction={noop} />
      </State>
    </Matrix>
  ),
};

export const SectionHeader: Story = {
  render: () => (
    <Matrix maxWidth={720}>
      <State label="Section header with eyebrow and action" direction="column">
        <G.SectionHeader eyebrow="Course" title="Grammar basics" description="Twelve short lessons." action={<G.Button variant="secondary" size="sm">Share</G.Button>} level={2} />
      </State>
      <State label="Context intro" direction="column">
        <G.SectionHeader composition="context-intro" title="Welcome back" description="Pick up where you left off." level={2} />
      </State>
    </Matrix>
  ),
};

export const MediaFrame: Story = {
  render: () => (
    <Matrix maxWidth={640}>
      <State label="Framed with caption">
        <div style={{ width: 320 }}>
          <G.MediaFrame caption="Figure 1. Placeholder artwork.">
            <img src={placeholderImage('Framed')} alt="Placeholder artwork" />
          </G.MediaFrame>
        </div>
      </State>
      <State label="Plain, square, contain">
        <div style={{ width: 200 }}>
          <G.MediaFrame treatment="plain" aspect="square" fit="contain">
            <img src={placeholderImage('Plain', 160)} alt="Plain placeholder artwork" />
          </G.MediaFrame>
        </div>
      </State>
    </Matrix>
  ),
};

export const MarkdownArticle: Story = {
  render: () => (
    <G.MarkdownArticle ariaLabel="Lesson article">
      <h1>Articles in English</h1>
      <p>Use <strong>a</strong> before consonant sounds and <strong>an</strong> before vowel sounds.</p>
      <h2>Examples</h2>
      <ul>
        <li>a book</li>
        <li>an hour</li>
      </ul>
      <blockquote>Sound, not spelling, decides.</blockquote>
      <p>Inline <code>code</code> and a <a href="#reference">reference link</a>.</p>
    </G.MarkdownArticle>
  ),
};

export const FencedCodeBlock: Story = {
  render: () => (
    <Matrix maxWidth={640}>
      <State label="Authored code with language and action" direction="column">
        <G.FencedCodeBlock language="tsx" code={'import { CoreGrammarRoot } from "@starci/grammar/core"\n\nexport const App = () => <CoreGrammarRoot>…</CoreGrammarRoot>'} action={<G.Button size="sm" variant="ghost">Copy</G.Button>} />
      </State>
      <State label="Rendered children" direction="column">
        <G.FencedCodeBlock language="sh"><code>npm install @starci/grammar</code></G.FencedCodeBlock>
      </State>
    </Matrix>
  ),
};

export const MarkdownTableFrame: Story = {
  render: () => (
    <G.MarkdownTableFrame>
      <table>
        <caption>Article choice</caption>
        <thead>
          <tr><th scope="col">Word</th><th scope="col">Article</th><th scope="col">Why</th></tr>
        </thead>
        <tbody>
          <tr><td>hour</td><td>an</td><td>Silent h</td></tr>
          <tr><td>university</td><td>a</td><td>Starts with a y sound</td></tr>
        </tbody>
      </table>
    </G.MarkdownTableFrame>
  ),
};

export const HorizontalScrollRegion: Story = {
  render: () => (
    <Matrix maxWidth={520}>
      <State label="Overflow needed (focusable scroll region)" direction="column">
        <G.HorizontalScrollRegion aria-label="Lesson cards" tabIndex={0}>
          <div style={{ display: 'flex', gap: '0.75rem', width: 'max-content' }}>
            {Array.from({ length: 8 }, (_, index) => (
              <G.SurfaceCard key={index} ariaLabel={`Lesson ${index + 1}`}><G.Text>Lesson {index + 1}</G.Text></G.SurfaceCard>
            ))}
          </div>
        </G.HorizontalScrollRegion>
      </State>
    </Matrix>
  ),
};

export const VerticalScrollRegion: Story = {
  render: () => (
    <Matrix maxWidth={420}>
      <State label="Contained scroll" direction="column">
        <div style={{ height: 180, display: 'flex' }}>
          <G.VerticalScrollRegion isScrollable aria-label="Activity" tabIndex={0}>
            {Array.from({ length: 12 }, (_, index) => (
              <G.Text key={index}>Activity item {index + 1}</G.Text>
            ))}
          </G.VerticalScrollRegion>
        </div>
      </State>
    </Matrix>
  ),
};

export const Rail: Story = {
  render: () => (
    <Matrix>
      <State label="Complementary rail with footer">
        <div style={{ height: 320, display: 'flex' }}>
          <G.Rail label="Progress" width="standard" footer={<G.Text tone="muted" size="sm">Updated daily.</G.Text>}>
            <G.Progress label="Course" value={40} />
            <G.Meter label="Weekly goal" value={3} maxValue={5} valueLabel="3 of 5" />
          </G.Rail>
        </div>
      </State>
      <State label="Content navigation, pending state">
        <div style={{ height: 320, display: 'flex' }}>
          <G.Rail landmark="content-navigation" width="compact" state="pending">
            <G.Link href="#intro" isCurrent>Introduction</G.Link>
            <G.Link href="#rules">Rules</G.Link>
            <G.Link href="#practice">Practice</G.Link>
          </G.Rail>
        </div>
      </State>
    </Matrix>
  ),
};
