// local.mjs - `starci app ci local [--jobs <id,...>] [--parallel <n>] [--dry-run] [--json]`: predict the CI result while GitHub runs it. It reads the app's
// managed .github/workflows/ci.yml (the CI standard's jobs: fast, lint per side, test per shard, coverage, build) and runs the `run:` steps of every job
// instance on this machine, matrix values substituted, independent instances in parallel and a job after the jobs it `needs`:
//   - steps GitHub alone can run are skipped and listed: `uses:` actions (checkout, caches, artifacts, Codecov, Sonar), the install (`npm ci`: the local
//     install is used), the lint baseline (STARCI_BASE_REF is set to origin/<default branch>), and every step whose `if:` or text needs GitHub context
//     (a Sonar token, a tag ref, step outputs);
//   - the unit shards write their lcov to be/coverage/shards/shard-<i> (on GitHub each shard has its own runner and uploads it), which is where the
//     coverage job's `starci app coverage merge` reads them;
//   - sonar and db-types run only when --jobs names them.
// Each instance logs to <job>[-<matrix>].log in --logs <dir>, else a new <tmp>/starci-ci-local-* directory. Exit 0 every instance green, 1 one red, 2 bad usage or no ci.yml. Run steps through bash.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseYaml } from '../runtime/engine/yaml.mjs';

const DEFAULT_JOBS = ['fast', 'lint', 'test', 'coverage', 'build'];
const GITHUB_ONLY_IF = /SONAR_TOKEN\s*!=\s*''|refs\/tags|startsWith\(github\.ref|steps\.|hashFiles|github\.event/;
const LOCAL_IF = /^(?:\$\{\{\s*)?(?:always\(\)|!cancelled\(\)|env\.SONAR_TOKEN\s*==\s*'')(?:\s*\}\})?$/;

function parseArgs(argv) {
  const opts = { logs: null, jobs: null, parallel: Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))), dryRun: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--jobs' || arg === '--parallel' || arg === '--logs') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      if (arg === '--logs') opts.logs = value;
      else if (arg === '--jobs') opts.jobs = value.split(',').map((job) => job.trim()).filter(Boolean);
      else if (!/^[1-9]\d*$/.test(value)) throw new Error('--parallel takes a positive integer');
      else opts.parallel = Number(value);
      index += 1;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return opts;
}

/** Every combination of a one-level matrix ({side: [be, fe]} -> [{side: be}, {side: fe}]); [{}] without one. */
function combinations(matrix) {
  const keys = Object.keys(matrix ?? {}).filter((key) => Array.isArray(matrix[key]));
  return keys.reduce((all, key) => all.flatMap((partial) => matrix[key].map((value) => ({ ...partial, [key]: value }))), [{}]);
}

const substitute = (text, values) => String(text).replace(/\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}/g, (whole, key) => (Object.hasOwn(values, key) ? String(values[key]) : whole));

