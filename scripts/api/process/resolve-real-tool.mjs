// resolve-real-tool.mjs - find the host executable behind a StarCi PATH wrapper without ever selecting that wrapper again.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pathValue = (env) => {
  const key = Object.keys(env ?? {}).find((name) => name.toLowerCase() === 'path');
  return key ? String(env[key] ?? '') : '';
};

const canonical = (value, { platform, realpath }) => {
  let resolved = path.resolve(value);
  try { resolved = realpath(resolved); } catch { /* a missing PATH entry stays comparable by its resolved spelling */ }
  return platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const executableNames = (program, { env, platform }) => {
  if (platform !== 'win32' || path.extname(program)) return [program];
  const extensions = String(env?.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const names = [program];
  for (const extension of extensions) names.push(`${program}${extension}`, `${program}${extension.toLowerCase()}`);
  return [...new Set(names)];
};

/** Resolve `program` from PATH while excluding <home>/.starci/bin by canonical directory identity. */
export function resolveRealTool(program, { env = process.env, home = os.homedir(), platform = process.platform,
  stat = fs.statSync, realpath = fs.realpathSync.native } = {}) {
  const name = String(program ?? '');
  if (!name || path.basename(name) !== name) return null;
  const delimiter = platform === 'win32' ? ';' : ':';
  const shimKey = canonical(path.join(home, '.starci', 'bin'), { platform, realpath });
  const names = executableNames(name, { env, platform });
  for (const rawEntry of pathValue(env).split(delimiter).filter(Boolean)) {
    const entry = rawEntry.replace(/^"(.*)"$/, '$1');
    if (canonical(entry, { platform, realpath }) === shimKey) continue;
    for (const executable of names) {
      const candidate = path.join(entry, executable);
      try {
        if (stat(candidate).isFile()) {
          try { return realpath(candidate); } catch { return path.resolve(candidate); }
        }
      } catch { /* try the next executable spelling or PATH entry */ }
    }
  }
  return null;
}
