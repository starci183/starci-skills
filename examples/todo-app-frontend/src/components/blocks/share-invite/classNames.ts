import { cn } from '@heroui/react';

/** Vertical rhythm between the breadcrumb, heading, back link, form card and collection. */
export const SHARE_BODY_CLASS_NAME = cn('flex', 'flex-col', 'gap-6');

/** The breadcrumb row: destinations separated by decorative slashes. */
export const SHARE_BREADCRUMB_CLASS_NAME = cn('flex', 'items-center', 'gap-2');

/** Field and controls stack inside the invite form. */
export const SHARE_FORM_CLASS_NAME = cn('flex', 'flex-col', 'gap-4');

/** The role group's own layout: the native fieldset's default chrome is reset, never restyled. */
export const SHARE_FIELDSET_CLASS_NAME = cn('m-0', 'flex', 'flex-col', 'gap-2', 'border-0', 'p-0');

/** One labelled role choice: the native radio beside its visible label. */
export const SHARE_RADIO_ROW_CLASS_NAME = cn('flex', 'items-center', 'gap-2');

/** The radio's own accent comes from the product token, not an app-local colour. */
export const SHARE_RADIO_INPUT_CLASS_NAME = cn('h-4', 'w-4', 'accent-(--accent)');

/** The collection's column header strip: muted surface, same tracks as the rows beneath it. */
export const SHARE_COLLABORATOR_HEADER_CLASS_NAME = cn(
  'grid', 'grid-cols-[minmax(0px,2fr)_minmax(0px,1fr)_minmax(0px,1fr)_auto]', 'items-center', 'gap-4',
  'border-b', 'border-(--separator)', 'bg-(--surface-secondary)', 'px-4', 'py-2',
);

/** The rows share one list; separators come from each row's own bottom rule. */
export const SHARE_COLLABORATOR_ROWS_CLASS_NAME = cn('m-0', 'flex', 'list-none', 'flex-col', 'p-0');

/** One collaborator row: person, access, status and the revoke action on shared tracks. */
export const SHARE_COLLABORATOR_ROW_CLASS_NAME = cn(
  'grid', 'grid-cols-[minmax(0px,2fr)_minmax(0px,1fr)_minmax(0px,1fr)_auto]', 'items-center', 'gap-4',
  'border-b', 'border-(--separator)', 'px-4', 'py-3',
);

/** The workspace shell's own top bar: wordmark, destinations, account presence and sign out. */
export const SHARE_TOP_BAR_CLASS_NAME = cn(
  'hidden', 'min-[70rem]:flex', 'items-center', 'justify-between', 'gap-4',
  'border-b', 'border-(--border)', 'px-6', 'py-3',
);

/** The primary destinations row inside the top bar. */
export const SHARE_TOP_NAV_CLASS_NAME = cn('flex', 'items-center', 'gap-1');

/** The account presence cluster at the top bar's trailing edge. */
export const SHARE_ACCOUNT_CLASS_NAME = cn('flex', 'items-center', 'gap-3');

/** The synthetic account monogram; its fill is the product's secondary surface token. */
export const SHARE_AVATAR_CLASS_NAME = cn(
  'flex', 'h-8', 'w-8', 'items-center', 'justify-center', 'rounded-full', 'bg-(--surface-secondary)', 'text-sm', 'font-medium',
);

/** The compact shell's own header row; the shell shows it only below its compact breakpoint. */
export const SHARE_COMPACT_BAR_CLASS_NAME = cn(
  'flex', 'items-center', 'justify-between', 'gap-4', 'border-b', 'border-(--border)', 'px-4', 'py-3',
);

/** The compact destinations row inside the shell's sticky compact navigation. */
export const SHARE_COMPACT_NAV_CLASS_NAME = cn('flex', 'items-center', 'gap-1');

/** The policy destinations at the bottom of the page column. */
export const SHARE_FOOTER_LINKS_CLASS_NAME = cn('flex', 'items-center', 'gap-4');
