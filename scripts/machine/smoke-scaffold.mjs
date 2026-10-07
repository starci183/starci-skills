// smoke-scaffold.mjs - scaffold one edition in an isolated scratch tree, prove it, and clean it unless retained.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { resultDetail, resultOk } from '../lib/verb-call.mjs';
import { underHostLock } from './verb-lock.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntry = path.join(runtimeRoot, 'packages', 'cli', 'bin', 'starci.mjs');

/** `starci smoke scaffold`: one sequential scaffold/install/lint/typecheck/build/check proof. */
export async function smokeScaffold(ctx, deps = {}) {
  const ok = (result) => resultOk(result, { acceptOk: false });
  const detail = (result) => resultDetail(result, { limit: null, lastLine: true });
  const edition = String(ctx.global?.edition ?? ctx.args?.edition ?? '');
  if (!['full', 'lite'].includes(edition)) return { code: 2, stderr: 'starci smoke scaffold: --edition must be full or lite' };
  if ((ctx.positionals ?? []).length) return { code: 2, stderr: 'starci smoke scaffold: no positional arguments are accepted' };
  const parent = path.resolve(ctx.cwd ?? process.cwd(), ctx.args?.into ?? tempRoot());
  try {
    fs.mkdirSync(parent, { recursive: true });
    if (fs.lstatSync(parent).isSymbolicLink()) return { code: 2, stderr: 'starci smoke scaffold: --into may not be a symbolic link' };
  } catch (error) { return { code: 2, stderr: `starci smoke scaffold: cannot use --into (${error.message})` }; }

  const root = (deps.makeTemp ?? ((dir) => fs.mkdtempSync(path.join(dir, 'starci-smoke-'))))(parent);
  const name = `smoke-${edition}`;
  const app = path.join(root, name);
  const steps = [];
  const clock = deps.now ?? Date.now;
  const node = deps.runNode ?? runNode;
  const npm = deps.runNpm ?? runNpm;
  const env = ctx.env ?? process.env;
  const record = async (name, action) => {
    const started = clock();
    let result;
    try { result = await action(); } catch (error) { result = { error }; }
    const passed = ok(result);
    steps.push({ name, ok: passed, ms: Math.max(0, clock() - started) });
    return { passed, result };
  };

  let response;
  try {
    const operation = async () => {
      const scaffold = await record('scaffold', () => node([cliEntry, 'app', 'scaffold', name, '--into', root, '--edition', edition], { cwd: ctx.cwd, env }));
      if (!scaffold.passed) return { code: 1, stderr: `starci smoke scaffold: scaffold failed (${detail(scaffold.result) || 'no detail'})` };
      const install = await record('install', async () => {
        const first = await npm(['install', '--no-audit', '--no-fund'], { cwd: app, env, timeout: 900_000 });
        return ok(first) ? npm(['ci', '--no-audit', '--no-fund'], { cwd: app, env, timeout: 900_000 }) : first;
      });
      if (!install.passed) return { code: 1, stderr: `starci smoke scaffold: install failed (${detail(install.result) || 'no detail'})` };
      for (const [name, argv] of [
        ['lint', ['run', 'lint']],
        ['typecheck', ['run', 'typecheck', '--if-present']],
        ['build', ['run', 'build', '--if-present']],
      ]) {
        const step = await record(name, () => npm(argv, { cwd: app, env, timeout: 900_000 }));
        if (!step.passed) return { code: 1, stderr: `starci smoke scaffold: ${name} failed (${detail(step.result) || 'no detail'})` };
      }
      const check = await record('check', () => node([cliEntry, 'app', 'check', '--cwd', app], { cwd: app, env, timeout: 900_000 }));
      if (!check.passed) return { code: 1, stderr: `starci smoke scaffold: check failed (${detail(check.result) || 'no detail'})` };
      return { code: 0 };
    };
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'owner', purpose: 'smoke-scaffold', env }, operation, deps);
    if (locked?.ok === true && Object.hasOwn(locked, 'value')) response = locked.value;
    else if (locked?.ok === false && locked?.code === undefined) response = { code: 1, stderr: `starci smoke scaffold: host lock refused (${locked.reason ?? 'held'})` };
    else response = locked;
  } catch (error) { response = { code: 1, stderr: `starci smoke scaffold: ${error.message}` }; }

  if (ctx.args?.keep !== true) {
    const removed = await (deps.remove ?? safeRemove)(root, { hold: () => null });
    if (!removed?.ok) response = { code: 1, stderr: `starci smoke scaffold: scratch cleanup failed (${removed?.errors?.[0]?.message ?? 'unknown error'})` };
  }
  const data = { schema: 'starci/smoke-scaffold@1', edition, steps };
  const retained = ctx.args?.keep ? `; kept ${root}` : '';
  return { ...response, text: `starci smoke scaffold: ${steps.filter((step) => step.ok).length}/${steps.length} steps passed${retained}`, data };
}
