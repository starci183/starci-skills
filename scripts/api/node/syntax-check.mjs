// syntax-check.mjs — `node --check <file>`: whether node parses a module without running it.
import { nodeSpawn } from './lib.mjs';

/** {ok, stderr} of `node --check file`. */
export const syntaxCheck = (file) => {
  const r = nodeSpawn(['--check', file]);
  return { ok: !r.error && r.status === 0, stderr: String(r.stderr ?? r.error?.message ?? '') };
};
