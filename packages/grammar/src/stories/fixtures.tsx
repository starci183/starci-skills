import React, { type ReactNode, type SVGProps } from 'react';
import { userEvent } from 'storybook/test';

/*
 * Story-only fixtures: neutral glyphs, placeholder media and the state-matrix layout used by every
 * catalog story. Nothing here ships as a component; it only arranges the real renderers.
 */

type GlyphProps = SVGProps<SVGSVGElement>;

const glyph = (paths: ReactNode) => {
  const Glyph = (props: GlyphProps) => (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths}
    </svg>
  );
  return Glyph;
};

export const SearchGlyph = glyph(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const HomeGlyph = glyph(<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />);
export const BellGlyph = glyph(<><path d="M6 9a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></>);
export const UserGlyph = glyph(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const SettingsGlyph = glyph(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>);
export const MenuGlyph = glyph(<path d="M4 6h16M4 12h16M4 18h16" />);
export const PlusGlyph = glyph(<path d="M12 5v14M5 12h14" />);
export const FilterGlyph = glyph(<path d="M3 5h18l-7 8v6l-4 2v-8z" />);
export const StarGlyph = glyph(<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />);
export const BookGlyph = glyph(<><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M4 16a4 4 0 0 1 4-4h10" /></>);
export const ChartGlyph = glyph(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const UploadGlyph = glyph(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>);
export const TrashGlyph = glyph(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);

/** Neutral placeholder artwork as a data URI, so stories never depend on the network. */
export const placeholderImage = (label: string, hue = 330) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">` +
      `<rect width="640" height="400" fill="hsl(${hue} 70% 88%)"/>` +
      `<circle cx="470" cy="150" r="80" fill="hsl(${hue} 80% 70%)"/>` +
      `<rect x="80" y="240" width="300" height="40" rx="20" fill="hsl(${hue} 50% 40%)"/>` +
      `<text x="80" y="200" font-family="sans-serif" font-size="44" fill="hsl(${hue} 50% 25%)">${label}</text>` +
      `</svg>`,
  )}`;

/** A vertical stack of labelled state rows. */
export const Matrix = ({ children, maxWidth }: { readonly children: ReactNode; readonly maxWidth?: number }) => (
  <div
    data-story-matrix="true"
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--grammar-region-gap, 1.5rem)',
      ...(maxWidth === undefined ? {} : { maxWidth }),
    }}
  >
    {children}
  </div>
);

/** One labelled state (default, disabled, invalid, pending, selected, ...) of a renderer. */
export const State = ({
  label,
  children,
  direction = 'row',
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly direction?: 'row' | 'column';
}) => (
  <div data-story-state={label} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--grammar-inline-gap, 0.5rem)' }}>
    {/* Story chrome, not a renderer: plain text in the root foreground so it never masks findings. */}
    <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        flexWrap: direction === 'row' ? 'wrap' : 'nowrap',
        alignItems: direction === 'row' ? 'center' : 'stretch',
        gap: 'var(--grammar-row-gap, 0.75rem)',
      }}
    >
      {children}
    </div>
  </div>
);

/** The Storybook toolbar families; `common` is the bare neutral root. */
export const GRAMMAR_FAMILIES = ['common', 'core', 'heritage', 'offset-pop'] as const;
export type GrammarFamilyGlobal = (typeof GRAMMAR_FAMILIES)[number];

/** Scope props for a nested root that must stay in the toolbar-selected family. */
export const familyScope = (globals: Readonly<Record<string, unknown>>): { 'data-grammar-family'?: string } => {
  const family = globals['grammarFamily'];
  return typeof family === 'string' && family !== 'common' ? { 'data-grammar-family': family } : {};
};

/**
 * Drive the vendor interaction attributes the families style (`data-hovered`, `data-focus-visible`)
 * so one static frame shows a hovered row next to a keyboard-focused row. The pointer hovers `hovered`;
 * a key press then switches React Aria to keyboard modality before `focused` receives focus.
 */
export const showRowStates = async (hovered: Element | undefined, focused: HTMLElement | undefined) => {
  if (hovered !== undefined) await userEvent.hover(hovered);
  await userEvent.keyboard('{Shift}');
  focused?.focus();
};

/** A no-op for story callbacks that must exist but have nothing to do. */
export const noop = () => undefined;

export const pageLabel = (page: number) => `Page ${page}`;
