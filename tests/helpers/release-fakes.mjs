// release-fakes.mjs - the fakes of the release and database verb specs (packages/hfs/release, packages/hfs/db). Worker G only.
//   makeRepo(options)       a REAL temp git repository (+ a bare temp remote, + a pre-push hook) with package.json and the declaration
//   makeSpawn(handlers)     a ctx.spawn: `git` runs the real git in options.cwd, every other command is answered by a handler or FAILS LOUDLY
//   releaseCtx(root, extra) a stack context over a spawn with captured stdout/stderr
//   greenTool()             the handler table of an app whose gates all pass
//   makeDbApp(options)      a temp app tree with migrations, an archive, a link state and the `database:` block
//   supabaseShim(options)   an in-memory Supabase CLI: remote history, repair, db push, db query; records every call and the files of each workdir
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { byCodeUnit } from '../../packages/hfs/runtime/engine/by-code-unit.mjs';
import { stringifyYaml } from '../../packages/hfs/runtime/engine/yaml.mjs';
import { stackContext } from '../../packages/hfs/stack/context.mjs';

export const PROJECT_REF = 'abcdefghijklmnopqrst';
export const JEST_GREEN = 'Test Suites: 3 passed, 3 total\nTests:       12 passed, 12 total\n';

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const write = (root, file, body) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), body);
};

/** Runs real git in `dir`; returns trimmed stdout and throws on failure. */
export const gitIn = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const TEMPLATE_HOOK = path.resolve(import.meta.dirname, '../../packages/hfs/templates/app/hooks/husky/pre-push');

/** The canon pre-push hook: the template with its `{{header}}` line replaced by a shebang. */
const canonHook = () => `#!/bin/sh\n${fs.readFileSync(TEMPLATE_HOOK, 'utf8').split('\n').slice(1).join('\n')}`;
const HOOKS = { canon: canonHook, reject: () => '#!/bin/sh\necho "RIGHTS_PUSH_NOT_RELEASE: nope" >&2\nexit 1\n', none: () => null };

/**
 * A real repository with one commit: package.json, optionally the declaration (`release`, `database`) and extra files; origin is a bare temp repo.
 * options: { version, scripts, release, database, files, hook: 'canon' | 'reject' | 'none', remoteHook }.
 */
export function makeRepo({ version = '1.0.0', scripts = { typecheck: 'tsc', lint: 'eslint .', test: 'jest' }, release, database, files = {}, hook = 'canon', remoteHook } = {}) {
  const root = tmp('release-app-');
  const remote = tmp('release-remote-');
  gitIn(remote, ['init', '--bare', '--quiet', '--initial-branch=main']);
  if (remoteHook) {
    write(remote, 'hooks/pre-receive', remoteHook);
    fs.chmodSync(path.join(remote, 'hooks', 'pre-receive'), 0o755);
  }
  gitIn(root, ['init', '--quiet']);
  gitIn(root, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  for (const [key, value] of [['user.name', 'Fixture'], ['user.email', 'fixture@example.com'], ['commit.gpgsign', 'false'], ['tag.gpgsign', 'false']]) gitIn(root, ['config', key, value]);
  write(root, 'package.json', JSON.stringify({ name: 'app', version, scripts }, null, 2));
  const declaration = { ...(release === undefined ? {} : { release }), ...(database === undefined ? {} : { database }) };
  if (Object.keys(declaration).length > 0) write(root, '.starcistacks/application-stacks.yaml', stringifyYaml({ schema: 'starci/application-stacks@1', ...declaration }));
  for (const [file, body] of Object.entries(files)) write(root, file, body);
  gitIn(root, ['add', '-A']);
  gitIn(root, ['commit', '--quiet', '-m', 'initial']);
  gitIn(root, ['remote', 'add', 'origin', remote]);
  const body = HOOKS[hook]();
  if (body) {
    write(root, '.git/hooks/pre-push', body);
    fs.chmodSync(path.join(root, '.git', 'hooks', 'pre-push'), 0o755);
  }
  return {
    root, remote, head: () => gitIn(root, ['rev-parse', 'HEAD']), git: (...args) => gitIn(root, args), remoteGit: (...args) => gitIn(remote, args),
    commit: (name) => { write(root, name, `${name}\n`); gitIn(root, ['add', '-A']); gitIn(root, ['commit', '--quiet', '-m', name]); },
    cleanup: () => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(remote, { recursive: true, force: true }); },
  };
}

