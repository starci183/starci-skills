// json-clone.mjs — a deep copy that keeps exactly what survives a JSON text and nothing else: the plain-data
// copy of a value, detached from every reference, frozen state and class of the original. `structuredClone` keeps
// what JSON drops (undefined members, Dates, Maps, sparse holes) and refuses what JSON accepts (functions,
// `toJSON` objects), so it is not a substitute; this walks the value once under the JSON.stringify rules.

/** The boxed primitives JSON.stringify unwraps: recognised by the internal slot a valueOf call reads, as JSON does. */
const BOXED = [
  { slot: Number.prototype.valueOf, read: (box) => Number(box) },
  { slot: String.prototype.valueOf, read: (box) => String(box) },
  { slot: Boolean.prototype.valueOf, read: (box) => Boolean.prototype.valueOf.call(box) },
  { slot: BigInt.prototype.valueOf, read: (box) => BigInt.prototype.valueOf.call(box) },
];

/** Whether `value` carries the internal slot `slot` reads (a valueOf of that boxed type does not throw on it). */
const hasSlot = (slot, value) => {
  try { slot.call(value); return true; } catch { return false; }
};

/** What JSON.stringify takes of `holder[key]`: the toJSON result when there is one, a boxed primitive unwrapped. */
const serialized = (holder, key) => {
  let value = holder[key];
  if (value !== null && (typeof value === 'object' || typeof value === 'bigint') && typeof value.toJSON === 'function') value = value.toJSON(key);
  if (value === null || typeof value !== 'object') return value;
  const box = BOXED.find((candidate) => hasSlot(candidate.slot, value));
  return box ? box.read(value) : value;
};

/** A member JSON leaves out of an object (and writes as null in an array). */
const isAbsent = (value) => value === undefined || typeof value === 'function' || typeof value === 'symbol';

const copyValue = (value, ancestors) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value + 0 : null;
  if (typeof value === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
  if (ancestors.includes(value)) throw new TypeError('Converting circular structure to JSON');
  const inside = [...ancestors, value];
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => {
      const item = serialized(value, String(index));
      return isAbsent(item) ? null : copyValue(item, inside);
    });
  }
  const entries = [];
  for (const name of Object.keys(value)) {
    const member = serialized(value, name);
    if (!isAbsent(member)) entries.push([name, copyValue(member, inside)]);
  }
  return Object.fromEntries(entries);
};

/**
 * `value` copied as JSON data: members that are undefined, functions or symbols are dropped (an array item becomes
 * null), non-finite numbers become null and -0 becomes 0, `toJSON` results replace their objects (a Date becomes its ISO string), boxed
 * primitives unwrap, and a cycle or a BigInt throws a TypeError. A value JSON has no text for (undefined, a function,
 * a symbol) throws a SyntaxError, as parsing the missing text does.
 */
export function jsonClone(value) {
  const top = serialized({ '': value }, '');
  if (isAbsent(top)) throw new SyntaxError('"undefined" is not valid JSON');
  return copyValue(top, []);
}