/** The local verdict of one step: {run: command} or {skip: why}. */
function stepPlan(step, values) {
  const name = step.name ?? (step.uses ? String(step.uses).split('@')[0] : String(step.run ?? '').split('\n')[0].slice(0, 60));
  if (step.uses) return { name, skip: 'a GitHub action' };
  const condition = step.if === undefined ? null : String(step.if).trim();
  if (condition !== null && (GITHUB_ONLY_IF.test(condition) || !LOCAL_IF.test(condition))) return { name, skip: `if: ${condition} needs GitHub context` };
  let command = substitute(step.run ?? '', values);
  if (/^npm ci\b/.test(command.trim())) return { name, skip: 'the install: the local node_modules is used' };
  if (command.includes('$GITHUB_ENV') || command.includes('GITHUB_OUTPUT')) return { name, skip: 'writes GitHub step state' };
  if (/\$\{\{/.test(command)) return { name, skip: 'needs a GitHub expression' };
  if (name === 'unit' && values.shard !== undefined) command = `${command} --coverageDirectory coverage/shards/shard-${values.shard}`;
  const env = Object.fromEntries(Object.entries(step.env ?? {}).filter(([, value]) => !String(value).includes('${{')).map(([key, value]) => [key, substitute(value, values)]));
  return { name, run: command, env, cwd: step['working-directory'] ? substitute(step['working-directory'], values) : '.' };
}

/** The plan of the workflow: [{id, label, needs, steps: [{name, run|skip}]}], one entry per job instance. */
function localPlan(workflow, jobs = null) {
  const wanted = jobs ?? DEFAULT_JOBS;
  const plan = [];
  for (const [id, job] of Object.entries(workflow?.jobs ?? {})) {
    if (!wanted.includes(id)) continue;
    const needs = [job.needs ?? []].flat().map(String).filter((need) => wanted.includes(need));
    for (const values of combinations(job.strategy?.matrix)) {
      const suffix = Object.values(values).join('-');
      plan.push({ id, label: suffix ? `${id}-${suffix}` : id, needs, steps: (job.steps ?? []).map((step) => stepPlan(step, values)) });
    }
  }
  return plan;
}

function runStep(step, { root, env, log }) {
  return new Promise((resolve) => {
    fs.appendFileSync(log, `\n$ ${step.run}\n`);
    const child = spawn('bash', ['-c', step.run], { cwd: path.resolve(root, step.cwd), env: { ...env, ...step.env }, windowsHide: true });
    child.stdout.on('data', (chunk) => fs.appendFileSync(log, chunk));
    child.stderr.on('data', (chunk) => fs.appendFileSync(log, chunk));
    child.on('error', (error) => { fs.appendFileSync(log, `\n${error.message}\n`); resolve(1); });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function runInstance(instance, { root, env, logs }) {
  const log = path.join(logs, `${instance.label}.log`);
  fs.writeFileSync(log, `starci app ci local: ${instance.label}\n`);
  const started = Date.now();
  for (const step of instance.steps.filter((entry) => entry.run !== undefined)) {
    const code = await runStep(step, { root, env, log });
    if (code !== 0) return { label: instance.label, ok: false, failed: step.name, seconds: Math.round((Date.now() - started) / 1000), log };
  }
  return { label: instance.label, ok: true, seconds: Math.round((Date.now() - started) / 1000), log };
}

/** Run the plan: instances whose needs are all done, `parallel` at a time; an instance whose need failed is not run. */
async function runPlan(plan, { parallel, root, env, logs, report }) {
  const results = new Map();
  const pending = [...plan];
  const running = new Set();
  const doneJob = (id) => plan.filter((entry) => entry.id === id).every((entry) => results.has(entry.label));
  const jobOk = (id) => plan.filter((entry) => entry.id === id).every((entry) => results.get(entry.label)?.ok);
  await new Promise((resolve) => {
    const pump = () => {
      for (const instance of [...pending]) {
        if (running.size >= parallel) break;
        if (!instance.needs.every(doneJob)) continue;
        pending.splice(pending.indexOf(instance), 1);
        if (!instance.needs.every(jobOk)) { results.set(instance.label, { label: instance.label, ok: false, failed: `needs ${instance.needs.join(', ')}`, seconds: 0 }); continue; }
        const task = runInstance(instance, { root, env, logs }).then((result) => { results.set(instance.label, result); report(result); running.delete(task); pump(); });
        running.add(task);
      }
      if (!pending.length && !running.size) resolve();
      else if (!running.size && pending.length) { for (const instance of pending.splice(0)) results.set(instance.label, { label: instance.label, ok: false, failed: 'its needs never completed', seconds: 0 }); resolve(); }
    };
    pump();
  });
  return plan.map((instance) => results.get(instance.label));
}

/** `starci app ci local`. */
export async function ciLocalMain(argv, { cwd = process.cwd(), stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s), env = process.env } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (error) { stderr(`starci app ci local: ${error.message}; usage: starci app ci local [--jobs <id,...>] [--parallel <n>] [--logs <dir>] [--dry-run] [--json]\n`); return 2; }
  const file = path.join(cwd, '.github', 'workflows', 'ci.yml');
  if (!fs.existsSync(file)) { stderr('starci app ci local: no .github/workflows/ci.yml (run starci app sync --write)\n'); return 2; }
  const plan = localPlan(parseYaml(fs.readFileSync(file, 'utf8')), opts.jobs);
  if (!plan.length) { stderr('starci app ci local: no job of the workflow is selected\n'); return 2; }
  if (opts.dryRun) {
    if (opts.json) stdout(`${JSON.stringify(plan)}\n`);
    else for (const instance of plan) stdout(`${instance.label}${instance.needs.length ? ` (after ${instance.needs.join(', ')})` : ''}\n${instance.steps.map((step) => `  ${step.run !== undefined ? 'run ' : 'skip'} ${step.name}${step.skip ? ` - ${step.skip}` : ''}`).join('\n')}\n`);
    return 0;
  }
  const logs = opts.logs ? path.resolve(cwd, opts.logs) : fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ci-local-'));
  fs.mkdirSync(logs, { recursive: true });
  const defaultBranch = 'main';
  const runEnv = { ...env, CI: 'true', STARCI_BASE_REF: env.STARCI_BASE_REF ?? `origin/${defaultBranch}`, SONAR_TOKEN: '' };
  stdout(`starci app ci local: ${plan.length} job instance(s), ${opts.parallel} at a time; logs in ${logs}\n`);
  const results = await runPlan(plan, { parallel: opts.parallel, root: cwd, env: runEnv, logs, report: (result) => { if (!opts.json) stdout(`${result.ok ? 'green' : 'RED  '} ${result.label} (${result.seconds}s)${result.ok ? '' : ` at ${result.failed}: ${result.log}`}\n`); } });
  const red = results.filter((result) => !result.ok);
  if (opts.json) stdout(`${JSON.stringify({ ok: red.length === 0, results, logs })}\n`);
  else stdout(red.length ? `starci app ci local: ${red.length} of ${results.length} red: ${red.map((result) => result.label).join(', ')}\n` : `starci app ci local: all ${results.length} green\n`);
  return red.length ? 1 : 0;
}
