// A workflow is a pre-composed chain of operators: an ordered list of steps, each step a list of
// branches that run in parallel. workflows/*.json are examples the entry may reuse when a request
// matches their `when`; otherwise the entry composes its own chain under the same rules this script
// enforces: every operator exists; every requirement preset names a declared field; every required
// Input of a branch is produced by an earlier step; branches of one step share no write alias; a loop
// goes back to an earlier step and carries a round cap; the chain ends where it says it ends.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, cellAliases, kindOf, isYes } from './operator-md.mjs';
import { loadAliasRegistry, baseOf } from './alias-registry.mjs';

// Only a fully quoted cell is unquoted: a sentence that opens with a code span keeps its backticks.
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };

export async function validateWorkflows(root) {
  const errors = [];
  const packages = (await loadOperatorPackages(root)).filter((p) => p.shape === 'v9');
  const aliases = (await loadAliasRegistry(root)).aliases;
  // Fields the orchestrator fills from the session or the mission scope: neither preset nor asked (resources/orchestrator.json#agent.fills).
  const fills = new Set(JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8')).agent?.fills ?? []);
  const ops = new Map(packages.map((p) => {
    const op = p.en;
    const writes = new Set();
    for (const s of op.tables.steps?.rows ?? []) for (const a of cellAliases(s.writes)) writes.add(baseOf(aliases, a) ?? a);
    // The checkout roles the operator's required Context binds (@workspaces/fe, @workspaces/be, ...).
    const roles = new Set();
    for (const r of op.tables.context?.rows ?? []) { const a = cellAliases(r.alias)[0]; const m = a && /^@workspaces\/(fe|be)\b/.exec(a); if (m && isYes(r.required)) roles.add(m[1]); }
    return [p.manifest.id, {
      fields: new Set((op.tables.requirements?.rows ?? []).map((r) => unquote(r.field))),
      // Fields with no Default: the workflow presets them or declares under asks who supplies them before the branch starts.
      mustSupply: (op.tables.requirements?.rows ?? []).filter((r) => r.default.trim().startsWith('—')).map((r) => unquote(r.field)),
      required: (op.tables.inputs?.rows ?? []).filter((r) => isYes(r.required)).map((r) => kindOf(r.kind)),
      outputs: new Set((op.tables.outputs?.rows ?? []).map((r) => kindOf(r.kind))),
      next: new Set((op.tables.next?.rows ?? []).map((r) => unquote(r.operator))),
      roles,
      writes,
    }];
  }));
  const dir = path.join(root, 'workflows');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const ids = new Set();
  for (const file of files) {
    const rel = `workflows/${file}`;
    let wf; try { wf = JSON.parse(await readFile(path.join(dir, file), 'utf8')); } catch (e) { errors.push(`${rel}: ${e.message}`); continue; }
    if (wf.schemaVersion !== 9) errors.push(`${rel}: schemaVersion must be 9`);
    if (wf.id !== file.replace(/\.json$/, '')) errors.push(`${rel}: id must equal the file name`);
    if (ids.has(wf.id)) errors.push(`${rel}: duplicate id`); ids.add(wf.id);
    if (!wf.when?.en || !wf.when?.vi) errors.push(`${rel}: when.en and when.vi are required`);
    if (!Array.isArray(wf.chain) || wf.chain.length === 0) { errors.push(`${rel}: chain must be a non-empty array of steps`); continue; }
    const produced = new Set();
    const positions = new Map(); // operator -> first step index
    const boundRoles = new Set(); // workspace.bind roles bound by earlier steps
    let previousOps = null;
    wf.chain.forEach((step, n) => {
      // Adjacency: every operator of this step must be a Next of some operator of the previous step,
      // or the same operator re-entered (a resume or a second mode of the same job).
      if (Array.isArray(step) && previousOps) {
        for (const b of step) {
          const allowed = previousOps.some((prev) => prev === b.operator || (ops.get(prev)?.next ?? new Set()).has(b.operator));
          if (!allowed) errors.push(`${rel}: step ${n + 1} runs ${b.operator}, which no Next table of step ${n} (${previousOps.join(', ')}) permits`);
        }
      }
      if (!Array.isArray(step) || step.length === 0) { errors.push(`${rel}: step ${n + 1} must be a non-empty array of branches`); return; }
      if (step.length > 3) errors.push(`${rel}: step ${n + 1} has ${step.length} branches; at most 3 run in parallel`);
      const stepProduces = new Set();
      const seenWrites = new Map();
      step.forEach((b, m) => {
        const at = `${rel}: step ${n + 1} branch ${m + 1}`;
        const op = ops.get(b.operator);
        if (!op) { errors.push(`${at}: unknown operator ${b.operator}`); return; }
        if (!positions.has(b.operator)) positions.set(b.operator, n);
        for (const key of Object.keys(b.requirements ?? {})) if (!op.fields.has(key)) errors.push(`${at}: requirement ${key} is not a field of ${b.operator}`);
        for (const key of b.asks ?? []) { if (!op.fields.has(key)) errors.push(`${at}: asks ${key}, which is not a field of ${b.operator}`); else if (key in (b.requirements ?? {})) errors.push(`${at}: asks ${key} and presets it`); else if (fills.has(key)) errors.push(`${at}: asks ${key}, which the orchestrator fills`); }
        for (const key of op.mustSupply) if (!fills.has(key) && !(key in (b.requirements ?? {})) && !(b.asks ?? []).includes(key)) errors.push(`${at}: ${b.operator} requires ${key} (no Default); preset it or list it under asks`);
        for (const kind of op.required) if (!produced.has(kind)) errors.push(`${at}: ${b.operator} requires input ${kind}, which no earlier step produces`);
        // A required @workspaces/<role> context needs a workspace.bind of that role in an earlier step.
        if (b.operator !== 'workspace.bind') for (const role of op.roles) if (!boundRoles.has(role)) errors.push(`${at}: ${b.operator} requires @workspaces/${role}, which no earlier workspace.bind (role ${role}) bound`);
        if (b.fanout !== undefined && b.fanout !== 'matrix') errors.push(`${at}: fanout must be "matrix"`);
        if (b.maxParallel !== undefined && !(Number.isInteger(b.maxParallel) && b.maxParallel >= 1 && b.maxParallel <= 3)) errors.push(`${at}: maxParallel must be 1..3`);
        for (const w of op.writes) {
          if (seenWrites.has(w)) errors.push(`${at}: ${b.operator} and ${seenWrites.get(w)} both write ${w} in the same step; branches of one step must not share a write alias`);
          seenWrites.set(w, b.operator);
        }
        for (const k of op.outputs) stepProduces.add(k);
      });
      for (const k of stepProduces) produced.add(k);
      for (const b of step) if (b.operator === 'workspace.bind' && b.requirements?.role) boundRoles.add(b.requirements.role);
      previousOps = step.map((b) => b.operator);
    });
    for (const loop of wf.loops ?? []) {
      const from = positions.get(loop.from); const to = positions.get(loop.to);
      if (from === undefined || to === undefined) errors.push(`${rel}: loop names an operator outside the chain (${loop.from} → ${loop.to})`);
      else if (to >= from) errors.push(`${rel}: loop ${loop.from} → ${loop.to} must go back to an earlier step`);
      if (!(Number.isInteger(loop.maxRounds) && loop.maxRounds >= 1)) errors.push(`${rel}: loop ${loop.from} → ${loop.to} needs maxRounds ≥ 1`);
      if (!loop.when) errors.push(`${rel}: loop ${loop.from} → ${loop.to} needs a when`);
    }
    const last = wf.chain[wf.chain.length - 1];
    const lastOps = Array.isArray(last) ? last.map((b) => b.operator) : [];
    if (wf.ends !== 'user' && !lastOps.includes(wf.ends)) errors.push(`${rel}: ends must be "user" or an operator of the last step (${lastOps.join(', ')})`);
  }
  // The README lists every example.
  const readme = await readFile(path.join(dir, 'README.md'), 'utf8');
  for (const id of ids) if (!readme.includes(`\`${id}\``)) errors.push(`workflows/README.md: does not list ${id}`);
  return { errors, count: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, count } = await validateWorkflows(root);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`workflows closed: ${count} examples\n`);
}
