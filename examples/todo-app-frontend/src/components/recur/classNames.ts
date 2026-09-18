import { cn } from '@heroui/react';

/** WorkspaceShell root; recur.css keys off it to release globals.css's 32rem prose `main` bound. */
export const RECUR_SHELL_CLASS_NAME = cn('recur-schedule-shell');

/** The white desktop header band the direction draws across the full frame. */
export const HEADER_BAR_CLASS_NAME = cn(
  'border-b',
  'border-solid',
  'border-[var(--separator,#e4e4e7)]',
  'bg-white',
);

/** Header contents: brand left, destinations beside it, account presence at the far end. */
export const HEADER_INNER_CLASS_NAME = cn('flex', 'items-center', 'gap-10', 'min-h-20');

/**
 * Brand rule for links: dark labels with a blue underline (the strict ink rule keeps link text
 * dark; saturated brand colour is allowed on the underline itself). TextAction's shipped
 * appearances only underline on hover, so furniture links get the resting underline from a plain
 * wrapping span - the decoration propagates to the anchor, it does not restyle it.
 */
export const LINK_UNDERLINE_CLASS_NAME = cn(
  'underline',
  'decoration-[var(--starci-core-accent,#2F6BFF)]',
  'underline-offset-4',
);

/** Plain-text product name; the brand approves no logo glyph for this header. */
export const BRAND_CLASS_NAME = cn('text-xl', 'font-bold', 'tracking-tight', 'whitespace-nowrap');

/** The destination row the header carries. */
export const NAV_GROUP_CLASS_NAME = cn('flex', 'items-center', 'gap-6');

/** Synthetic account presence: neutral avatar letter, name and the sign-out action. */
export const ACCOUNT_GROUP_CLASS_NAME = cn('flex', 'items-center', 'gap-3', 'ms-auto');

/** Neutral circular avatar holding the account initial; decorative, the name beside it names it. */
export const AVATAR_CLASS_NAME = cn(
  'flex',
  'items-center',
  'justify-center',
  'size-9',
  'rounded-full',
  'bg-[var(--surface-secondary,#ececee)]',
  'text-sm',
  'font-medium',
  'select-none',
);

/** The thin divider the direction draws between the account name and Sign out. */
export const ACCOUNT_SEPARATOR_CLASS_NAME = cn('h-5', 'border-l', 'border-[var(--separator,#d4d4d8)]');

/** Compact header contents on narrow viewports: brand left, account right, no destination row. */
export const COMPACT_HEADER_INNER_CLASS_NAME = cn('flex', 'items-center', 'gap-4', 'px-4', 'min-h-14');

/** Main-column vertical rhythm inside the page container. */
export const PAGE_STACK_CLASS_NAME = cn('flex', 'flex-col', 'gap-6', 'py-8');

/** Breadcrumb row above the screen heading. */
export const BREADCRUMB_CLASS_NAME = cn('flex', 'items-center', 'gap-2');

/** The heading/context/back-link block between the breadcrumb and the schedule card. */
export const INTRO_STACK_CLASS_NAME = cn('flex', 'flex-col', 'gap-2', 'items-start');

/** Understated footer row at the bottom of the main column. */
export const FOOTER_CLASS_NAME = cn(
  'flex',
  'items-center',
  'gap-6',
  'border-t',
  'border-[var(--separator,#e4e4e7)]',
  'pt-6',
);

/** Field stack inside the schedule form. */
export const SCHEDULE_FORM_CLASS_NAME = cn('flex', 'flex-col', 'gap-5');

/** The direction's two-column labelled-group grid; recur.css collapses it on narrow viewports. */
export const FIELD_GROUP_CLASS_NAME = cn('recur-field-group');

/** The group's left-column label cell, matching the Input labels' column. */
export const FIELD_LABEL_CLASS_NAME = cn('recur-field-label', 'text-base', 'font-medium');

/** The group's right-column control cell. */
export const FIELD_CONTROL_CLASS_NAME = cn('recur-field-control');

/** Indent that lands a line under the control column rather than under the label column. */
export const UNDER_CONTROL_CLASS_NAME = cn('recur-under-control');

/** The native frequency radio group. */
export const RADIO_GROUP_CLASS_NAME = cn('flex', 'flex-col', 'gap-2');

/** One radio option row. */
export const RADIO_OPTION_CLASS_NAME = cn('flex', 'items-center', 'gap-2', 'text-base');

/** The native radio itself takes the product accent when checked. */
export const RADIO_INPUT_CLASS_NAME = cn('size-4', 'accent-[var(--starci-core-accent,#2F6BFF)]');

/** The save/cancel action row; wraps on narrow viewports without hiding controls. */
export const FORM_ACTIONS_CLASS_NAME = cn('flex', 'flex-wrap', 'items-center', 'gap-3');

/** The form's action row indented to the direction's control column. */
export const SCHEDULE_ACTIONS_CLASS_NAME = cn(FORM_ACTIONS_CLASS_NAME, UNDER_CONTROL_CLASS_NAME);

/** The rule summary and end-rule action inside the schedule card. */
export const SUMMARY_STACK_CLASS_NAME = cn('flex', 'flex-col', 'gap-4', 'items-start');

/** The end-rule confirmation copy and its two actions. */
export const END_CONFIRM_CLASS_NAME = cn('flex', 'flex-col', 'gap-3', 'items-start');
