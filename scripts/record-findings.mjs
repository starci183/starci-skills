// The findings ledger, written: `node scripts/record-findings.mjs <session>/step-N/parallel-M` reads
// the validated receipt of a done interface.audit or uat.verify branch, derives one finding per
// failure its verdicts carry, appends to knowledge/findings/<family>.jsonl the lines the ledger does
// not hold yet (a finding's id is derived from what it is about, so recording a receipt twice appends
// nothing), closes the open findings of the same surface and unit that this receipt judged again and
// found passing (a second line with the same id and `fixed` naming this branch; no line is ever
// edited), and materializes the ledger's open lines for the surfaces this branch observed as
// response/data/findings.json beside the receipt, in the findings kind — the file the next
// interface.generate of that surface binds as inputs.findings. knowledge/findings/INDEX.md states
// the law; scripts/validate-session.mjs#findingsLedgerErrors refuses a session whose done audit or
// walk carries a failure the ledger does not hold. The orchestrator runs this at the transition that
// accepts the receipt; an isolated agent never reaches the ledger.
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateAgainst } from './json-schema.mjs';
import { sessionRootOf, hostRootOf } from './validate-request.mjs';
import { tableUnder } from './validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LEDGER_DIR = path.join('knowledge', 'findings');
export const FINDINGS_SCHEMA = path.join('templates', 'kinds', 'findings.schema.json');
export const MATERIALIZED = path.join('response', 'data', 'findings.json');
// The operators whose receipts feed the ledger: the one that measures a surface and the one that walks it.
export const LEDGER_OPERATORS = new Set(['interface.audit', 'uat.verify']);
const GRAMMAR_ALIAS = /^@knowledge\/grammars\/([a-z][a-z0-9-]*)$/;

