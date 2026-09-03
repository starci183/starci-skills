// uat.verify's own law over one branch, on top of the shared step check: a person asked for the run;
// both admissions are present and taken at the pinned commit; the snapshot froze the requested cases
// in a contiguous order; every frozen case has a capture and a screenshot; the verdicts carry exactly
// the three independent lanes; the published result carries the pinned commit; cleanup deletes the run
// namespace and never a run record; the run history is append-only; and no capture, snapshot, verdict
// or published sentence contains the password. Masking is proved, not promised: the chosen placeholder
// for the shared UAT password may appear nowhere this operator writes.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANES = ['behavior', 'ux', 'ui'];
const ADMISSIONS = ['frontend-surface-audit', 'quality-verification'];
// The password placeholder this operator's self-test injects, plus any inline assignment of one. The
// shared UAT password is resolved by name at login; a run that wrote it anywhere failed its custody.
export const PASSWORD_LEAK = /uat-shared-password|password\s*[:=]\s*\S/i;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

export async function validateUatStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'uat.verify') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const decided = response.status === 'done';

  // UAT is never routine: a run exists because a person asked for it, and the run identifier and the
  // exclusive lease arrive from the orchestrator rather than from a person.
  if (decided && empty(requirements.requestedBy)) errors.push('request.json: UAT runs only when a person asked; requestedBy has no value');
  if (decided && empty(requirements.runId)) errors.push('request.json: the orchestrator supplies runId; a decided run cannot namespace its records without one');
  if (decided && empty(requirements.lease)) errors.push('request.json: the orchestrator supplies the exclusive lease; a decided run cannot write the flow directory without one');

  const pinned = (request?.contexts ?? []).find((c) => c.alias === '@workspaces/be')?.head ?? null;

  // A branch that never froze a snapshot is judged on its admissions too: the code that names the
  // missing receipt is the one whose resume instruction is right for a person, and it must be
  // reachable on the branch that blocked before any snapshot existed.
  for (const kind of ADMISSIONS) {
    if (request?.inputs?.[kind] === undefined) errors.push(`request.json: ADMISSION_MISSING — input ${kind} is absent`);
  }

  let snapshot = null;
  if (present.has('uat-snapshot') && has('response/data/snapshot.json')) {
    try { snapshot = JSON.parse(await read('response/data/snapshot.json')); } catch { snapshot = null; }
  } else if (decided) errors.push('response/data/snapshot.json: a done branch needs the frozen snapshot');
  let verdicts = null;
  if (present.has('uat-verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  } else if (decided) errors.push('response/data/verdicts.json: a done branch needs the three lane verdicts');

  if (snapshot) {
    if (!empty(requirements.feature) && snapshot.feature !== requirements.feature) errors.push('response/data/snapshot.json: the snapshot names another feature');
    if (!empty(requirements.flow) && snapshot.flow !== requirements.flow) errors.push('response/data/snapshot.json: the snapshot names another flow');
    if (!empty(requirements.runId) && snapshot.runId !== requirements.runId) errors.push('response/data/snapshot.json: the snapshot names another runId');
    if (!empty(requirements.requestedBy) && snapshot.requestedBy !== requirements.requestedBy) errors.push('response/data/snapshot.json: the snapshot names another requester than the person who asked');
    if (snapshot.fixtureNamespace !== `uat-${snapshot.runId}`) errors.push(`response/data/snapshot.json: the fixture namespace must be uat-${snapshot.runId}, so cleanup can name exactly what this run wrote`);
    if (snapshot.seed.namespace !== snapshot.fixtureNamespace) errors.push('response/data/snapshot.json: the seed namespace must equal the run fixture namespace');
    if (pinned !== null && snapshot.commit !== pinned) errors.push(`response/data/snapshot.json: the snapshot froze commit ${snapshot.commit} but the request pinned @workspaces/be at ${pinned}`);
    if (!snapshot.snapshotRef.startsWith(`.worktrees/uat/${snapshot.feature}/${snapshot.flow}/`)) errors.push('response/data/snapshot.json: the snapshot path must address this feature and flow');

    // Admission: both receipts, both at the pinned head, both the files the request handed in.
    const byKind = new Map(snapshot.admission.map((a) => [a.kind, a]));
    for (const kind of ADMISSIONS) {
      const entry = byKind.get(kind);
      if (!entry) { errors.push(`response/data/snapshot.json: ADMISSION_MISSING — ${kind} is absent from the admission record`); continue; }
      if (entry.commit !== snapshot.commit) errors.push(`response/data/snapshot.json: ADMISSION_MISSING — ${kind} was taken at ${entry.commit}, not at the pinned commit ${snapshot.commit}`);
      const given = request?.inputs?.[kind];
      if (given !== undefined && entry.ref !== given) errors.push(`response/data/snapshot.json: ${kind} admits ${entry.ref}, but the request handed in ${given}`);
    }

    // The frozen order is declared in advance, not discovered while running.
    const ids = snapshot.cases.map((c) => c.caseId);
    if (new Set(ids).size !== ids.length) errors.push('response/data/snapshot.json: the snapshot freezes the same case twice');
    [...snapshot.cases].map((c) => c.order).sort((a, b) => a - b).forEach((order, i) => {
      if (order !== i + 1) errors.push('response/data/snapshot.json: the frozen cases must carry a contiguous order starting at 1');
    });
    const asked = asList(requirements.cases).map(String);
    if (asked.length) {
      for (const c of asked) if (!ids.includes(c)) errors.push(`response/data/snapshot.json: requested case ${c} was never frozen`);
      for (const c of ids) if (!asked.includes(c)) errors.push(`response/data/snapshot.json: case ${c} was frozen but the request did not ask for it`);
    }

    // Every frozen case leaves both kinds of evidence, and every registered artifact belongs to a case.
    const captureFiles = new Set(asList(response.fields?.['uat-capture']));
    const shots = new Set(asList(response.fields?.screenshot));
    if (decided) {
      for (const c of snapshot.cases) {
        const capture = `response/data/captures/${c.caseId}.json`;
        const shot = `response/artifacts/${c.caseId}.png`;
        if (!captureFiles.has(capture)) errors.push(`response/response.json: case ${c.caseId} has no capture registered at ${capture}`);
        if (!shots.has(shot)) errors.push(`response/response.json: case ${c.caseId} has no screenshot registered at ${shot}`);
      }
      for (const f of captureFiles) if (!ids.some((id) => f === `response/data/captures/${id}.json`)) errors.push(`response/response.json: the capture ${f} belongs to no frozen case`);
      for (const f of shots) if (!ids.some((id) => f === `response/artifacts/${id}.png`)) errors.push(`response/response.json: the screenshot ${f} belongs to no frozen case`);
    }

    const frozenById = new Map(snapshot.cases.map((c) => [c.caseId, c]));
    for (const f of captureFiles) {
      if (!has(f)) continue;
      let capture; try { capture = JSON.parse(await read(f)); } catch { continue; }
      const frozen = frozenById.get(capture.caseId);
      if (!frozen) { errors.push(`${f}: case ${capture.caseId} was captured without being frozen into the snapshot`); continue; }
      if (capture.order !== frozen.order) errors.push(`${f}: case ${capture.caseId} was executed out of its frozen order`);
      if (!empty(snapshot.runId) && capture.runId !== snapshot.runId) errors.push(`${f}: the capture belongs to run ${capture.runId}, not ${snapshot.runId}`);
      if (capture.screenshotRef !== `response/artifacts/${capture.caseId}.png`) errors.push(`${f}: the capture must point at its own case screenshot`);
      if (Date.parse(capture.executedAt) <= Date.parse(snapshot.frozenAt)) errors.push(`${f}: case ${capture.caseId} executed at or before the snapshot freeze`);
      const seen = new Set(capture.assertions.map((a) => a.assertionId));
      for (const a of frozen.assertions) if (!seen.has(a)) errors.push(`${f}: the frozen assertion ${a} was never observed`);
      for (const a of capture.assertions) if (!frozen.assertions.includes(a.assertionId)) errors.push(`${f}: the assertion ${a.assertionId} was never frozen`);
    }
  }

  if (verdicts) {
    const names = verdicts.lanes.map((l) => l.lane);
    for (const lane of LANES) if (!names.includes(lane)) errors.push(`response/data/verdicts.json: the ${lane} lane is missing; the three lanes are judged apart and all three are published`);
    for (const name of names) if (!LANES.includes(name)) errors.push(`response/data/verdicts.json: ${name} is not one of the three lanes`);
    if (new Set(names).size !== names.length) errors.push('response/data/verdicts.json: a lane may report at most one verdict');
    if (snapshot) {
      if (verdicts.runId !== snapshot.runId) errors.push('response/data/verdicts.json: the result belongs to another run than the snapshot');
      if (verdicts.commit !== snapshot.commit) errors.push(`response/data/verdicts.json: the result carries commit ${verdicts.commit} but the run was pinned at ${snapshot.commit}`);
      if (verdicts.resultRef !== `${snapshot.snapshotRef.replace(/snapshot\.json$/, '')}runs/${snapshot.runId}/result.json`) errors.push('response/data/verdicts.json: the result must be appended under runs/<runId>/ of this flow directory');
      if (verdicts.latestRef !== `${snapshot.snapshotRef.replace(/snapshot\.json$/, '')}latest`) errors.push('response/data/verdicts.json: latest must be the pointer of this flow directory');
      if (verdicts.cleanup.namespace !== snapshot.fixtureNamespace) errors.push('response/data/verdicts.json: cleanup must name the exact run fixture namespace and nothing wider');
    }
    if (pinned !== null && verdicts.commit !== pinned) errors.push(`response/data/verdicts.json: the result commit ${verdicts.commit} is not the pinned head ${pinned}`);
    if (decided && !verdicts.cleanup.performed) errors.push('response/data/verdicts.json: a decided run cleans its own namespace before it publishes');

    const failing = verdicts.lanes.filter((l) => l.verdict === 'fail').map((l) => l.lane);
    const next = new Set(response.next ?? []);
    if (decided && !failing.length && !next.has('git.publish')) errors.push('response/response.json: all three lanes pass, so the run hands to git.publish');
    if (decided && failing.includes('behavior') && !next.has('backend.source.apply')) errors.push('response/response.json: the behaviour lane failed, so the run hands to backend.source.apply');
    if (decided && failing.includes('ux') && !next.has('user')) errors.push('response/response.json: a UX failure is a question of intent; it hands to a person, and the flow is verified again only after that decision');
    if (decided && failing.length && next.has('git.publish')) errors.push('response/response.json: a failing lane cannot hand to git.publish');
  }

  if (present.has('uat-flow-verification') && has('response/response.md')) {
    const text = await read('response/response.md');
    const snap = Object.fromEntries((tableUnder(text, '## Snapshot') ?? []).map(([k, v]) => [k, v]));
    if (snapshot) {
      if (snap.Run !== snapshot.runId) errors.push(`response/response.md: Snapshot names run ${snap.Run}, the frozen snapshot names ${snapshot.runId}`);
      if (snap.Feature !== snapshot.feature) errors.push('response/response.md: Snapshot names another feature');
      if (snap.Flow !== snapshot.flow) errors.push('response/response.md: Snapshot names another flow');
      if (snap.Commit !== snapshot.commit) errors.push('response/response.md: Snapshot names another commit than the frozen one');
      if (snap.Namespace !== snapshot.fixtureNamespace) errors.push('response/response.md: Snapshot names another fixture namespace');
      if (snap['Requested by'] !== snapshot.requestedBy) errors.push('response/response.md: Snapshot names another requester');
      const admission = tableUnder(text, '## Admission') ?? [];
      for (const [kind, ref, commit] of admission) {
        const entry = snapshot.admission.find((a) => a.kind === kind);
        if (!entry) { errors.push(`response/response.md: Admission names ${kind}, which the snapshot did not record`); continue; }
        if (entry.ref !== ref || entry.commit !== commit) errors.push(`response/response.md: the ${kind} admission differs from the frozen record`);
      }
      const cases = tableUnder(text, '## Cases') ?? [];
      if (cases.length !== snapshot.cases.length) errors.push(`response/response.md: Cases has ${cases.length} rows, the snapshot froze ${snapshot.cases.length}`);
    }
    if (verdicts) {
      const lanes = tableUnder(text, '## Lanes') ?? [];
      for (const [lane, verdict] of lanes) {
        const entry = verdicts.lanes.find((l) => l.lane === lane);
        if (!entry) { errors.push(`response/response.md: Lanes names ${lane}, which the verdicts do not`); continue; }
        if (entry.verdict !== verdict) errors.push(`response/response.md: the ${lane} lane reads ${verdict} but the verdicts say ${entry.verdict}`);
      }
    }
  } else if (decided) errors.push('response/response.md: a done branch needs the verification receipt');

  // Custody is proved on the written bytes, not asserted in prose.
  const scanned = ['response/response.md', 'response/response.json', 'response/data/snapshot.json', 'response/data/verdicts.json', ...asList(response.fields?.['uat-capture'])];
  for (const f of scanned) {
    if (!has(f)) continue;
    if (PASSWORD_LEAK.test(await read(f))) errors.push(`${f}: the shared UAT password appears in a file this operator writes; the credential is resolved by name at login and is never recorded`);
  }

  // The run history is append-only: a run folder that exists already is never rewritten.
  if (snapshot && verdicts && existsSync(snapshot.flowRoot)) {
    const runDir = path.join(snapshot.flowRoot, 'runs', snapshot.runId);
    const resultFile = path.join(runDir, 'result.json');
    if (existsSync(resultFile)) {
      let recorded = null;
      try { recorded = JSON.parse(await readFile(resultFile, 'utf8')); } catch { recorded = null; }
      if (recorded === null) errors.push(`${snapshot.snapshotRef.replace(/snapshot\.json$/, '')}runs/${snapshot.runId}/result.json: the existing run record cannot be read, and a run record is never overwritten`);
      else {
        const same = recorded.runId === verdicts.runId && recorded.commit === verdicts.commit
          && JSON.stringify(recorded.lanes) === JSON.stringify(verdicts.lanes);
        if (!same) errors.push(`runs/${snapshot.runId}: a run record already exists with a different result; runs are append-only, so a second attempt is a new runId`);
      }
    } else if (decided) errors.push(`runs/${snapshot.runId}: a decided run appends its record under runs/<runId>/ before it emits`);
    const latestFile = path.join(snapshot.flowRoot, 'latest');
    if (decided && existsSync(latestFile)) {
      const latest = (await readFile(latestFile, 'utf8')).trim();
      if (latest !== snapshot.runId) errors.push(`latest: points at ${latest}, but this run published ${snapshot.runId}`);
    }
  }

  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateUatStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid uat.verify branch\n');
}
