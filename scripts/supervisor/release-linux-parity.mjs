// release-linux-parity.mjs - the Linux step of the L4 row (scripts/supervisor/release-l4.mjs): the CI-equivalent LIGHT jobs, run once in a Linux container on this
// host BEFORE the push, so the first GitHub run of the release tag is not the first Linux run of these gates. It is NOT a second full suite: the spec suites
// (the root `npm test`, an example's unit, integration and e2e runs) already ran on the host in the same L4 row and are left out.
// What runs is DERIVED from .github/workflows/*.yml, never listed by hand: every `run` step of every job (installs, the grammar build, the full check set, the clean
// install of every published package, the scaffold against registry installs, the example records, and per example app codegen, typecheck, starci app lint and the be and fe
// builds), in workflow order with the working directory and job env the workflow gives it. Left out, each with its reason in the record: spec suites, steps gated on
// workflow_dispatch or on the tag-only uploads, docker builds, browser runs and installs, and workflow plumbing (`echo ... >> $GITHUB_OUTPUT`).
// The container is the node image of the workflows' node-version; HEAD is handed to it as a tar of the tracked files (git archive: exactly what GitHub would check
// out) on a READ-ONLY mount, and extracted to a copy inside the container to write in (then a throwaway git repository, since the checks read git). Docker is spoken
// only through the scripts/api/docker call files, to a container this run names and removes; no port is published and no other container is touched.
// A red step, or no docker daemon, is a red L4 step: it blocks the cut.
// Seams (deps): docker ({version, run, rm}), archive (repo, file -> {ok, error}), workflows (repo -> [{file, doc}]), apps (repo -> [names]; runL4 hands over its example apps), logDir, now.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { archive } from '../api/git/archive.mjs';
import { run as dockerRun } from '../api/docker/run.mjs';
import { containerRm } from '../api/docker/container-rm.mjs';
import { version as dockerVersion } from '../api/docker/version.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { DEFAULT_NODE, parityImage } from '../lib/node-image.mjs';
import { byCodeUnit } from '../lib/list.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

const STEP_NAME = 'linux-parity';
/** The label of the spec step the container runs for the tests the host run skipped (read back by release-l4.mjs through the `##STEP` marker). */
export const LINUX_SPECS_LABEL = 'linux-specs';
/** The spec setup the root `npm test` runs under (package.json scripts.test): the same isolation for the files the container runs. */
const SPEC_IMPORTS = ['low-priority', 'isolated-temp', 'isolated-registry', 'runtime-copies'].map((name) => `--import ./tests/setup/${name}.mjs`).join(' ');
const RUN_TIMEOUT_MS = 90 * 60_000;
/** Where the container checks HEAD out: a path several levels below the filesystem root, as GitHub's runner checkout is (a spec that judges the runtime's distance from the root sees the same depth). */
export const WORK_DIR = '/opt/starci-parity/checkout';
/** The spec suites: the root `npm test` and an example app's npm test / test:<layer> runs. The host ran them in this L4 row. */
const SPEC_SUITE = /^npm (?:run )?test(?::[\w:-]+)?(?: -- .*)?$/;
const BROWSER = /playwright install|test:a11y|test:browser/;

