import { AsyncLocalStorage } from 'node:async_hooks';

// One TypeScript program per (compiler, root names, compiler options, project references) inside a program run, and
// one value per (kind, compiler, input) for what callers derive from those programs (the architecture context).
// check-scoped-lint opens one run around its architecture check and its script checkers and releases it before
// ESLint and the base measurement, so nothing built here outlives the run that built it. Outside a run every call
// builds afresh.
const runs = new AsyncLocalStorage();

/** A program run: run(fn) shares what is built inside fn; release() drops it. */
export function typeScriptProgramRun() {
  const values = new Map();
  return {
    run: fn => runs.run(values, fn),
    release: () => values.clear(),
  };
}

function keyOf(value) {
  if (value === undefined) return 'u';
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map(keyOf);
    return items.includes(null) ? null : `[${items.join(',')}]`;
  }
  if (typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return null;
  const entries = [];
  for (const name of Object.keys(value).sort()) {
    const item = keyOf(value[name]);
    if (item === null) return null;
    entries.push(`${JSON.stringify(name)}:${item}`);
  }
  return `{${entries.join(',')}}`;
}

/**
 * build(), shared inside a program run by every caller that asks for the same kind, compiler and input. An input that
 * is not plain data (a function, a class instance) is never shared.
 */
export function sharedInProgramRun(kind, ts, input, build) {
  const values = runs.getStore();
  const key = values ? keyOf(input) : null;
  if (key === null) return build();
  let byKey = values.get(ts);
  if (!byKey) values.set(ts, byKey = new Map());
  const id = `${kind}\0${key}`;
  if (!byKey.has(id)) byKey.set(id, build());
  return byKey.get(id);
}

/** ts.createProgram, shared inside a program run. */
export function createTypeScriptProgram(ts, { rootNames, options, projectReferences }) {
  return sharedInProgramRun('program', ts, { rootNames, options, projectReferences },
    () => ts.createProgram({ rootNames, options, projectReferences }));
}