export const ok = (stdout = '', stderr = '') => ({ status: 0, stdout, stderr });
export const bad = (stderr = 'failed', status = 1) => ({ status, stdout: '', stderr });

/** A ctx.spawn. `git` runs the real git in options.cwd; any other command goes to `handlers[command]` (args, options) -> result. Records `calls`. */
export function makeSpawn(handlers = {}, { gitHook } = {}) {
  const calls = [];
  const spawn = (command, args, options = {}) => {
    calls.push({ command, args: [...args], options });
    if (command === 'git') {
      const intercepted = gitHook?.(args, options);
      if (intercepted) return intercepted;
      const run = spawnSync('git', args, { encoding: 'utf8', cwd: options.cwd });
      return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', error: run.error };
    }
    const handler = handlers[command];
    if (!handler) throw new Error(`unexpected command ${command} ${args.join(' ')}`);
    return handler(args, options);
  };
  spawn.calls = calls;
  return spawn;
}

/** A stack context over `spawn` with captured output: { ctx, out, err }. */
export function releaseCtx(root, { spawn, env = {}, now = () => 1_800_000_000_000, sops } = {}) {
  const out = [];
  const err = [];
  const ctx = stackContext({ cwd: root, env, spawn, now, sleep: async () => {}, stdout: (text) => out.push(text), stderr: (text) => err.push(text), ...(sops ? { sops } : {}) });
  return { ctx, out, err, text: () => out.join('') };
}

/** Handlers of an app whose gates all pass: `npm`/`npx` answer by `args.join(' ')`; `overrides` replace or add entries. */
export function greenTool(overrides = {}) {
  const table = {
    'starci app check': ok('check ok\n'),
    'run typecheck': ok(), 'run lint': ok(), 'run build:be': ok(), 'run build:fe': ok(), 'run test': ok(JEST_GREEN),
    ...overrides,
  };
  const answer = (args, options) => {
    const entry = table[args.join(' ')];
    if (entry === undefined) throw new Error(`unexpected gate ${args.join(' ')}`);
    return typeof entry === 'function' ? entry(args, options) : entry;
  };
  return { npm: answer, npx: answer, 'cmd.exe': (args, options) => answer(args.slice(4), options) };
}

/* ---- the database app */

export const OLD_A = '20250101000000';
export const NEW_A = '20250201000000';
export const OLD_B = '20250102000000';
export const BASELINE = '20260301000000';
export const STANDARD = '20260301000100';
export const FORWARD_1 = '20260302000000';
export const FORWARD_2 = '20260303000000';
export const HELD = '20260310000000';
export const DROPS = [
  'DROP FUNCTION IF EXISTS public.legacy_claim(int, text);',
  'drop function if exists public.legacy_tick();',
  '-- DROP FUNCTION public.commented_out();',
  'DROP TABLE IF EXISTS public.legacy_jobs;',
].join('\n');

export const DATABASE_BLOCK = {
  baseline: 'baseline', standard: 'baseline-standard', heldBack: ['drop-legacy'], archiveDir: 'supabase/migrations/_archive',
  restamp: [{ from: OLD_A, to: NEW_A }], projectRef: PROJECT_REF,
  postCutover: { functionPrefixes: ['legacy_'], functionNames: ['other_tick'], functions: ['public.other_tick()'] },
};

