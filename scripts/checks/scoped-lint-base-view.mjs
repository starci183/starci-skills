// scoped-lint-base-view.mjs — the base tree's dependencies, read from the LIVE repository without a single link
// (nivo-fe inc-c8fbf76aa499; nivo auth inc-ee60a7c362a7).
//
// The scoped-lint base tree (scoped-lint-baseline.mjs materializeBaseTree) is a temp copy of the working tree made of
// plain files and directories only: it holds no node_modules and no link of any kind. The base measurement runs in a
// child process preloaded with this module (NODE_OPTIONS --import, so every node grandchild a checker spawns gets it
// too), which makes the live repository's node_modules readable at the base tree's own paths:
//   - fs: a READ of <base>/<rel>/node_modules/... reads <live>/<rel>/node_modules/... (TypeScript's sys, the
//     architecture and code-pattern checkers and ESLint plugins read through the patched fs); a real path that
//     lands in the live repository outside node_modules (a workspace package link: @scope/ui -> packages/ui) is
//     answered with the base tree's copy of it. A WRITE, delete or rename of such a path fails EROFS, so nothing is
//     ever written into the live repository through the view, and creating a symlink, junction or hard link fails
//     EPERM anywhere in the measuring process.
//   - modules: a bare specifier a base file cannot resolve is resolved from the same path in the live repository
//     (module.registerHooks, for import and require); a result inside a live workspace package maps to the base copy.
//     NODE_PATH (set by the parent) is the require.resolve fallback, which the hooks do not see.
//   - node grandchildren: a checker that spawns node with a sanitized environment (grammar-guards.mjs runs node
//     --permission with no NODE_OPTIONS) gets the view as an explicit --import=<this module>?view=<base,live>.
// Nothing here follows a link to delete or write anything; the view is read-only by construction.
import childProcess from 'node:child_process';
import fs from 'node:fs';
import module, {createRequire, isBuiltin} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const BASE_VIEW_ENV = 'STARCI_SCOPED_LINT_BASE_VIEW';
const INSTALLED = Symbol.for('starci.scopedLintBaseView');
const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '..', '..');
const relativeInside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)) ? relative : null;
};

/**
 * The pure path mapping of a view. base and live are the two git roots (the base tree's copy and the live checkout).
 * toLive(p): the live path a base-tree node_modules path reads, else null. toBase(p): the base copy of a live path
 * outside node_modules when it exists, else p. liveOf(p): the live counterpart of any base-tree path, else null.
 */
export function viewPaths({base, live, exists = (p) => originalExists(p)}) {
  const baseRoot = path.resolve(base), liveRoot = path.resolve(live);
  const asPath = (value) => {
    if (typeof value === 'string') return value;
    if (value instanceof URL) return value.protocol === 'file:' ? fileURLToPath(value) : null;
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    return null;
  };
  const liveOf = (value) => {
    const p = asPath(value);
    if (p == null) return null;
    const relative = relativeInside(baseRoot, path.resolve(p));
    return relative == null ? null : path.join(liveRoot, relative);
  };
  const toLive = (value) => {
    const p = asPath(value);
    if (p == null) return null;
    const relative = relativeInside(baseRoot, path.resolve(p));
    if (relative == null || !relative.split(/[\\/]/).includes('node_modules')) return null;
    return path.join(liveRoot, relative);
  };
  const toBase = (value) => {
    const p = asPath(value);
    if (p == null || typeof value !== 'string') return value;
    const absolute = path.resolve(p);
    if (relativeInside(skillRoot, absolute) != null) return value;
    const relative = relativeInside(liveRoot, absolute);
    if (!relative || relative.split(/[\\/]/).includes('node_modules')) return value;
    const copy = path.join(baseRoot, relative);
    return exists(copy) ? copy : value;
  };
  return {baseRoot, liveRoot, liveOf, toLive, toBase};
}

