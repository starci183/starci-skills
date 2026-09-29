// canonical-json.mjs — the one canonical JSON the runtime digests structured values with: object keys
// sorted, arrays in order, so two equal values always serialize to the same bytes. A leaf beside digest.mjs.
import {isPlainObject} from './plain-object.mjs';

/** The canonical JSON text of `value`: keys sorted at every depth. */
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
