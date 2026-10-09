// machine-temp.mjs - whether a file sits under a temp directory: the test that keeps a spec run from reaching the host's machine.sqlite.
import fs from 'node:fs';
import os from 'node:os';
import { pathKey } from '../../scripts/lib/path-key.mjs';
import { tempRoot } from '../temp-root.mjs';

const normDir = (file) => pathKey(file, { fold: true });

/** The temp directories of `env`, as written and as their realpaths: the OS temp, the configured temp root, TEMP and TMP. */
export const tempDirsOf = (env = process.env) => [...new Set([os.tmpdir(), tempRoot({ env }), env.TEMP, env.TMP].filter(Boolean)
  .flatMap((dir) => { const out = [normDir(dir)]; try { out.push(normDir(fs.realpathSync.native(dir))); } catch { /* missing */ } return out; }))].filter((dir) => !/^(?:[a-z]:)?$/.test(dir));

/** True when `file` sits under the OS temp directory or the configured temp root, as written or as its realpath. */
export function isUnderTempDir(file, { env = process.env, tempDirs = tempDirsOf(env) } = {}) {
  if (typeof file !== 'string' || !file) return false;
  const forms = [normDir(file)];
  try { forms.push(normDir(fs.realpathSync.native(file))); } catch { /* missing */ }
  return forms.some((form) => tempDirs.map(normDir).some((dir) => form.startsWith(`${dir}/`)));
}
