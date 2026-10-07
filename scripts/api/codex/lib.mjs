// scripts/api/codex/lib.mjs — the runner of the Codex CLI as a one-shot child: hidden, never a shell, the whole prompt on
// stdin. The call file beside it (exec.mjs) names its one use; nothing outside scripts/api/codex imports this runner.
// On Windows the `codex` PATH entry is an npm .cmd shim that Node refuses to spawn without a shell, so the launcher runs
// the shim's own node script with this process's node binary: the argv reaches Codex byte for byte, no shell quoting.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { tempChildEnv } from '../../../engine/temp-root.mjs';

const SHIM_SCRIPT = ['node_modules', '@openai', 'codex', 'bin', 'codex.js'];
const pathEntries = (env, delimiter) => {
  const key = Object.keys(env).find((name) => name.toLowerCase() === 'path');
  return String(env[key] ?? '').split(delimiter).filter(Boolean).map((entry) => entry.replace(/^"(.*)"$/, '$1'));
};

/** The program and leading argv that run the Codex CLI: `codex` itself, or on Windows the script behind its npm shim. */
export function codexLauncher({ env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  if (platform !== 'win32') return { command: 'codex', prefix: [] };
  for (const dir of pathEntries(env, ';')) {
    const script = path.join(dir, ...SHIM_SCRIPT);
    if (exists(path.join(dir, 'codex.cmd')) && exists(script)) return { command: process.execPath, prefix: [script] };
  }
  return { command: 'codex', prefix: [] };
}

/** The started ChildProcess of `codex <args>` (stdin, stdout and stderr piped); `command`/`prefix` replace the launcher (a spec's stand-in). */
export function codexStart(args, { cwd, env = process.env, command = null, prefix = null } = {}) {
  const launcher = command === null ? codexLauncher({ env }) : { command, prefix: prefix ?? [] };
  return spawn(launcher.command, [...launcher.prefix, ...args], { cwd, env: tempChildEnv(env), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}
