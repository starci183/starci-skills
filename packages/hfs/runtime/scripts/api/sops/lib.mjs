// scripts/api/sops/lib.mjs — what the sops call files beside it share: the input type a custody file's name states.
// Custody members are committed as `<name>.<fmt>.enc`; sops infers a format from the LAST extension, so `.enc` reads as
// binary and every read states the format (--input-type). The call files (decrypt.mjs, encrypt.mjs, exec-env.mjs) each
// name one sops use.
import fs from 'node:fs';
import path from 'node:path';

const FORMATS = { yaml: 'yaml', yml: 'yaml', json: 'json', env: 'dotenv', dotenv: 'dotenv' };

/** The sops input type `<name>.<format>.enc` states, or the explicit override. Throws when neither names one. */
export function custodyInputType(file, override) {
  if (override) {
    if (!Object.values(FORMATS).includes(override)) throw new Error(`unsupported --input-type ${override}`);
    return override;
  }
  const match = /\.([a-z]+)\.enc$/iu.exec(String(file));
  const type = match ? FORMATS[match[1].toLowerCase()] : undefined;
  if (!type) throw new Error(`${file}: name it <name>.<yaml|json|env>.enc or pass --input-type`);
  return type;
}

/** The sops binary: PATH, then winget's Links and Packages (spawn without a shell ignores PATHEXT). */
export function resolveSops(env = process.env) {
  const win = process.platform === 'win32';
  const names = win ? ['sops.exe', 'sops'] : ['sops'];
  const dirs = String(env.PATH ?? '').split(win ? ';' : ':').filter(Boolean);
  if (win && env.LOCALAPPDATA) {
    const winget = path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet');
    dirs.push(path.join(winget, 'Links'));
    const packages = path.join(winget, 'Packages');
    try { for (const e of fs.readdirSync(packages)) if (/sops/i.test(e)) dirs.push(path.join(packages, e)); } catch { /* none */ }
  }
  for (const dir of dirs) for (const n of names) { const f = path.join(dir, n); try { if (fs.statSync(f).isFile()) return f; } catch { /* next */ } }
  return null;
}
