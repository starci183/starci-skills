// starci supervisor lesson-actions — the self-learning loop's effectful verbs: land an experiment through the land gate, revert one in a
// scratch worktree, propose a change to the owner (Telegram). The state, guards and measuring live in
// scripts/machine/lessons.mjs; these three call the Supervisor's land gate and the owner push, so they sit one tier up.
//
//   starci supervisor lesson-actions land --signature <s> --commit <sha>[,<sha>] --lane <name> [--specs <csv>]
//        [--wrongly-blocked <tests/<name>.spec.mjs>] [--reason <t>] [--wait-ms <ms>] [--json]
//   starci supervisor lesson-actions revert --experiment <id> [--apply] [--json]
//   starci supervisor lesson-actions propose --title <t> --evidence <t> --options <t> --recommendation <t> [--send] [--json]
import path from 'node:path';
import crypto from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import { verbCli } from '../lib/cli-arg.mjs';
import { createScratchWorktree, removeScratchWorktree } from '../machine/worktree-git.mjs';
import { SKILL_ROOT, lanesRoot } from '../machine/home.mjs';
import { commit as gitCommit } from '../api/git/commit.mjs';
import { revert as gitRevert } from '../api/git/revert.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { show as gitShow } from '../api/git/show.mjs';
import { KINDS, commitFiles, guardLand, landedWithin, learningSettings, one, readLearning, write } from '../machine/lessons.mjs';
import { land } from './land.mjs';
import { ownerPush } from '../connectors/telegram.mjs';

/**
 * Guard, land through the gate, record the experiment. `landFn` is land.mjs land (a spec stubs it). Returns
 * {ok, refused?, land?, experiment?}.
 */
export async function landExperiment({ signature, commits, lane, specs = [], wronglyBlocked = null, reason = null, env = process.env, now = Date.now,
  waitMs = null, landFn = null, filesOf = commitFiles, readSpec = (rel, sha) => String(gitShow([`${sha}:${rel}`], { cwd: SKILL_ROOT, maxBuffer: 64 * 1024 * 1024 }).stdout ?? '').trim(), settings = learningSettings(), baseline = null }) {
  if (!signature || !commits?.length || !lane) throw Object.assign(new Error('land needs --signature, --commit and --lane'), { code: 'land-incomplete' });
  const files = filesOf(commits);
  const state = readLearning({ env });
  const guard = guardLand({ files, wronglyBlocked, specText: (rel) => commits.map((c) => readSpec(rel, c)).join('\n'), landedToday: landedWithin(state, { now: now() }), cap: settings.dailyAutoLandCap });
  if (!guard.ok) {
    write(env, KINDS.lesson, { signature, source: 'self', weight: 1, status: 'refused', text: `land refused: ${guard.refusals.map((r) => r.code).join(', ')}`, commits, lane, refusals: guard.refusals }, now());
    return { ok: false, refused: guard.refusals, tier: guard.tier };
  }
  const doLand = landFn ?? land;
  // --wait-ms: how long to queue for the gate (land.mjs acquireLand), as a lane's land.mjs --wait-ms does. The
  // default allocation.landGate.waitMs gave up behind a queue of lane lands and re-queued at the back (gate-busy).
  const landed = await doLand({ commits, specs, lane, env, ...(waitMs > 0 ? { waitMs } : {}) });
  if (!landed?.ok) return { ok: false, land: landed };
  const idSource = `${signature}|${commits.join(',')}`;
  const id = `exp-${crypto.createHash('sha1').update(idSource).digest('hex').slice(0, 10)}`;
  const experiment = write(env, KINDS.experiment, { id, signature, commits, head: landed.head ?? null, lane, tier: guard.tier, files: files.map((f) => f.path), specs,
    reason: one(reason, 500), landedAt: now(), baseline: baseline ?? null }, now());
  return { ok: true, land: landed, experiment };
}

/**
 * The revert lane of an experiment: a worktree on lane/revert-<id> off main, `git revert --no-commit` of its commits
 * newest first, one normal commit, the current land gate and the measured result.
 * `apply` false only plans. Seams: landFn, lanes.
 */