/** A temp app tree for the database verbs: migrations, archive, link state; `block` replaces the declared database block, `null` omits it. */
export function makeDbApp({ block = DATABASE_BLOCK, linked = true, files, password } = {}) {
  const root = tmp('db-app-');
  const migrations = files ?? {
    [`${BASELINE}_baseline.sql`]: '-- baseline\n', [`${STANDARD}_baseline-standard.sql`]: '-- standard\n',
    [`${FORWARD_1}_add-orders.sql`]: '-- orders\n', [`${FORWARD_2}_add-jobs.sql`]: '-- jobs\n', [`${HELD}_drop-legacy.sql`]: DROPS,
  };
  for (const [name, body] of Object.entries(migrations)) write(root, `supabase/migrations/${name}`, body);
  write(root, `supabase/migrations/_archive/${OLD_A}_old-a.sql`, '-- old a\n');
  write(root, `supabase/migrations/_archive/${OLD_B}_old-b.sql`, '-- old b\n');
  if (linked) write(root, 'supabase/.temp/project-ref', `${PROJECT_REF}\n`);
  if (block !== null) write(root, '.starcistacks/application-stacks.yaml', stringifyYaml({ schema: 'starci/application-stacks@1', database: block }));
  if (password) write(root, `.starcistacks/${password.env}/secrets/${password.member}.enc`, '');
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }), write: (file, body) => write(root, file, body) };
}

const flagAt = (args, flag) => args[args.indexOf(flag) + 1];
const versionsAfter = (args, from) => args.slice(from).filter((word) => /^\d{14}$/u.test(word));
const filesOf = (dir) => {
  try { return fs.readdirSync(path.join(dir, 'supabase', 'migrations')).filter((file) => file.endsWith('.sql')).sort(byCodeUnit); } catch { return []; }
};

/**
 * The Supabase CLI as an in-memory remote history. options: { remote: [versions], rows: [{signature}] for `db query`, overrides: { '<command words>': (args) => result } }.
 * `shim.spawn`'s handler is `shim.handler`; `shim.calls` records { words, args, dir, files, mutating } (files = the migration files of the workdir).
 */
export function supabaseShim({ remote = [], rows = [], overrides = {} } = {}) {
  const history = new Set(remote);
  const calls = [];
  const listing = (dir, versions) => versions.map((version) => ` * ${filesOf(dir).find((file) => file.startsWith(version))}`).join('\n');
  const dryRun = (dir) => filesOf(dir).map((file) => file.split('_')[0]).filter((version) => !history.has(version));
  const answers = {
    'migration list': () => ok(`${JSON.stringify({ migrations: [...history].sort(byCodeUnit).map((version) => ({ remote: version })) })}\n`),
    'migration repair': (args, dir) => {
      const status = flagAt(args, '--status');
      const versions = versionsAfter(args, args.indexOf(status) + 1);
      if (status === 'reverted') for (const version of versions) history.delete(version);
      else if (versions.every((version) => filesOf(dir).some((file) => file.startsWith(`${version}_`)))) for (const version of versions) history.add(version);
      else return bad('Error: no local migration file for the version');
      return ok('Repaired migration history\n');
    },
    'db push': (args, dir) => {
      const pending = dryRun(dir);
      if (args.includes('--dry-run')) return ok(`Would push these migrations:\n${listing(dir, pending)}\n`);
      for (const version of pending) history.add(version);
      return ok('Finished supabase db push.\n');
    },
    'db query': () => ok(JSON.stringify(rows)),
  };
  const handler = (args, options) => {
    const words = args.slice(0, 2).join(' ');
    const dir = flagAt(args, '--workdir');
    const mutating = (words === 'migration repair') || (words === 'db push' && !args.includes('--dry-run'));
    calls.push({ words, args: [...args], dir, files: dir ? filesOf(dir) : [], mutating, env: options.env });
    const answer = overrides[words] ?? answers[words];
    if (!answer) throw new Error(`unexpected supabase ${args.join(' ')}`);
    return typeof answer === 'function' ? answer(args, dir, calls.length) : answer;
  };
  return { handler, calls, history, mutations: () => calls.filter((call) => call.mutating) };
}

/** Runs `step(item)` for each item one after another and resolves when the last is done (steps that share state cannot run in parallel). */
export const sequence = (items, step) => items.reduce((chain, item) => chain.then(() => step(item)), Promise.resolve());
