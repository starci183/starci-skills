import { cn } from '@heroui/react';

/** Vertical rhythm between the create form and the rows beneath it. */
export const TASK_LIST_BODY_CLASS_NAME = cn('flex', 'flex-col', 'gap-4');

/** Field and submit stack inside the create-task form. */
export const TASK_LIST_FORM_CLASS_NAME = cn('flex', 'flex-col', 'gap-4');

/** The rows share vertical rhythm as a group. */
export const TASK_LIST_ROWS_CLASS_NAME = cn('flex', 'flex-col', 'gap-2');

/** One row's own layout: the toggle and its label beside the delete action. */
export const TASK_LIST_ROW_CLASS_NAME = cn('flex', 'items-center', 'justify-between', 'gap-4');