export async function revertExperiment({ id, apply = false, env = process.env, now = Date.now, landFn = null, root = SKILL_ROOT, lanes = null }) {
  const state = readLearning({ env });
  const e = state.experiments[id];
  if (!e) throw Object.assign(new Error(`no experiment ${id}`), { code: 'experiment-unknown' });
  const name = `revert-${id}`;
  const lanesDir = lanes ?? lanesRoot({ env });
  const dir = path.join(lanesDir, name);
  const plan = { id, signature: e.signature, commits: e.commits, lane: name, dir };
  if (!apply) return { ok: true, planned: true, ...plan };
  // One git call (a scripts/api/git call file) in the revert lane: its trimmed stdout, or a revert-git error.
  const step = (call, verb, args, cwd = dir) => {
    const r = call(args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw Object.assign(new Error(`git ${verb} ${args.join(' ')}: ${String(r.stderr ?? r.error?.message ?? '').trim()}`), { code: 'revert-git' });
    return String(r.stdout ?? '').trim();
  };
  // The one scratch worktree API (scripts/api/git/worktree-add.mjs): registered for the GC, removed in the finally below.
  const made = createScratchWorktree({ repoRoot: root, dir, kind: 'lane', branch: `lane/${name}`, newBranch: true, base: 'main', owner: { lane: name }, env });
  if (!made.ok) throw Object.assign(new Error(`worktree ${dir}: ${made.detail ?? made.reason}`), { code: 'revert-git' });
  try {
    for (const sha of [...e.commits].reverse()) step(gitRevert, 'revert', ['--no-commit', sha]);
    step(gitCommit, 'commit', ['-q', '-m', `revert(self-learning): ${e.signature} - experiment ${id} did not work\n\nReverts ${e.commits.join(', ')}: ${one(state.experiments[id].result?.reason ?? '', 400)}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
    const sha = step(revParseQuery, 'rev-parse', ['HEAD']);
    const doLand = landFn ?? land;
    const landed = await doLand({ commits: [sha], lane: name, env });
    write(env, KINDS.result, { id, signature: e.signature, outcome: landed?.ok ? 'reverted' : 'revert-due', reason: landed?.ok ? `reverted by ${sha.slice(0, 9)}` : `revert land failed: ${one(landed?.error ?? landed?.reason ?? JSON.stringify(landed), 200)}`, revertCommit: sha }, now());
    if (landed?.ok) write(env, KINDS.lesson, { signature: e.signature, source: 'self', weight: 1, status: 'reverted', fix: e.commits, effect: state.experiments[id].result?.reason ?? null,
      text: `${e.signature}: ${e.commits.map((c) => c.slice(0, 9)).join(',')} did not work (${state.experiments[id].result?.reason ?? ''}); reverted by ${sha.slice(0, 9)}` }, now());
    return { ok: landed?.ok === true, ...plan, revertCommit: sha, land: landed };
  } finally {
    // Never `git worktree remove --force` (it follows junctions): removeScratchWorktree removes every link as a link, then the tree.
    removeScratchWorktree({ repoRoot: root, dir, branch: `lane/${name}`, deleteBranch: 'force', env });
  }
}

/* ------------------------------------------------------------ proposals (PROPOSE-TO-OWNER) */

export async function propose({ title, evidence, options, recommendation, send = false, env = process.env, now = Date.now, push = null }) {
  if (![title, evidence, options, recommendation].every((x) => String(x ?? '').trim())) throw Object.assign(new Error('propose needs --title, --evidence, --options and --recommendation'), { code: 'proposal-incomplete' });
  const idSource = `${title}|${now()}`;
  const id = `prop-${crypto.createHash('sha1').update(idSource).digest('hex').slice(0, 8)}`;
  const text = [`StarCi .claude upgrade proposal ${id}: ${one(title, 200)}`, `Evidence: ${one(evidence, 800)}`, `Options: ${one(options, 600)}`, `Recommendation: ${one(recommendation, 400)}`,
    'Other work continues meanwhile. Reply in chat or Telegram with your choice.'].join('\n');
  let telegram = null;
  if (send) telegram = await (push ?? ownerPush)(text, { env });
  write(env, KINDS.proposal, { id, title: one(title, 200), evidence: one(evidence, 800), options: one(options, 600), recommendation: one(recommendation, 400), status: 'open', sent: Boolean(telegram?.ok && !telegram?.skipped) }, now());
  return { ok: true, id, text, telegram };
}


/* ------------------------------------------------------------ CLI */

if (isMain(import.meta.url)) {
  const { argv, verb, value, csv, print } = verbCli();
  try {
    if (verb === 'land') {
      const r = await landExperiment({ signature: value('signature'), commits: csv(value('commit')), lane: value('lane'), specs: csv(value('specs')), wronglyBlocked: value('wrongly-blocked'), reason: value('reason'), waitMs: Number(value('wait-ms')) || null });
      let summary;
      if (r.ok) summary = `landed ${r.experiment.id} (${r.experiment.signature}); measuring`;
      else if (r.refused) {
        const refusals = r.refused.map((x) => `${x.code}: ${x.detail}`).join(' | ');
        summary = `REFUSED ${refusals}`;
      }
      else summary = `land failed: ${JSON.stringify(r.land).slice(0, 400)}`;
      print(r, summary);
      if (!r.ok) process.exitCode = 1;
    } else if (verb === 'revert') {
      const r = await revertExperiment({ id: value('experiment'), apply: argv.includes('--apply') });
      let summary;
      if (r.planned) summary = `would revert ${r.commits.join(',')} in lane ${r.lane} (--apply)`;
      else if (r.ok) summary = `reverted ${r.id} by ${r.revertCommit}`;
      else summary = `revert failed: ${JSON.stringify(r.land).slice(0, 400)}`;
      print(r, summary);
      if (!r.ok) process.exitCode = 1;
    } else if (verb === 'propose') {
      const r = await propose({ title: value('title'), evidence: value('evidence'), options: value('options'), recommendation: value('recommendation'), send: argv.includes('--send') });
      let telegram = '';
      if (r.telegram) {
        const status = r.telegram.ok ? r.telegram.skipped ?? 'sent' : 'FAILED';
        telegram = ` (telegram ${status})`;
      }
      print(r, [`${r.id} recorded${telegram}`, ...String(r.text ?? '').split('\n')]);
    } else {
      console.error('use: starci supervisor lesson-actions land | revert | propose (see the header)');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`lessons: ${error?.message ?? error}`);
    process.exitCode = /incomplete|empty|unknown/.test(error?.code ?? '') ? 2 : 1;
  }
}