async function readJson(file) { if (!existsSync(file)) return null; try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
const branchOf = (dir) => { const m = /step-(\d+)[\\/]parallel-(\d+)$/.exec(path.resolve(dir)); return m ? `${m[1]}/${m[2]}` : null; };
// A code is where a failure routed, in UPPER_SNAKE; a route of `none` is no code.
const codeOf = (routeTo) => (routeTo && routeTo !== 'none' ? String(routeTo).toUpperCase().replace(/-/g, '_') : null);
const severityOf = (routeTo) => (routeTo && routeTo !== 'none' ? 'blocking' : 'accepted');
// The node a statement opens with: everything before the first ": ", which is how a later receipt
// judging the same node again is matched to the finding it closes.
export const nodeOf = (statement) => String(statement ?? '').split(': ')[0];
export const keyOf = (line) => `${line.surface}|${line.unit}|${line.rule ?? ''}|${nodeOf(line.statement)}`;
export function findingId({ family, session, branch, operator, surface, unit, rule, code, statement }) {
  const digest = createHash('sha256').update(JSON.stringify([family, session, branch, operator, surface, unit, rule ?? null, code ?? null, nodeOf(statement)])).digest('hex');
  return `f${digest.slice(0, 12)}`;
}

// The grammar family a branch's findings belong to: the family the request binds as
// @knowledge/grammars/<family>, else the grammarId of the hydrated route the request's route input
// names; null when neither says.
export async function familyOf(sessionRoot, request, { hostRoot = null } = {}) {
  for (const c of request?.contexts ?? []) { const m = GRAMMAR_ALIAS.exec(String(c.alias ?? '')); if (m) return m[1]; }
  const routeRef = request?.inputs?.route;
  if (!routeRef || !sessionRoot) return null;
  const route = await readJson(path.join(sessionRoot, routeRef));
  const ref = route?.hydratedRouteRef;
  if (typeof ref !== 'string' || !ref) return null;
  const candidates = [path.isAbsolute(ref) ? ref : null, hostRoot ? path.join(hostRoot, ref) : null, path.join(sessionRoot, ref)].filter(Boolean);
  for (const file of candidates) { const hydrated = await readJson(file); const id = hydrated?.context?.grammarId; if (typeof id === 'string' && id) return id; }
  return null;
}

// What one done branch found: `lines` are the findings its verdicts carry (without ids resolved
// against any ledger), `passing` the keys of what it judged and found passing (what a later run may
// close), `surfaces` and `units` what it observed. Returns null when the branch carries no verdicts.
export async function extractFindings(branchDir, { root = ROOT, hostRoot = hostRootOf(root), now = new Date().toISOString() } = {}) {
  const sessionRoot = sessionRootOf(branchDir);
  const request = await readJson(path.join(branchDir, 'request', 'request.json'));
  const response = await readJson(path.join(branchDir, 'response', 'response.json'));
  const verdicts = await readJson(path.join(branchDir, 'response', 'data', 'verdicts.json'));
  if (!request || !response || !verdicts) return null;
  const operator = response.operatorId ?? request.operatorId;
  if (!LEDGER_OPERATORS.has(operator)) throw new Error(`${branchOf(branchDir)}: ${operator} feeds no ledger; only ${[...LEDGER_OPERATORS].join(' and ')} do`);
  const branch = branchOf(branchDir);
  const session = request.sessionId ?? null;
  const family = await familyOf(sessionRoot, request, { hostRoot });
  const base = { at: now, session, branch, operator, family, fixed: null };
  const lines = [];
  const passing = new Set();
  const surfaces = new Set();
  const units = new Map(); // surface -> Set(unit)
  const observe = (surface, unit) => { surfaces.add(surface); if (!units.has(surface)) units.set(surface, new Set()); units.get(surface).add(unit); };
  const add = (partial) => lines.push({ ...base, ...partial });

  if (operator === 'interface.audit') {
    const surfaceOf = new Map();
    for (const s of verdicts.auditScope?.surfaces ?? []) for (const m of s.matrixIds ?? []) surfaceOf.set(m, s.id);
    for (const entry of verdicts.entries ?? []) {
      const surface = surfaceOf.get(entry.matrixId) ?? entry.matrixId;
      const unit = entry.matrixId;
      observe(surface, unit);
      for (const r of entry.results ?? []) {
        const statement = `${r.path}: ${r.measured}`;
        if (r.verdict === 'fail') add({ surface, unit, rule: r.rule, code: codeOf(r.routeTo), statement, severity: severityOf(r.routeTo) });
        else passing.add(`${surface}|${unit}|${r.rule}|${r.path}`);
      }
      for (const t of entry.taste?.entries ?? []) {
        const statement = `${t.rule}: ${t.measured}`;
        if (t.verdict === 'fail') add({ surface, unit, rule: t.rule, code: codeOf(t.routeTo), statement, severity: severityOf(t.routeTo) });
        else if (t.verdict === 'pass') passing.add(`${surface}|${unit}|${t.rule}|${t.rule}`);
      }
    }
  } else {
    const snapshot = await readJson(path.join(branchDir, 'response', 'data', 'snapshot.json'));
    const surface = snapshot ? `${snapshot.feature}/${snapshot.flow}` : (verdicts.runId ?? 'run');
    const RUN = 'run';
    observe(surface, RUN);
    const caseOf = (refs) => { for (const ref of refs ?? []) { const m = /captures\/([a-z0-9][a-z0-9-]*)\.json$/.exec(String(ref)); if (m) return m[1]; } return RUN; };
    for (const lane of verdicts.lanes ?? []) {
      const unit = caseOf(lane.evidenceRefs);
      observe(surface, unit);
      const statement = `${lane.lane}: ${lane.statement}`;
      if (lane.verdict === 'fail') add({ surface, unit, rule: null, code: `LANE_${String(lane.lane).toUpperCase()}`, statement, severity: 'blocking' });
      else passing.add(`${surface}|${unit}||${lane.lane}`);
    }
    for (const e of verdicts.experience?.entries ?? []) {
      const statement = `${e.rule}: ${e.measured}`;
      if (e.verdict === 'fail') add({ surface, unit: RUN, rule: e.rule, code: codeOf(e.routeTo), statement, severity: severityOf(e.routeTo) });
      else if (e.verdict === 'pass') passing.add(`${surface}|${RUN}|${e.rule}|${e.rule}`);
    }
    for (const c of snapshot?.cases ?? []) {
      const capture = await readJson(path.join(branchDir, 'response', 'data', 'captures', `${c.caseId}.json`));
      if (!capture) continue;
      observe(surface, c.caseId);
      for (const a of capture.assertions ?? []) {
        const statement = `${a.assertionId}: ${a.observed}`;
        if (a.outcome === 'fail') add({ surface, unit: c.caseId, rule: null, code: 'ASSERTION_FAIL', statement, severity: 'blocking' });
        else passing.add(`${surface}|${c.caseId}||${a.assertionId}`);
      }
    }
    const receipt = path.join(branchDir, 'response', 'response.md');
    if (existsSync(receipt)) {
      for (const [code, statement] of tableUnder(await readFile(receipt, 'utf8'), '## Findings') ?? []) {
        if (!code) continue;
        add({ surface, unit: RUN, rule: null, code: String(code).replace(/`/g, ''), statement: `${String(code).replace(/`/g, '')}: ${statement}`, severity: 'blocking' });
      }
    }
  }
  for (const line of lines) line.id = findingId(line);
  return { operator, family, session, branch, surfaces: [...surfaces], units, lines, passing };
}

// The ledger of one family: every line as written, and the newest line per id.
export async function readLedger(file) {
  const lines = [];
  if (existsSync(file)) {
    for (const raw of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const text = raw.trim();
      if (!text) continue;
      try { lines.push(JSON.parse(text)); } catch { throw new Error(`${file}: a line is not JSON`); }
    }
  }
  const latest = new Map();
  for (const line of lines) latest.set(line.id, line);
  return { lines, latest };
}
export const openLines = (ledger) => [...ledger.latest.values()].filter((l) => l.fixed === null);

export async function loadFindingsSchema(root = ROOT) { return JSON.parse(await readFile(path.join(root, FINDINGS_SCHEMA), 'utf8')); }
export function lineErrors(schema, line, at) { return validateAgainst({ ...schema, ...schema.$defs.line }, line, at); }

export async function recordFindings(branchDir, { root = ROOT, ledgerDir = path.join(root, LEDGER_DIR), hostRoot = hostRootOf(root), now = new Date().toISOString(), validate = true } = {}) {
  branchDir = path.resolve(branchDir);
  const response = await readJson(path.join(branchDir, 'response', 'response.json'));
  if (!response) throw new Error(`${branchDir}: no response.json; the ledger records accepted receipts only`);
  if (response.status !== 'done') throw new Error(`${branchOf(branchDir)}: the branch is ${response.status}, not done; the ledger records accepted receipts only`);
  if (validate) {
    const pkgDir = { 'interface.audit': 'interface-audit', 'uat.verify': 'uat-verify' }[response.operatorId];
    if (!pkgDir) throw new Error(`${branchOf(branchDir)}: ${response.operatorId} feeds no ledger`);
    const mod = await import(pathToFileURL(path.join(root, 'operators', pkgDir, 'validate.mjs')).href);
    const fn = mod.validateAuditStep ?? mod.validateUatStep;
    const { errors } = await fn(branchDir, root);
    if (errors.length) throw new Error(`${branchOf(branchDir)}: the receipt does not validate, so nothing is recorded:\n${errors.join('\n')}`);
  }
  const found = await extractFindings(branchDir, { root, hostRoot, now });
  if (!found) throw new Error(`${branchOf(branchDir)}: no verdicts to record`);
  if (!found.family) throw new Error(`${branchOf(branchDir)}: the family is unresolved — the request binds no @knowledge/grammars/<family> and the route input names no hydrated route with a grammarId — so there is no ledger to write`);
  const schema = await loadFindingsSchema(root);
  const file = path.join(ledgerDir, `${found.family}.jsonl`);
  const ledger = await readLedger(file);
  const fixedBy = `${found.session}:${found.branch}`;
  const toAppend = [];
  for (const line of found.lines) {
    if (ledger.latest.has(line.id)) continue;
    const errors = lineErrors(schema, line, `finding ${line.id}`);
    if (errors.length) throw new Error(errors.join('\n'));
    toAppend.push(line);
  }
  // Closure: an open finding of a surface and unit this branch observed, whose node this branch
  // judged again and found passing, is closed by a second line naming this branch.
  const failingKeys = new Set(found.lines.map(keyOf));
  for (const open of openLines(ledger)) {
    if (open.family !== found.family || !found.units.has(open.surface) || !found.units.get(open.surface).has(open.unit)) continue;
    const key = keyOf(open);
    if (failingKeys.has(key) || !found.passing.has(key)) continue;
    toAppend.push({ ...open, at: now, fixed: fixedBy });
  }
  if (toAppend.length) {
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, toAppend.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
  const after = await readLedger(file);
  const surfaces = new Set(found.surfaces);
  const materialized = { schemaVersion: 9, family: found.family, surfaces: [...surfaces], lines: openLines(after).filter((l) => surfaces.has(l.surface)) };
  const errors = validateAgainst(schema, materialized, MATERIALIZED);
  if (errors.length) throw new Error(errors.join('\n'));
  const out = path.join(branchDir, MATERIALIZED);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(materialized, null, 2) + '\n');
  return { family: found.family, file, appended: toAppend.filter((l) => l.fixed === null).length, closed: toAppend.filter((l) => l.fixed !== null).length, materialized: out, open: materialized.lines.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/record-findings.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  recordFindings(target).then((r) => {
    process.stdout.write(`findings: ${r.appended} appended, ${r.closed} closed in ${path.relative(ROOT, r.file).split(path.sep).join('/')}; ${r.open} open for the observed surfaces materialized at ${path.relative(process.cwd(), r.materialized).split(path.sep).join('/')}\n`);
  }, (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
