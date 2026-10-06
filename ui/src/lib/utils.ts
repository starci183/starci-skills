import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Order strings by UTF-16 code unit: the order of a bare `sort()`, stated (the UI bundle cannot import the runtime's `scripts/lib/list.mjs`). */
export const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
