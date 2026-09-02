// frontend.source.apply's own law over one branch, on top of the shared step check: every class in every
// written file comes from the bound resolution's inventory, which is read back beside the resolution
// receipt the request named; the write lands on the session branch and nowhere else; a dry run
// commits nothing and an applied run commits exactly once; created, modified and unchanged agree with
// the hashes; and the receipt and changes.md list exactly the files the plan carries.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';

// The inventory the resolution froze sits beside its receipt: <branch>/response/data/inventory.json.
export function inventoryPathFor(resolutionRef) {
  return resolutionRef.replace(/response\/[a-z-]+\.md$/, 'response/data/inventory.json');
}

export async function validateApplicationStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'frontend.source.apply') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const mode = requirements.mode ?? 'apply';

  let plan = null;
  if (present.has('writes') && has('response/data/writes.json')) {
    try { plan = JSON.parse(await read('response/data/writes.json')); } catch { plan = null; }
  }
  if (!plan) {
    if (response.status === 'done') errors.push('response/data/writes.json: a done branch needs the write plan');
    return { errors };
  }
  const at = 'response/data/writes.json';

  if (plan.mode !== mode) errors.push(`${at}: mode ${plan.mode} differs from the request's ${mode}`);
  if (!plan.branch.startsWith('session/')) errors.push(`${at}: the write lands on ${plan.branch}; only session/<sessionId> may be committed to`);
  if (request?.sessionId && plan.branch !== `session/${request.sessionId}`) errors.push(`${at}: branch ${plan.branch} is not the session branch of ${request.sessionId}`);

  const commits = response.commits ?? [];
  if (mode === 'dry') {
    if (plan.commit !== null) errors.push(`${at}: a dry run commits nothing, so commit must be null`);
    if (commits.length) errors.push('response/response.json: a dry run records no commit');
    for (const file of plan.files) if (file.change !== 'unchanged' && file.after !== null && file.before !== file.after) {
      errors.push(`${at}: ${file.path} reports a change under a dry run, which writes nothing`);
    }
  } else if (response.status === 'done') {
    if (plan.commit === null) errors.push(`${at}: an applied branch commits the declared write set exactly once`);
    if (commits.length !== 1) errors.push(`response/response.json: an applied branch records exactly one commit, found ${commits.length}`);
    else if (plan.commit !== null && commits[0] !== plan.commit) errors.push(`response/response.json: commits[0] ${commits[0]} is not the commit ${plan.commit} the plan recorded`);
    if (!plan.files.some((f) => f.change !== 'unchanged')) errors.push(`${at}: an applied branch moves at least one declared path (NO_PROGRESS otherwise)`);
  }

  // Every value that entered source came from the resolution; there is no other source of one.
  const sessionRoot = sessionRootOf(branchDir);
  const resolutionRef = request?.inputs?.['frontend-presentation-resolution'];
  let inventory = null;
  if (sessionRoot && resolutionRef) {
    const full = path.join(sessionRoot, inventoryPathFor(resolutionRef));
    if (existsSync(full)) { try { inventory = JSON.parse(await readFile(full, 'utf8')); } catch { inventory = null; } }
  }
  if (inventory) {
    const published = new Set(inventory.classNames);
    for (const file of plan.files) {
      for (const className of file.classes) {
        if (!published.has(className)) errors.push(`${at}: ${file.path} writes class ${className}, which the resolution never published (WRITE_REJECTED)`);
      }
    }
  } else if (response.status === 'done') errors.push(`${at}: the resolution inventory could not be read beside the receipt the request bound (RESOLUTION_STALE)`);

  const seen = new Set();
  for (const file of plan.files) {
    if (seen.has(file.path)) errors.push(`${at}: path ${file.path} appears twice in the plan`);
    seen.add(file.path);
    if (file.change === 'created' && file.before !== null) errors.push(`${at}: ${file.path} was created but reports a prior hash`);
    if (file.change === 'modified') {
      if (file.before === null) errors.push(`${at}: ${file.path} was modified but reports no prior hash`);
      else if (file.before === file.after) errors.push(`${at}: ${file.path} reports a modification with an unchanged hash`);
    }
    if (file.change === 'unchanged') {
      if (file.before !== file.after) errors.push(`${at}: ${file.path} is reported unchanged with a different hash`);
      if (file.classes.length) errors.push(`${at}: ${file.path} is reported unchanged while carrying classes`);
    }
    if (file.change === 'deleted' && file.after !== null) errors.push(`${at}: ${file.path} was deleted and still reports a later hash`);
  }

  if (present.has('frontend-source-application') && has('response/response.md')) {
    const text = await read('response/response.md');
    const rel = 'response/response.md';
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (binding.Mode !== mode) errors.push(`${rel}: Mode ${binding.Mode} differs from the request's ${mode}`);
    if (binding.Branch !== plan.branch) errors.push(`${rel}: Branch differs from the write plan`);
    if (binding.Base !== plan.base) errors.push(`${rel}: Base differs from the write plan`);
    if (binding.Commit !== (plan.commit ?? '—')) errors.push(`${rel}: Commit ${binding.Commit} differs from the write plan's ${plan.commit ?? '—'}`);
    const rows = tableUnder(text, '## Projection') ?? [];
    if (rows.length !== plan.files.length) errors.push(`${rel}: Projection has ${rows.length} rows, the plan has ${plan.files.length}`);
    for (const [p, change] of rows) {
      const file = plan.files.find((f) => f.path === p);
      if (!file) { errors.push(`${rel}: Projection names ${p}, which the plan does not carry`); continue; }
      if (file.change !== change) errors.push(`${rel}: ${p} is ${change} here and ${file.change} in the plan`);
    }
  }

  if (present.has('changes') && has('response/changes.md')) {
    const text = await read('response/changes.md');
    const rel = 'response/changes.md';
    const rows = tableUnder(text, '## Files') ?? [];
    const listed = rows.map(([p]) => p).sort();
    const planned = plan.files.map((f) => f.path).sort();
    if (listed.join('\n') !== planned.join('\n')) errors.push(`${rel}: Files lists ${listed.length} paths, the plan carries ${planned.length}`);
    for (const [p, change] of rows) {
      const file = plan.files.find((f) => f.path === p);
      if (!file) { errors.push(`${rel}: Files names ${p}, which the plan does not carry`); continue; }
      if (file.change !== change) errors.push(`${rel}: ${p} is ${change} here and ${file.change} in the plan`);
    }
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (!empty(binding.Checkout) && !binding.Checkout.includes(plan.branch)) errors.push(`${rel}: the Checkout row does not name the session branch ${plan.branch}`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateApplicationStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.source.apply branch\n');
}