/** The workflows of `repo` as parsed documents: [{file, doc}] (the root .github/workflows/*.yml, sorted by name). */
export function readWorkflows(repo) {
  const dir = path.join(repo, '.github', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort(byCodeUnit).flatMap((file) => {
    try { return [{ file, doc: parseYaml(fs.readFileSync(path.join(dir, file), 'utf8')) }]; } catch { return []; }
  });
}

/** `${{ matrix.app }}` / `${{ env.X }}` replaced from the context; any other expression stays (the caller leaves such a step out). Pure. */
const expand = (text, ctx) => String(text ?? '').replace(/\$\{\{\s*(matrix|env)\.([\w-]+)\s*\}\}/g, (all, scope, key) => (ctx[scope]?.[key] !== undefined ? String(ctx[scope][key]) : all));
const literalEnv = (env, ctx) => Object.fromEntries(Object.entries(env ?? {}).map(([k, v]) => [k, expand(v, ctx)]).filter(([, v]) => !v.includes('${{')));

/** Why a step is not run in the parity container, or null when it is. Pure. */
function leaveOut({ step, dir, matrixJob }) {
  const run = String(step.run).trim();
  const gate = String(step.if ?? '');
  if (/workflow_dispatch|refs\/tags|always\(\)/.test(gate)) return 'manual or tag-upload step';
  if (/GITHUB_OUTPUT/.test(run)) return 'workflow plumbing';
  if (/\bdocker\b/.test(run)) return 'docker build';
  if (BROWSER.test(run)) return 'browser run';
  if (SPEC_SUITE.test(run) && (dir === '.' || matrixJob)) return 'spec suite (the host ran it in this L4 row)';
  if (run.includes('${{')) return 'depends on a workflow expression';
  return null;
}

function planStep({ file, id, app, ctx, jobEnv, defaultDir, step, seen, node }) {
  let nextNode = node;
  const setup = String(step.uses ?? '').startsWith('actions/setup-node');
  if (setup && step.with?.['node-version'] !== undefined) {
    const major = /\d+/.exec(expand(step.with['node-version'], ctx))?.[0];
    if (major && (nextNode === null || Number(major) > Number(nextNode))) nextNode = major;
  }
  if (step.run === undefined) return { node: nextNode };
  const where = `${file}:${id}`;
  const dir = path.posix.normalize(expand(step['working-directory'] ?? defaultDir, { ...ctx, env: { ...ctx.env, ...jobEnv } }));
  const appLabel = app ? `[${app}]` : '';
  const name = `${where}${appLabel}: ${expand(step.name ?? String(step.run).split('\n')[0], ctx)}`;
  const run = expand(step.run, { ...ctx, env: { ...ctx.env, ...jobEnv } });
  const reason = leaveOut({ step: { ...step, run }, dir, matrixJob: app !== null });
  if (reason) return { node: nextNode, skipped: { name, reason } };
  // Identical means the same directory, command and the env values the command reads (`starci app lint "$APP_DIR"` differs per app).
  const read = Object.keys(jobEnv).filter((k) => run.includes(`$${k}`) || run.includes(`\${${k}}`)).map((k) => `${k}=${jobEnv[k]}`);
  const key = [dir, run.trim(), ...read].join('\u0000');
  if (seen.has(key)) return { node: nextNode };
  seen.add(key);
  return { node: nextNode, entry: { name, dir, run: run.trim(), env: jobEnv } };
}

function planJob({ file, id, job, apps, base, seen, state, steps, skipped }) {
  const where = `${file}:${id}`;
  if (/workflow_dispatch|refs\/tags/.test(String(job.if ?? ''))) { skipped.push({ name: where, reason: 'manual or tag-only job' }); return; }
  const matrixApps = job.strategy?.matrix?.app !== undefined ? apps : [null];
  for (const app of matrixApps) {
    const ctx = { matrix: app ? { app } : {}, env: base.env };
    const jobEnv = literalEnv({ ...base.env, ...job.env }, ctx);
    const defaultDir = expand(job.defaults?.run?.['working-directory'] ?? '.', { ...ctx, env: { ...ctx.env, ...jobEnv } });
    for (const step of job.steps ?? []) {
      const planned = planStep({ file, id, app, ctx, jobEnv, defaultDir, step, seen, node: state.node });
      state.node = planned.node;
      if (planned.skipped) skipped.push(planned.skipped);
      if (planned.entry) steps.push(planned.entry);
    }
  }
}

/**
 * The parity plan: {image, steps: [{name, dir, run, env}], skipped: [{name, reason}]}. Pure over the parsed workflows and the example app names.
 * A job whose matrix is the derived app list runs once per example app; a job gated on workflow_dispatch or on a release tag (the GitHub Release job) is left out whole; a step identical to an earlier one
 * (same directory, command and the env it reads: the repeated root install) runs once.
 */
export function parityPlan({ workflows, apps }) {
  const steps = [], skipped = [], seen = new Set(), state = { node: null };
  for (const { file, doc } of workflows) {
    const base = { env: { ...doc.env } };
    for (const [id, job] of Object.entries(doc.jobs ?? {})) planJob({ file, id, job, apps, base, seen, state, steps, skipped });
  }
  return { image: parityImage(state.node ?? DEFAULT_NODE), steps, skipped };
}

const quote = (v) => "'" + String(v).replaceAll("'", String.raw`'\''`) + "'";

/** The bash script the container runs: extract HEAD, snapshot it as a git repository, then each step in order, `##STEP`/`##FAILED` markers in the log. Pure. */
export function parityScript(plan) {
  const lines = [
    '#!/usr/bin/env bash',
    'set -eu',
    'export CI=1 NEXT_TELEMETRY_DISABLED=1 npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false',
    `mkdir -p ${WORK_DIR} && tar -xf /in/src.tar -C ${WORK_DIR}`,
    `cd ${WORK_DIR} && git init -q && git add -A && git -c user.name=starci -c user.email=l4@starci.invalid commit -q -m l4-snapshot`,
    `run_step() { name="$1"; dir="$2"; cmd="$(cat)"; echo "##STEP $name"; ( cd "${WORK_DIR}/$dir" && bash -ec "$cmd" ) || { echo "##FAILED $name"; exit 1; }; }`,
  ];
  plan.steps.forEach((s, i) => {
    const exports = Object.entries(s.env).map(([k, v]) => `export ${k}=${quote(v)}`).join('\n');
    lines.push(`run_step ${quote(s.name)} ${quote(s.dir)} <<'__STEP_${i}__'`, ...(exports ? [exports] : []), s.run, `__STEP_${i}__`);
  });
  if (plan.specs?.length) {
    // The tests the host run could not execute (a shell it lacks, a link privilege it will not grant): their spec files run here, the shells installed INSIDE the container only.
    const specsName = `${LINUX_SPECS_LABEL}: ${plan.specs.length} spec file(s) the host run skipped tests of`;
    lines.push(`run_step ${quote(specsName)} . <<'__STEP_SPECS__'`,
      'apt-get update -qq && apt-get install -y -qq zsh fish > /dev/null',
      `node ${SPEC_IMPORTS} --test --test-reporter=spec ${plan.specs.map(quote).join(' ')}`,
      '__STEP_SPECS__');
  }
  lines.push('echo "##DONE"');
  return `${lines.join('\n')}\n`;
}

/** The outcome of a container log: {done, failed, steps}. Pure. */
export function parityOutcome(text) {
  const steps = [...String(text ?? '').matchAll(/^##STEP (.*)$/gm)].map((m) => m[1]);
  const failed = /^##FAILED (.*)$/m.exec(String(text ?? ''));
  return { done: /^##DONE$/m.test(String(text ?? '')), failed: failed ? failed[1] : null, steps };
}

const tail = (text, max = 600) => String(text ?? '').trim().slice(-max);

/**
 * Run the parity step against `repo` (HEAD): {name: 'linux-parity', ok, log, ms, skips: [], image, steps, skipped, failedStep?, why?}.
 * `ok` is true only when the container exited 0 and printed its ##DONE marker after every planned step.
 */
export function runParity(repo, deps = {}) {
  const now = deps.now ?? Date.now;
  const t0 = now();
  const logDir = (deps.logDir ?? (() => { const dir = path.join(tempRoot(), 'starci-release-l4'); fs.mkdirSync(dir, { recursive: true }); return dir; }))();
  const log = path.join(logDir, `${STEP_NAME}-${t0}.log`);
  const docker = deps.docker ?? { version: dockerVersion, run: dockerRun, rm: containerRm };
  const plan = { ...parityPlan({ workflows: (deps.workflows ?? readWorkflows)(repo), apps: (deps.apps ?? (() => []))(repo) }), specs: [...(deps.specs ?? [])] };
  const result = (ok, why, extra = {}) => ({ name: STEP_NAME, ok, log, ms: now() - t0, skips: [], image: plan.image, steps: plan.steps.map((s) => s.name), skipped: plan.skipped, ...(why && { why }), ...extra });
  const refuse = (why) => { fs.writeFileSync(log, `${why}\n`); return result(false, why); };

  if (!plan.steps.length) return refuse('the workflows hold no step to run: nothing proves Linux parity');
  const daemon = docker.version();
  if (daemon.error || daemon.status !== 0) {
    const daemonOutput = tail(daemon.stderr || daemon.error?.message, 200) || `exit ${daemon.status}`;
    return refuse(`no docker daemon answers (${daemonOutput}): start Docker, the parity step cannot run`);
  }

  const work = makeTempDir('starci-l4-parity-');
  const name = `starci-l4-parity-${process.pid}-${t0}`;
  try {
    const tar = path.join(work, 'src.tar');
    const made = (deps.archive ?? ((root, file) => { const r = archive(['--format=tar', '-o', file, 'HEAD'], { cwd: root, timeout: 300_000 }); return { ok: r.status === 0, error: tail(r.stderr || r.error?.message) }; }))(repo, tar);
    if (!made.ok) return refuse(`git archive HEAD failed: ${made.error ?? ''}`);
    fs.writeFileSync(path.join(work, 'parity.sh'), parityScript(plan), 'utf8');
    const fd = fs.openSync(log, 'w');
    let r;
    try {
      r = docker.run(['--name', name, '--mount', `type=bind,source=${work},target=/in,readonly`, plan.image, 'bash', '/in/parity.sh'], { timeout: deps.timeoutMs ?? RUN_TIMEOUT_MS, stdio: ['ignore', fd, fd] });
    } finally { fs.closeSync(fd); }
    docker.rm(name); // this run's own container only, by its exact name: nothing is left behind after a timeout
    const text = fs.readFileSync(log, 'utf8');
    const out = parityOutcome(text);
    const ok = r.status === 0 && !r.error && out.done && !out.failed;
    let why = null;
    if (!ok) {
      if (out.failed) why = `red at ${out.failed}`;
      else if (r.error) why = `the container run failed: ${r.error.message}`;
      else why = `the container exited ${r.status} before the last step`;
    }
    return result(ok, why, { ...(out.failed && { failedStep: out.failed }) });
  } finally {
    safeRemove(work, { hold: artifactHoldReason });
  }
}
