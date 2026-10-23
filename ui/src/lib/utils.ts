import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names, dropping falsy ones and letting later Tailwind utilities override earlier
 * conflicting ones.
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/** Order strings by UTF-16 code unit: the order of a bare `sort()`, stated (the UI bundle cannot import the runtime's `scripts/lib/list.mjs`). */
export const byCodeUnit = (a: string, b: string) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
