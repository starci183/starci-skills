// An operator.md package is closed when its own tables agree with each other, with the stop-code
// registry, with the kind contracts, and with its Vietnamese mirror: Params ↔ Requirements, Steps ↔
// Stops ↔ errors registry, Writes ↔ Outputs ↔ templates/kinds, Inputs ↔ templates/kinds, nested
// exchanges ↔ a waiting step, en ↔ vi.
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadOperatorPackages, HEADINGS, cellCodes, cellParams, cellFiles, kindOf, isYes, exchangeOf } from './operator-md.mjs';
import { loadErrorsRegistry } from './errors-registry.mjs';
import { loadKindTemplates } from './validate-templates.mjs';
import { PUBLISH_OPERATOR, DEPLOY_OPERATOR, PREFLIGHT_OPERATOR } from './validate-chain.mjs';

const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '');
const TABLES = ['context', 'inputs', 'requirements', 'steps', 'outputs', 'stops', 'next'];

// Done when: the one sentence that says when the branch ends done. It sits immediately after Job, is
// exactly one sentence — one `.` outside backticks, and that `.` is the last character — and names in
// backticks at least one kind of the operator's own Outputs table, so a receipt can be checked against
// it. The backticked identifiers are what the Vietnamese mirror must repeat, in the same order.
export const doneWhenIdentifiers = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
export function checkDoneWhen(at, op, outputKinds) {
  const errors = [];
  const h = HEADINGS[op.lang];
  const jobAt = op.headings.indexOf(h.job);
  const doneAt = op.headings.indexOf(h.doneWhen);
  if (doneAt === -1) { errors.push(`${at}: no ${h.doneWhen} section`); return errors; }
  if (jobAt === -1 || doneAt !== jobAt + 1) errors.push(`${at}: ${h.doneWhen} must be the section immediately after ${h.job}, found ${op.headings[jobAt + 1] ?? 'nothing'} there`);
  const body = op.doneWhen.trim();
  if (!body) { errors.push(`${at}: ${h.doneWhen} is empty`); return errors; }
  const outside = body.replace(/`[^`]*`/g, '');
  const periods = (outside.match(/\./g) ?? []).length;
  if (periods !== 1 || !body.endsWith('.') || /[?!]/.test(outside)) errors.push(`${at}: ${h.doneWhen} must be exactly one sentence: one "." outside backticks and it the last character, no "?" or "!" (found ${periods} periods)`);
  const named = doneWhenIdentifiers(body);
  if (outputKinds && !named.some((k) => outputKinds.has(k))) errors.push(`${at}: ${h.doneWhen} names no Outputs kind in backticks (backticked: ${named.join(', ') || 'none'})`);
  return errors;
}

// One operator, one job: a Done when never joins two jobs with "or". Its top-level alternatives are
// what "; or, " and " or, " separate, and every alternative after the first is a mode or shape clause
// — it opens with one of ALTERNATIVE_OPENERS (under mode apply / dry, when the direction declared a
// delta of none, for an image release). Any other alternative is a second job, and a second job is a
// second operator. Read on the English authority only; the mirror repeats its identifiers.
export const ALTERNATIVE_OPENERS = ['under mode', 'when', 'for a'];
export const doneWhenAlternatives = (text) => String(text ?? '').trim().split(/;\s*or,\s+|\s+or,\s+/);
export function checkDoneWhenAlternatives(at, op) {
  const errors = [];
  const h = HEADINGS[op.lang];
  for (const alt of doneWhenAlternatives(op.doneWhen).slice(1)) {
    if (ALTERNATIVE_OPENERS.some((o) => alt.startsWith(o))) continue;
    errors.push(`${at}: ${h.doneWhen} joins two jobs with "or, ${alt.slice(0, 48)}…"; an alternative after "; or, " or " or, " opens with ${ALTERNATIVE_OPENERS.map((o) => `"${o}"`).join(', ')} (a mode or shape clause), and a second job is a second operator`);
  }
  return errors;
}

// One artifact: operator.json → primaryOutput names exactly one kind, that kind is a row of the Outputs
// table, and the Done when sentence names it in backticks, so the receipt checked against the sentence
// is the artifact the operator exists to produce.
export function checkPrimaryOutput(jsonAt, mdAt, manifest, op, outputKinds) {
  const errors = [];
  const primary = manifest?.primaryOutput;
  if (Array.isArray(primary)) { errors.push(`${jsonAt}: primaryOutput names ${primary.length} kinds; one operator has exactly one primary output`); return errors; }
  if (typeof primary !== 'string' || !primary.trim()) { errors.push(`${jsonAt}: primaryOutput must name exactly one Outputs kind; one operator, one job, one artifact`); return errors; }
  if (!outputKinds.has(primary)) errors.push(`${jsonAt}: primaryOutput ${primary} is not a kind of the Outputs table`);
  if (!doneWhenIdentifiers(op.doneWhen).includes(primary)) errors.push(`${mdAt}: ${HEADINGS[op.lang].doneWhen} does not name the primary output \`${primary}\` in backticks`);
  return errors;
}

