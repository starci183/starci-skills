// `starci runtime deploy` against a REAL throwaway runtime root, no fake engine: a clone of this runtime becomes the host (own config.yaml with every controller off,
// own .runtime state), a real engine process leads on it, and the verb fast-forwards the host, runs the new tree's `runtime artefacts --migrate` and
// `reconciler restart` as real child processes, and verifies the new leader from the machine store. Only the check run and the affected-spec run are replaced (they take minutes
// and have their own specs). Nothing here touches the live host: the root, the store and the engine are all inside a temporary directory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runtimeDeploy } from '../../scripts/reconciler/runtime-deploy.mjs';
import { leaderState, stopEngine } from '../../scripts/reconciler/boot.mjs';
import { runHostVerb } from '../../scripts/reconciler/runtime-deploy-host.mjs';
import { pidAlive, readMachine } from '../../engine/db/machine.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { sleep } from '../../scripts/lib/sleep.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** The environment of the throwaway host: its own state directory, no test registry, no inherited spec preloads that would point the store elsewhere. */
function hostEnv(host) {
  const env = { ...process.env, STARCI_RUNTIME: host, STARCI_LOCAL_ROOT: path.join(host, '.runtime') };
  for (const key of ['STARCI_TEST_MACHINE_FILE', 'STARCI_PROJECTS_ROOT', 'STARCI_HOST_LOCK_DIR', 'NODE_OPTIONS']) delete env[key];
  return env;
}

async function until(read, { timeoutMs, stepMs = 500 }) {
  const end = Date.now() + timeoutMs;
  let value = read();
  while (!value && Date.now() < end) { await sleep(stepMs); value = read(); }
  return value;
}

test('a real engine on a throwaway host is carried to a new revision by the verb: new pid, new rev, fresh heartbeat, old process gone, one event', { timeout: 420_000 }, async (t) => {
  const root = makeTempDir('starci-deploy-real-');
  const host = path.join(root, 'host'), clone = path.join(root, 'clone');
  const env = hostEnv(host);
  t.after(async () => {
    try { stopEngine({ env }); } catch { /* not running */ }
    await sleep(500);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  git(root, 'clone', '-q', skillRoot, host);
  git(host, 'checkout', '-q', '-B', 'main');
  const example = fs.readFileSync(path.join(host, 'config.example.yaml'), 'utf8');
  fs.writeFileSync(path.join(host, 'config.yaml'), example.replace(/reconciler:\n {2}enabled: true\n {2}profile: operational\n {2}controllers: \{\}\n/, 'reconciler:\n  enabled: true\n  controllers: {}\n'));
  assert.match(fs.readFileSync(path.join(host, 'config.yaml'), 'utf8'), /reconciler:\n {2}enabled: true\n {2}controllers: \{\}/, 'every controller is off on the throwaway host');

  const first = runHostVerb(host, ['reconciler', 'restart'], env);
  assert.equal(first.status, 0, JSON.stringify(first));
  const lead = await until(() => { const l = leaderState({ env }); return l.fresh ? l : null; }, { timeoutMs: 120_000 });
  assert.ok(lead, 'a real engine process leads on the throwaway host');
  assert.equal(lead.rev, git(host, 'rev-parse', 'HEAD'));

  git(root, 'clone', '-q', host, clone);
  fs.mkdirSync(path.join(clone, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(clone, 'docs', 'deploy-real-probe.md'), 'a revision that changes a note\n');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-q', '-m', 'docs: a probe note');
  const tip = git(clone, 'rev-parse', 'HEAD');

  const out = await runtimeDeploy({ args: { from: clone }, positionals: [], env, role: 'owner' },
    { root: host, numbers: { waitMs: 30_000, pollMs: 500, verifyMs: 180_000 }, seams: { runCheck: () => ({ ok: true, pass: 1, total: 1 }),
      runAffected: (dir, base) => ({ status: 0, data: { ok: true, receipt: { schema: 'starci/affected-receipt@1', base, tip, clean: true, files: 1, passed: 1, total: 1, ok: true, ms: 1, budgetMs: 1, concurrency: 1 } } }) } });
  assert.equal(out.code, 0, out.text);
  assert.equal(git(host, 'rev-parse', 'HEAD'), tip);

  const after = leaderState({ env });
  assert.equal(after.fresh, true);
  assert.equal(after.rev, tip, 'the leader reports the new revision');
  assert.notEqual(after.pid, lead.pid, 'it is a new process');
  assert.equal(pidAlive(lead.pid), false, 'the old engine process is gone');
  const deployed = readMachine((m) => m.supEvents({ kind: 'runtime-deployed' }), [], { env });
  assert.equal(deployed.length, 1);
  assert.equal(deployed[0].payload.to, tip);
  assert.equal(deployed[0].payload.engine.pid, after.pid);
  // The role notification's contract, end to end: the event carries the payload of the REAL `starci runtime revision-scope` verb of the new tree.
  const roles = deployed[0].payload.roleActions;
  assert.equal(roles.schema, 'starci/revision-deploy@1');
  assert.equal(roles.to, tip);
  assert.deepEqual(Object.fromEntries(Object.entries(roles.roles).map(([role, entry]) => [role, entry.action])), { kernel: 'none', supervisor: 'none', op: 'none', critic: 'none', engine: 'none' }, 'a docs-only deploy concerns no role');
});
