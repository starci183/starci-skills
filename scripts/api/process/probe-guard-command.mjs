// probe-guard-command.mjs — run a registered guard hook command the way an agent host runs it, and say whether it resolves.
//
// The host runs a hook command through a shell and treats a failure to start it as non-blocking, so an unresolvable
// guard command leaves every guarded command unguarded without any error the seat acts on. The probe runs the exact
// command text, with the empty request `{}` the guard allows, once through each shell the host family uses: bash (Git Bash
// on Windows, the shell Claude Code runs hooks in) and cmd on Windows, sh on POSIX. The environment is the caller's without
// the seat identity and without the per-user launcher directory on PATH, so only the command's own spelling can resolve.
// A shell the machine does not carry is skipped with its reason; the probe is ok when every shell that ran exited 0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readEnv } from '../../lib/env.mjs';
import { withoutSeatEnv } from '../../lib/seat-env.mjs';
import { resolveRealTool } from './resolve-real-tool.mjs';
import { runProgram } from './run-program.mjs';
import { systemTool } from './system-tool.mjs';

const PROBE_REQUEST = '{}';
const PROBE_TIMEOUT_MS = 30_000;
const DETAIL_CHARS = 200;

/** `env` without the per-user launcher directory on its PATH entry. */
function withoutLauncherDir(env, { home, platform }) {
  const key = Object.keys(env).find((name) => name.toLowerCase() === 'path');
  if (!key) return env;
  const comparable = (entry) => (platform === 'win32' ? path.resolve(entry).toLowerCase() : path.resolve(entry));
  const launcher = comparable(path.join(home, '.starci', 'bin'));
  const kept = String(env[key]).split(platform === 'win32' ? ';' : ':').filter((entry) => entry && comparable(entry.replace(/^"(.*)"$/, '$1')) !== launcher);
  return { ...env, [key]: kept.join(platform === 'win32' ? ';' : ':') };
}

/** The Git Bash a Windows seat runs hooks in: Claude Code's own override, else the `bin/bash.exe` of the Git installation `git` resolves to; null when none. */
function gitBashOf({ env, home, platform, exists }) {
  const named = readEnv('CLAUDE_CODE_GIT_BASH_PATH', env);
  if (named) return exists(named) ? named : null;
  const git = resolveRealTool('git', { env, home, platform });
  if (!git) return null;
  const root = path.dirname(path.dirname(git));
  return [root, path.dirname(root)].map((dir) => path.join(dir, 'bin', 'bash.exe')).find((file) => exists(file)) ?? null;
}

/** The shells this host family runs hooks in: [{shell, file (null when absent), argv(command), verbatim}]. */
function shellsOf({ env, home, platform, exists }) {
  const toolPath = (name) => { const found = systemTool(name, { platform, env, exists }); return found.ok ? found.path : null; };
  if (platform !== 'win32') return [{ shell: 'sh', file: toolPath('sh'), argv: (command) => ['-c', command], verbatim: false }];
  return [
    { shell: 'cmd', file: toolPath('cmd'), argv: (command) => ['/d', '/s', '/c', `"${command}"`], verbatim: true },
    { shell: 'bash', file: gitBashOf({ env, home, platform, exists }), argv: (command) => ['-c', command], verbatim: false },
  ];
}

const detailOf = (result) => {
  const text = String(result.stderr || result.stdout || result.error?.message || '').trim().replace(/\s+/g, ' ');
  return text.slice(0, DETAIL_CHARS);
};

/**
 * Run `command` through every shell of the platform. Returns {ok, reason, shells: [{shell, ok, skipped?, status?, detail?}]};
 * `reason` is null when ok, else one line naming each failing shell with its exit status and output.
 * Seams: `exists` (file probe), `run` (the spawn).
 */
export function probeGuardCommand({ command, home = os.homedir(), platform = process.platform, env = process.env, exists = fs.existsSync, run = runProgram } = {}) {
  const probeEnv = withoutLauncherDir(withoutSeatEnv(env), { home, platform });
  const shells = shellsOf({ env, home, platform, exists }).map((spec) => {
    if (!spec.file) return { shell: spec.shell, ok: true, skipped: `${spec.shell} is not installed on this machine` };
    const result = run(spec.file, spec.argv(command), { input: PROBE_REQUEST, env: probeEnv, timeout: PROBE_TIMEOUT_MS, ...(spec.verbatim ? { windowsVerbatimArguments: true } : {}) });
    return { shell: spec.shell, ok: result.status === 0, status: result.status, detail: detailOf(result) };
  });
  const ran = shells.filter((entry) => !entry.skipped);
  const failed = ran.filter((entry) => !entry.ok);
  const ok = ran.length > 0 && failed.length === 0;
  const reason = ok ? null : (failed.map((entry) => `${entry.shell} exit ${entry.status}: ${entry.detail}`).join('; ') || 'no shell on this machine can run the guard command');
  return { ok, reason, shells };
}