// The graph is closed: every required Input of every operator is produced by some other operator's
// Outputs, and every primary output is consumed — an Inputs row of another operator names it — or the
// operator is where a chain ends: a Next row hands to `user`, or it is the publish or the deploy that
// carries the boundary out of the session. A required kind nobody produces is a branch the planner can
// never feed; a primary output nobody consumes and nobody ends on is a job the tree pays for and never
// reads.
export function checkGraphClosure(packages) {
  const errors = [];
  const v9 = packages.filter((p) => p.shape === 'v9');
  const producers = new Map(); // kind -> operator ids whose Outputs table lists it
  const consumers = new Map(); // kind -> operator ids whose Inputs table lists it
  for (const p of v9) {
    for (const r of p.en.tables.outputs?.rows ?? []) { const k = kindOf(r.kind); if (!k) continue; if (!producers.has(k)) producers.set(k, new Set()); producers.get(k).add(p.manifest.id); }
    for (const r of p.en.tables.inputs?.rows ?? []) { const k = kindOf(r.kind); if (!k || k === '—') continue; if (!consumers.has(k)) consumers.set(k, new Set()); consumers.get(k).add(p.manifest.id); }
  }
  for (const p of v9) {
    const id = p.manifest.id;
    const at = `operators/${p.name}/operator.md`;
    for (const r of p.en.tables.inputs?.rows ?? []) {
      const k = kindOf(r.kind);
      if (!k || k === '—' || !isYes(r.required)) continue;
      const others = [...(producers.get(k) ?? [])].filter((x) => x !== id);
      if (!others.length) errors.push(`${at}: required input ${k} is produced by no other operator's Outputs table; the planner can never feed this branch`);
    }
    const primary = p.manifest.primaryOutput;
    if (!primary) continue;
    const readers = [...(consumers.get(primary) ?? [])].filter((x) => x !== id);
    const ends = (p.en.tables.next?.rows ?? []).some((r) => unquote(r.operator) === 'user') || [PUBLISH_OPERATOR, DEPLOY_OPERATOR].includes(id);
    if (!readers.length && !ends) errors.push(`${at}: primary output ${primary} is consumed by no Inputs table and ${id} ends no chain (no Next row hands to user, and it is neither ${PUBLISH_OPERATOR} nor ${DEPLOY_OPERATOR}); a job nobody reads is not a job`);
  }
  return errors;
}

// Every operator is reachable: starting from the operator that opens every chain, following the
// operator ids the Next tables name, every package is met. An operator no table reaches is a door the
// planner cannot open — a mission naming it plans, and validate-chain refuses the step because no Next
// table of the step before permits it (the 2.0.0 walls D1, D6 and D7 of tests/evidence).
export function checkReachability(packages, start = PREFLIGHT_OPERATOR) {
  const errors = [];
  const v9 = packages.filter((p) => p.shape === 'v9');
  const next = new Map(v9.map((p) => [p.manifest.id, (p.en.tables.next?.rows ?? []).map((r) => unquote(r.operator))]));
  if (!next.has(start)) return [`operators: no package ${start}, the operator every chain opens with`];
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) { const id = queue.shift(); for (const n of next.get(id) ?? []) if (next.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); } }
  for (const p of v9) if (!seen.has(p.manifest.id)) errors.push(`operators/${p.name}/operator.md: no Next table reaches ${p.manifest.id} from ${start}; an operator the tables reach from nowhere cannot be placed in any chain`);
  return errors;
}

