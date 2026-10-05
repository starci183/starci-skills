import fs from 'node:fs';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { ci } from '../api/npm/ci.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { linkedNodeModules, lockedValue } from '../machine/npm-ci.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';
import { SKILL_ROOT } from './state.mjs';
import { uiDeliveryReadiness } from '../machine/ui-delivery.mjs';

/** The newest mtime under `root` (files only, node_modules and dist skipped), or 0. Seam: fs. */
function newestMtime(root, { fsImpl = fs } = {}) {
  let newest = 0;
  const walk = (dir) => {
    let entries = [];
    try { entries = fsImpl.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else { try { newest = Math.max(newest, fsImpl.statSync(full).mtimeMs); } catch { /* gone */ } }
    }
  };
  walk(root);
  return newest;
}

/**
 * Whether ui/dist is older than its sources: any file under ui/src, or ui/package.json, ui/vite.config.*, ui/index.html,
 * ui/tsconfig.json newer than the newest dist file (or dist missing). {stale, reason, srcMs, distMs}. Seam: fs.
 */
export function uiBuildState({ uiDir = path.join(SKILL_ROOT, 'ui'), fsImpl = fs } = {}) {
  const distMs = newestMtime(path.join(uiDir, 'dist'), { fsImpl });
  const stat = (f) => { try { return fsImpl.statSync(path.join(uiDir, f)).mtimeMs; } catch { return 0; } };
  const loose = ['package.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'vite.config.mjs', 'vite.config.js'].map(stat);
  const srcMs = Math.max(newestMtime(path.join(uiDir, 'src'), { fsImpl }), ...loose);
  const delivery = uiDeliveryReadiness({ distDir: path.join(uiDir, 'dist'), fsImpl });
  if (!delivery.ok) return { stale: true, reason: `ui/dist delivery is unavailable (${delivery.reason ?? delivery.missing.join(', ')})`, srcMs, distMs };
  if (!distMs) return { stale: true, reason: 'ui/dist is missing', srcMs, distMs };
  if (srcMs > distMs) return { stale: true, reason: `a ui source is ${Math.round((srcMs - distMs) / 1000)}s newer than ui/dist`, srcMs, distMs };
  return { stale: false, reason: 'ui/dist is newer than every ui source', srcMs, distMs };
}

/** The harness owns its local toolchain install and build, including an installed non-Git runtime. */
export async function buildUi({ uiDir = path.join(SKILL_ROOT, 'ui'), env = process.env } = {}, deps = {}) {
  const api = { fs, ci, npm: runNpm, isLinkLike, underHostLock, ...deps };
  const root = path.resolve(uiDir), modules = path.join(root, 'node_modules');
  const toolEntries = ['vite/bin/vite.js', 'typescript/bin/tsc', 'eslint/bin/eslint.js'];
  const noLinks = (dir) => {
    const ancestors = [];
    for (let cursor = dir; ; cursor = path.dirname(cursor)) {
      ancestors.unshift(cursor);
      if (path.dirname(cursor) === cursor) break;
    }
    for (const cursor of ancestors) if (api.isLinkLike(cursor)) throw Error('harness UI path crosses a link');
  };
  const guard = () => {
    noLinks(root);
    if (!api.fs.lstatSync(root).isDirectory()) throw Error('harness UI directory is unavailable');
    const local = linkedNodeModules(root, api.fs.lstatSync.bind(api.fs));
    if (!local.ok || local.linked || api.isLinkLike(modules)) throw Error('harness UI node_modules must be a real local directory');
    try { if (!api.fs.lstatSync(modules).isDirectory()) throw Error('harness UI node_modules is not a directory'); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    for (const entry of toolEntries) {
      const file = path.join(modules, entry);
      noLinks(path.dirname(file));
      if (api.isLinkLike(file)) throw Error('harness UI build tool is linked');
    }
    return ['package.json', 'package-lock.json'].map((name) => {
      const file = path.join(root, name);
      if (api.isLinkLike(file) || !api.fs.lstatSync(file).isFile()) throw Error('harness UI manifest or lockfile is unavailable');
      return api.fs.readFileSync(file);
    });
  };
  const toolsReady = () => toolEntries.every((entry) => {
    const file = path.join(modules, entry);
    try { noLinks(path.dirname(file)); return !api.isLinkLike(file) && api.fs.lstatSync(file).isFile(); }
    catch { return false; }
  });
  try {
    const result = await api.underHostLock({ role: 'coordinator', purpose: 'harness-ui-build', env }, async () => {
      const manifests = guard();
      let install = null;
      if (!toolsReady()) {
        install = await api.ci(root, { env });
        if (install?.ok !== true || install?.status !== 0)
          return { ok: false, install, output: `UI dependency install failed: ${String(install?.stderr ?? 'no successful receipt').slice(0, 300)}` };
      }
      const current = guard();
      if (manifests.some((bytes, index) => !bytes.equals(current[index])))
        return { ok: false, install, output: 'UI dependency installation changed a manifest or lockfile' };
      if (!toolsReady()) return { ok: false, install, output: 'UI dependency installation left the local build toolchain incomplete' };
      const r = await api.npm(['run', 'build'], { cwd: root, env, timeout: 900_000 });
      return { ok: !r.error && r.status === 0, install,
        output: String(r.stdout ?? '').concat(String(r.stderr ?? '')).trim().split(/\r?\n/).slice(-6).join(' | ').slice(0, 500) };
    });
    return lockedValue(result);
  } catch (error) { return { ok: false, output: String(error?.message ?? error).slice(0, 500) }; }
}
