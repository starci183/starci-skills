import { isPlainObject } from '../../engine/plain-object.mjs';

/** Compose mapping/list entries; callers choose how bare keys and non-string list items are interpreted. */
export function composeEntries(value, { missingValue = '', stringsOnly = false, isMapping = isPlainObject } = {}) {
  if (!Array.isArray(value)) return Object.entries(isMapping(value) ? value : {});
  const entries = stringsOnly ? value.filter(entry => typeof entry === 'string') : value;
  return entries.map(entry => {
    const text = String(entry), separator = text.indexOf('=');
    return separator < 0 ? [text, missingValue] : [text.slice(0, separator), text.slice(separator + 1)];
  });
}