export async function validateOperators(root) {
  const errors = [];
  const packages = await loadOperatorPackages(root);
  const registry = await loadErrorsRegistry(root);
  errors.push(...registry.errors);
  const kinds = await loadKindTemplates(root);
  const ids = new Set(packages.map((p) => p.manifest.id));
  let checked = 0;
  for (const pkg of packages.filter((p) => p.shape === 'v9')) {
    checked += 1;
    const id = pkg.manifest.id;
    const at = `operators/${pkg.name}/operator.md`;
    const op = pkg.en;
    if (op.id !== id) errors.push(`${at}: title ${op.id} must equal operator.json id ${id}`);
    for (const key of TABLES) if (!op.tables[key]) errors.push(`${at}: no ${key} table`);
    if (TABLES.some((k) => !op.tables[k])) continue;
    for (const legacy of ['context.md', 'input.md', 'execute.md', 'output.md', 'input.schema.json', 'output.schema.json', 'validate-input.mjs', 'validate-output.mjs', 'validation.mjs']) {
      if (existsSync(path.join(pkg.dir, legacy))) errors.push(`operators/${pkg.name}/${legacy}: an operator.md package carries no ${legacy}`);
    }
    for (const needed of ['validate.mjs', 'self-test.mjs']) if (!existsSync(path.join(pkg.dir, needed))) errors.push(`operators/${pkg.name}/${needed}: missing`);

    // Params ↔ Requirements.
    const fields = new Map(op.tables.requirements.rows.map((r) => [unquote(r.field), r]));
    const usedFields = new Set();
    for (const s of op.tables.steps.rows) for (const p of cellParams(s.params)) { usedFields.add(p); if (!fields.has(p)) errors.push(`${at}:${s._line}: step ${s.n} reads param ${p}, which Requirements does not declare`); }
    for (const [f, r] of fields) if (!usedFields.has(f)) errors.push(`${at}:${r._line}: requirement ${f} is read by no step`);

    // Steps ↔ Stops ↔ registry.
    const stops = new Map(op.tables.stops.rows.map((r) => [unquote(r.code), r]));
    const usedCodes = new Set();
    for (const s of op.tables.steps.rows) for (const c of cellCodes(s.stops)) { usedCodes.add(c); if (!stops.has(c)) errors.push(`${at}:${s._line}: step ${s.n} stops with ${c}, which the Stops table omits`); }
    for (const [c, r] of stops) {
      if (!usedCodes.has(c)) errors.push(`${at}:${r._line}: stop ${c} is emitted by no step`);
      const entry = registry.codes[c];
      if (!entry) { errors.push(`${at}:${r._line}: stop ${c} is in no errors registry`); continue; }
      if (!registry.allowed(c, id)) errors.push(`${at}:${r._line}: stop ${c} is scoped to ${entry.scope.join(', ')}, not ${id}`);
      if (r.disposition.trim() !== entry.disposition) errors.push(`${at}:${r._line}: stop ${c} says ${r.disposition.trim()} but ${entry.home} says ${entry.disposition}`);
      if (entry.unless && !fields.has(entry.unless.param)) errors.push(`${entry.home}: ${c} unless names param ${entry.unless.param}, which ${id} does not declare`);
    }
    for (const [c, e] of Object.entries(registry.codes)) if (e.scope.length === 1 && e.scope[0] === id && !stops.has(c)) errors.push(`${e.home}: ${c} is defined for ${id} but its Stops table omits it`);
    if (!cellCodes(op.tables.steps.rows[0]?.stops ?? '').includes('INVALID_INPUT')) errors.push(`${at}: step 1 must be the gate and stop with INVALID_INPUT`);
    if (!cellFiles(op.tables.steps.rows[0]?.reads ?? '').length && !/request\/request\.json/.test(op.tables.steps.rows[0]?.reads ?? '')) errors.push(`${at}: step 1 must read request/request.json`);

    // Done when ↔ Outputs ↔ primaryOutput: one sentence, one job, one artifact.
    const outputKinds = new Set(op.tables.outputs.rows.map((r) => kindOf(r.kind)));
    errors.push(...checkDoneWhen(at, op, outputKinds));
    errors.push(...checkDoneWhenAlternatives(at, op));
    errors.push(...checkPrimaryOutput(`operators/${pkg.name}/operator.json`, at, pkg.manifest, op, outputKinds));

    // Writes ↔ Outputs ↔ templates/kinds.
    const outputs = new Map();
    for (const r of op.tables.outputs.rows) {
      const kind = kindOf(r.kind); const file = unquote(r.file); const type = r.type.trim();
      if (outputs.has(kind)) errors.push(`${at}:${r._line}: output ${kind} is declared twice`);
      outputs.set(kind, { ...r, file, type });
      const inResponse = /^(?:[a-z][a-z-]*\/)?response\//.test(file);
      if (!inResponse) errors.push(`${at}:${r._line}: output ${kind} must live under response/ or <exchange>/response/`);
      if (type === 'md') { if (!kinds.has(kind)) errors.push(`${at}:${r._line}: output ${kind} is md but templates/kinds/${kind}.contract.json is missing`); if (!file.endsWith('.md')) errors.push(`${at}:${r._line}: md output ${kind} must be a .md file`); }
      if (type === 'data') { if (!existsSync(path.join(root, 'templates', 'kinds', `${kind}.schema.json`))) errors.push(`${at}:${r._line}: output ${kind} is data but templates/kinds/${kind}.schema.json is missing`); if (!/\/data\/.+\.json$/.test(file)) errors.push(`${at}:${r._line}: data output ${kind} must live under response/data/ as .json`); }
      if (type === 'artifact' && !/\/artifacts\//.test(file)) errors.push(`${at}:${r._line}: artifact output ${kind} must live under response/artifacts/`);
    }
    // A Steps row states the job; the Outputs table is where a file's path lives. A row may therefore
    // name what it writes by output kind (`candidates`, `verdicts`) and the path resolves through the
    // Outputs table, or spell the path itself; both count as writing the file. response/response.json
    // is the routing gate, not an output, and is always named as itself.
    const writesOf = (step) => {
      const files = new Set(cellFiles(step.writes));
      for (const m of step.writes.matchAll(/`([a-z][a-z0-9-]*)`/g)) { const o = outputs.get(m[1]); if (o) files.add(o.file); }
      return files;
    };
    const written = new Set();
    for (const s of op.tables.steps.rows) for (const f of writesOf(s)) written.add(f);
    const outputFiles = new Set([...outputs.values()].map((o) => o.file));
    for (const f of written) if (f !== 'response/response.json' && !outputFiles.has(f) && !exchangeOf(f)) errors.push(`${at}: a step writes ${f}, which Outputs does not declare`);
    for (const f of outputFiles) if (!written.has(f) && !exchangeOf(f)) errors.push(`${at}: output ${f} is written by no step`);
    if (!written.has('response/response.json')) errors.push(`${at}: no step writes response/response.json`);

    // Nested exchanges: an Output under <exchange>/response/ needs one step that waits for it and reads it.
    for (const ex of new Set([...outputFiles].map(exchangeOf).filter(Boolean))) {
      const waiting = op.tables.steps.rows.filter((s) => /response\/response\.json/.test(s.writes) && /waiting/.test(s.writes) && s.reads.includes(`${ex}/response/`));
      if (waiting.length !== 1) errors.push(`${at}: exchange ${ex} needs exactly one step that writes response/response.json (waiting) and reads ${ex}/response/…, found ${waiting.length}`);
      for (const s of op.tables.steps.rows) for (const f of cellFiles(s.writes)) if (exchangeOf(f) === ex) errors.push(`${at}:${s._line}: step ${s.n} writes ${f}; only the exchange's own agent writes under ${ex}/response/`);
    }

    // Inputs ↔ templates/kinds; Next ↔ operators.
    for (const r of op.tables.inputs.rows) {
      const kind = kindOf(r.kind);
      if (kind === '—' || kind === '') continue;
      if (!kinds.has(kind) && !existsSync(path.join(root, 'templates', 'kinds', `${kind}.schema.json`))) errors.push(`${at}:${r._line}: input ${kind} has no contract or schema under templates/kinds`);
    }
    // Next may hand to another operator, or end automation the way routing.json does: `user` (a person
    // decides or publishes) or `external` (the blocker is outside the runtime).
    for (const r of op.tables.next.rows) { const target = unquote(r.operator); if (!ids.has(target) && target !== 'user' && target !== 'external') errors.push(`${at}:${r._line}: next names unknown operator ${target}`); }

    // en ↔ vi.
    if (!pkg.vi) { errors.push(`operators/${pkg.name}/operator.vi.md: missing`); continue; }
    const vi = pkg.vi;
    const viAt = `operators/${pkg.name}/operator.vi.md`;
    if (vi.id !== id) errors.push(`${viAt}: title must be ${id}`);
    const viDone = checkDoneWhen(viAt, vi, null);
    errors.push(...viDone);
    if (!viDone.length && doneWhenIdentifiers(vi.doneWhen).join() !== doneWhenIdentifiers(op.doneWhen).join()) errors.push(`${viAt}: ${HEADINGS.vi.doneWhen} backticked identifiers (${doneWhenIdentifiers(vi.doneWhen).join(', ')}) differ from English (${doneWhenIdentifiers(op.doneWhen).join(', ')})`);
    for (const key of TABLES) {
      const a = op.tables[key]; const b = vi.tables[key];
      if (!b) { errors.push(`operators/${pkg.name}/operator.vi.md: no ${key} table`); continue; }
      if (a.rows.length !== b.rows.length) { errors.push(`operators/${pkg.name}/operator.vi.md: ${key} has ${b.rows.length} rows, English has ${a.rows.length}`); continue; }
      const firstKey = { context: 'alias', inputs: 'kind', requirements: 'field', steps: 'n', outputs: 'kind', stops: 'code', next: 'operator' }[key];
      a.rows.forEach((ra, i) => {
        const rb = b.rows[i];
        if (unquote(ra[firstKey]) !== unquote(rb[firstKey])) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: ${key} row ${i + 1} is ${unquote(rb[firstKey])}, English has ${unquote(ra[firstKey])}`);
        if (key === 'steps') {
          if (cellCodes(ra.stops).join() !== cellCodes(rb.stops).join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} stop codes differ from English`);
          if (cellParams(ra.params).join() !== cellParams(rb.params).join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} params differ from English`);
          if ([...writesOf(ra)].join() !== [...writesOf(rb)].join()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: step ${ra.n} writes differ from English`);
        }
        if (key === 'stops' && ra.disposition.trim() !== rb.disposition.trim()) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: ${unquote(ra.code)} disposition differs from English`);
        if (key === 'outputs' && (ra.type.trim() !== rb.type.trim() || unquote(ra.file) !== unquote(rb.file))) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: output ${unquote(ra.kind)} file or type differs from English`);
        if (key === 'requirements' && unquote(ra.default) !== unquote(rb.default)) errors.push(`operators/${pkg.name}/operator.vi.md:${rb._line}: requirement ${unquote(ra.field)} default differs from English`);
      });
    }
  }
  errors.push(...checkGraphClosure(packages));
  errors.push(...checkReachability(packages));
  return { errors, checked, total: packages.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, checked, total } = await validateOperators(root);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`operators closed: ${checked} operator.md packages of ${total}\n`);
}
