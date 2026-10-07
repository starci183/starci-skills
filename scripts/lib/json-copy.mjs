// json-copy.mjs — a deep copy with exactly the semantics of a JSON round trip (stringify, then parse): only what JSON can
// carry survives. `toJSON` is called (a Date becomes its ISO string), members that are undefined, functions or symbols
// are dropped from objects and read as null in arrays (holes included), non-finite numbers read as null, -0 reads as 0, wrapper
// objects become their primitive, Map and Set become `{}`, symbol and non-enumerable keys vanish, a BigInt or a cycle
// throws a TypeError, and a value JSON cannot express at the top (undefined, a function, a symbol) throws a SyntaxError.
// `structuredClone` is a different operation (it keeps Dates, Maps, undefined members and references).

const DROPPED = Symbol('json-dropped');

const unwrapped = (value) => {
  if (value instanceof Number) return Number(value);
  if (value instanceof String) return String(value);
  if (value instanceof Boolean) return value.valueOf();
  if (typeof BigInt === 'function' && value instanceof BigInt) throw new TypeError('Do not know how to serialize a BigInt');
  return value;
};

const prepared = (value, key) => {
  const own = value !== null && (typeof value === 'object' || typeof value === 'bigint') && typeof value.toJSON === 'function' ? value.toJSON(key) : value;
  return typeof own === 'object' && own !== null ? unwrapped(own) : own;
};

const scalarCopy = (value) => {
  if (typeof value === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
  if (typeof value === 'number') return Number.isFinite(value) ? value + 0 : null;
  return value;
};

const copyOf = (input, key, path) => {
  const value = prepared(input, key);
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return DROPPED;
  if (value === null || typeof value !== 'object') return scalarCopy(value);
  if (path.includes(value)) throw new TypeError('Converting circular structure to JSON');
  const inside = [...path, value];
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => {
      const item = copyOf(value[index], String(index), inside);
      return item === DROPPED ? null : item;
    });
  }
  const copy = {};
  for (const name of Object.keys(value)) {
    const item = copyOf(value[name], name, inside);
    if (item !== DROPPED) Object.defineProperty(copy, name, { value: item, enumerable: true, writable: true, configurable: true });
  }
  return copy;
};

/** The JSON round trip of `value` as a fresh structure. */
export function jsonCopy(value) {
  const copy = copyOf(value, '', []);
  if (copy === DROPPED) throw new SyntaxError('"undefined" is not valid JSON');
  return copy;
}