let originalExists = (p) => fs.existsSync(p);
const erofs = (syscall, target) => Object.assign(Error(`EROFS: the scoped-lint base view is read-only, ${syscall} '${target}'`), {code: 'EROFS', errno: -30, syscall, path: String(target)});
const eperm = (syscall, target) => Object.assign(Error(`EPERM: the scoped-lint base measurement never creates a link, ${syscall} '${target}' (nivo-fe inc-c8fbf76aa499)`), {code: 'EPERM', errno: -1, syscall, path: String(target)});
const writeFlag = (flags) => typeof flags === 'number' ? (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0 : /[wa+]/.test(String(flags ?? 'r'));

/** Install the view in this process (idempotent). Returns the mapping. */
export function installBaseView({base, live}) {
  if (globalThis[INSTALLED]) return globalThis[INSTALLED];
  const original = {existsSync: fs.existsSync, realpathSync: fs.realpathSync, realpathNative: fs.realpathSync.native};
  originalExists = (p) => original.existsSync.call(fs, p);
  const view = viewPaths({base, live});
  const {toLive, toBase} = view;
  const mapped = (value) => toLive(value) ?? value;
  const patch = (target, name, wrap) => { if (typeof target?.[name] === 'function') target[name] = wrap(target[name]); };
  // Reads: the first argument (a path) reads through to live.
  const readers = ['existsSync', 'statSync', 'lstatSync', 'readFileSync', 'readdirSync', 'accessSync', 'opendirSync', 'readlinkSync', 'createReadStream',
    'stat', 'lstat', 'readFile', 'readdir', 'access', 'opendir', 'readlink', 'exists'];
  for (const name of readers) patch(fs, name, (fn) => function viewRead(p, ...rest) { return fn.call(this, mapped(p), ...rest); });
  for (const name of ['stat', 'lstat', 'readFile', 'readdir', 'access', 'opendir', 'readlink']) patch(fs.promises, name, (fn) => function viewRead(p, ...rest) { return fn.call(this, mapped(p), ...rest); });
  // open: a read-only open reads through; a writing open of a view path is refused.
  patch(fs, 'openSync', (fn) => function viewOpen(p, flags, ...rest) { const live = toLive(p); if (live && writeFlag(flags)) throw erofs('open', p); return fn.call(this, live ?? p, flags, ...rest); });
  patch(fs, 'open', (fn) => function viewOpen(p, flags, ...rest) { const live = toLive(p); if (live && writeFlag(flags)) { const cb = [flags, ...rest].reverse().find((v) => typeof v === 'function'); if (cb) return process.nextTick(cb, erofs('open', p)); throw erofs('open', p); } return fn.call(this, live ?? p, flags, ...rest); });
  patch(fs.promises, 'open', (fn) => function viewOpen(p, flags, ...rest) { const live = toLive(p); if (live && writeFlag(flags)) return Promise.reject(erofs('open', p)); return fn.call(this, live ?? p, flags, ...rest); });
  // Real paths: read through, and a live workspace package answers with its base copy.
  const realpath = (fn) => function viewRealpath(p, ...rest) { const live = toLive(p); return live ? toBase(fn.call(this, live, ...rest)) : fn.call(this, p, ...rest); };
  fs.realpathSync = Object.assign(realpath(original.realpathSync), {native: realpath(original.realpathNative)});
  const asyncRealpath = (fn) => function viewRealpath(p, ...rest) {
    const live = toLive(p); if (!live) return fn.call(this, p, ...rest);
    const cb = rest.pop(); return fn.call(this, live, ...rest, (error, value) => cb(error, error ? value : toBase(value)));
  };
  const nativeAsync = fs.realpath.native;
  fs.realpath = Object.assign(asyncRealpath(fs.realpath), {native: asyncRealpath(nativeAsync)});
  patch(fs.promises, 'realpath', (fn) => async function viewRealpath(p, ...rest) { const live = toLive(p); return live ? toBase(await fn.call(this, live, ...rest)) : fn.call(this, p, ...rest); });
  // Writes into a view path are refused; the base tree's own files stay writable.
  const refuseWrite = (name, positions) => (fn) => function viewWrite(...args) {
    for (const index of positions) if (toLive(args[index])) {
      const error = erofs(name, args[index]); const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (cb) return process.nextTick(cb, error); throw error;
    }
    return fn.apply(this, args);
  };
  const writers = {writeFile: [0], appendFile: [0], mkdir: [0], rm: [0], rmdir: [0], unlink: [0], rename: [0, 1], copyFile: [1], cp: [1], truncate: [0], utimes: [0], chmod: [0], chown: [0], mkdtemp: [0], createWriteStream: [0]};
  for (const [name, positions] of Object.entries(writers)) {
    patch(fs, name, refuseWrite(name, positions));
    patch(fs, `${name}Sync`, refuseWrite(name, positions));
    patch(fs.promises, name, (fn) => function viewWrite(...args) { for (const index of positions) if (toLive(args[index])) return Promise.reject(erofs(name, args[index])); return fn.apply(this, args); });
  }
  // No link of any kind is ever created by the measuring process.
  for (const name of ['symlink', 'link']) {
    patch(fs, `${name}Sync`, () => function refuseLink(target, where) { throw eperm(name, where ?? target); });
    patch(fs, name, () => function refuseLink(target, where, ...rest) { const cb = rest.find((v) => typeof v === 'function'); const error = eperm(name, where ?? target); if (cb) return process.nextTick(cb, error); throw error; });
    patch(fs.promises, name, () => function refuseLink(target, where) { return Promise.reject(eperm(name, where ?? target)); });
  }
  // A node grandchild started with its own (possibly sanitized) environment still gets the view: --import with the
  // view in the URL, since NODE_OPTIONS and the view variable may not reach it.
  const viewImport = `--import=${new URL(`?view=${encodeURIComponent(JSON.stringify({base: view.baseRoot, live: view.liveRoot}))}`, pathToFileURL(fileURLToPath(import.meta.url))).href}`;
  const isNode = (file) => typeof file === 'string' && (file === 'node' || path.resolve(file).toLowerCase() === process.execPath.toLowerCase());
  const withView = (args) => Array.isArray(args) && !args.some((arg) => String(arg).includes('scoped-lint-base-view')) ? [viewImport, ...args] : args;
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) patch(childProcess, name, (fn) => function viewSpawn(file, args, ...rest) { return isNode(file) ? fn.call(this, file, withView(args), ...rest) : fn.call(this, file, args, ...rest); });
  module.syncBuiltinESMExports();
  // Modules: a bare specifier a base file cannot resolve resolves from the same place in the live repository.
  const bare = (specifier) => !/^(?:\.{1,2}(?:[\\/]|$)|[\\/]|[A-Za-z]:|[A-Za-z][A-Za-z0-9+.-]+:|#)/.test(specifier);
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        if (!bare(specifier) || isBuiltin(specifier)) return nextResolve(specifier, context);
        // A bare specifier from a base-tree file resolves exactly as from the same file in the live repository (its
        // nested node_modules first); only when that fails does the ordinary resolution (NODE_PATH, globals) answer.
        const parent = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : null;
        const liveParent = parent ? view.liveOf(parent) : null;
        let result = null;
        if (liveParent) {
          try {
            if (context.conditions?.includes('require')) {
              const resolved = createRequire(liveParent).resolve(specifier);
              result = isBuiltin(resolved) ? {url: `node:${resolved.replace(/^node:/, '')}`, shortCircuit: true} : {url: pathToFileURL(resolved).href, shortCircuit: true};
            } else result = nextResolve(specifier, {...context, parentURL: pathToFileURL(liveParent).href});
          } catch { result = null; }
        }
        result ??= nextResolve(specifier, context);
        if (result?.url?.startsWith('file:')) {
          const resolved = fileURLToPath(result.url), copy = toBase(resolved);
          if (copy !== resolved) return {...result, url: pathToFileURL(copy).href};
        }
        return result;
      },
    });
  }
  globalThis[INSTALLED] = view;
  return view;
}

// Preloaded (NODE_OPTIONS --import) with the view named in the environment: install before anything else loads.
{
  let request = null;
  try { request = JSON.parse(new URL(import.meta.url).searchParams.get('view') ?? process.env[BASE_VIEW_ENV] ?? 'null'); } catch { request = null; }
  if (request?.base && request?.live) installBaseView(request);
}
