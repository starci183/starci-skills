import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';

// One TypeScript program per (compiler, root names, compiler options, project references) inside a program run, and
// one value per (kind, compiler, input) for what callers derive from those programs (the architecture context).
// A caller (canon-scan's architecture machine, a script checker) opens one run around its work and releases it after,
// so nothing built here outlives the run that built it. Outside a run every call
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
  for (const name of Object.keys(value).sort(byCodeUnit)) {
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

/** Read and expand a tsconfig with the caller's TypeScript compiler and optional tracked file reader. */
export function readTypeScriptProject(ts, configFile, readFile = ts.sys.readFile) {
  const read = ts.readConfigFile(configFile, readFile);
  if (read.error) return { read, parsed: null };
  const host = readFile === ts.sys.readFile ? ts.sys : { ...ts.sys, readFile };
  return { read, parsed: ts.parseJsonConfigFileContent(read.config, host, path.dirname(configFile), undefined, configFile) };
}

/** Resolve a project reference with the compiler's API, including older compiler fallback. */
export function typeScriptProjectReferencePath(ts, reference) {
  if (typeof ts.resolveProjectReferencePath === 'function') return ts.resolveProjectReferencePath(reference);
  return path.extname(reference.path) ? reference.path : path.join(reference.path, 'tsconfig.json');
}

/** Resolve an import using the selected project's compiler options. */
export function resolveTypeScriptModule(ts, specifier, from, options, host = ts.sys) {
  return ts.resolveModuleName(specifier, from, options, host).resolvedModule?.resolvedFileName;
}

