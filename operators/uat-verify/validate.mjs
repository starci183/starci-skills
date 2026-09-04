// uat.verify's own law over one branch, on top of the shared step check: the run's authority is
// covered — an approval id, or the environment declaration's reference where it marks the run's own
// classes declared; both admissions are present and taken at the pinned commit; the snapshot froze
// the requested cases in a contiguous order; every frozen case has a capture and a screenshot; the
// verdicts carry exactly the three independent lanes; the published result carries the pinned commit;
// cleanup deletes the run namespace and never a run record; the run history is append-only; and no
// capture, snapshot, verdict or published sentence contains the password. Masking is proved, not
// promised: the chosen placeholder for the shared UAT password may appear nowhere this operator
// writes. A walk is evidence only for what it pressed: the shared step check already refuses a
// capture whose assertion names no surface control (templates/kinds/uat-capture.schema.json), which
// is the whole enforcement — no code here re-derives it.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { PASSWORD_LEAK } from '../../scripts/sweep-secrets.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { auditScopeCarryErrors, upstreamAuditScope } from '../../scripts/audit-scope.mjs';
import { hostRootOf, sessionRootOf, missingStack, loadEnvironmentSchema, parseDeclarationReference, stackDeclaration } from '../../scripts/validate-request.mjs';
import { validateWalkFile, stepControl } from '../../scripts/validate-walk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// What this run itself writes: seeding the frozen records and signing in as the flow's dedicated
// account. Provisioning the account is identity.provision's own job and is not asked here.
export const UAT_CLASSES = ['seed', 'identity-provisioning'];
const LANES = ['behavior', 'ux', 'ui'];
// knowledge/ui/proof/ux.md: UX-1..UX-11 are the scored criteria and UX-12 is the arithmetic over
// them. `ship` needs no failure on the five criteria that strand a person mid-task, and a mean of at
// least 4; anything else is `fix-first`. The gate carries the shape, never a second copy of the law.
export const UX_RULES = Array.from({ length: 11 }, (_, i) => `UX-${i + 1}`);
const UX_GATES = new Set(['UX-1', 'UX-3', 'UX-4', 'UX-6', 'UX-7']);
export function uxVerdict(rows) {
  const mean = rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length;
  const gated = rows.some((r) => r.verdict === 'fail' && UX_GATES.has(r.rule));
  return { mean, verdict: !gated && mean >= 4 ? 'ship' : 'fix-first' };
}
const sectionText = (text, heading) => {
  const lines = text.split(/\r?\n/);
  const from = lines.findIndex((l) => l.trimEnd() === heading);
  if (from === -1) return '';
  const rest = lines.slice(from + 1);
  const next = rest.findIndex((l) => l.startsWith('## '));
  return (next === -1 ? rest : rest.slice(0, next)).join('\n');
};
const ADMISSIONS = ['frontend-surface-audit', 'quality-verification'];
// A run identifier is the moment it ran and the head it verified. Two runs of one flow at one commit
// stay distinguishable, and a record can be placed against its commit without opening it.
export const RUN_ID = /^(\d{8})-(\d{6})-([0-9a-f]{7})$/;
// Every file the flow folder holds, so custody is proved over the whole record and not over the four
// files the branch happens to publish.
function filesUnder(dir, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = path.join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) filesUnder(full, out);
    else out.push(full);
  }
  return out;
}
// The history has to survive the machine that made it, so the host repository tracks the flow folder.
// An ignore line that excludes it turns every run record into a local file nobody else will ever see.
export function ignoredLine(text) {
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const bare = line.replace(/^\//, '').replace(/\/$/, '');
    if (bare === '.worktrees' || bare === '.worktrees/**' || bare === '.worktrees/uat' || bare.startsWith('.worktrees/uat')) return line;
  }
  return null;
}
// The shared UAT password is resolved by name at login; a run that wrote it anywhere failed its
// custody. The pattern lives with every other secret shape in scripts/sweep-secrets.mjs.
export { PASSWORD_LEAK };
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

// A browser journey identifies its frontend delivery and the independent backend it exercised.
// Legacy backend-only records keep their original single-commit meaning.
export function provenanceErrors(request, snapshot, verdicts) {
  const errors = [], heads = Object.fromEntries((request?.contexts ?? []).filter(c => ['@workspaces/fe','@workspaces/be'].includes(c.alias)).map(c => [c.alias.slice(-2), c.head]));
  const explicit = heads.fe !== undefined || snapshot?.provenance !== undefined || verdicts?.provenance !== undefined;
  if (!explicit) return errors;
  if (!heads.fe || !heads.be) errors.push('role provenance requires both frontend and backend context heads');
  for (const [label, record] of [['snapshot',snapshot],['verdicts',verdicts]]) if (record) {
    if (!record.provenance || record.provenance.fe !== heads.fe || record.provenance.be !== heads.be) errors.push(`${label}: role provenance differs from the pinned frontend/backend contexts`);
    if (record.commit !== heads.fe) errors.push(`${label}: the primary commit must be the pinned frontend head`);
  }
  for (const entry of snapshot?.admission ?? []) if (entry.role !== 'fe' || entry.commit !== heads.fe) errors.push(`ADMISSION_MISSING — ${entry.kind} must admit the pinned frontend role`);
  return errors;
}

async function admissionProvenanceErrors(session, request, snapshot) {
  const errors=[];
  for (const entry of snapshot.admission) {
    try {
      if(entry.ref!==request.inputs?.[entry.kind])throw new Error('admission reference differs');
      const receiptPath=path.resolve(session,entry.ref), responseDir=path.dirname(receiptPath), upstreamBranch=path.dirname(responseDir);
      const upstreamRequest=JSON.parse(await readFile(path.join(upstreamBranch,'request/request.json'),'utf8'));
      const upstreamResponse=JSON.parse(await readFile(path.join(responseDir,'response.json'),'utf8'));
      const operator=entry.kind==='frontend-surface-audit'?'interface.audit':'quality.verify';
      if(upstreamRequest.operatorId!==operator || upstreamResponse.operatorId!==operator || upstreamResponse.status!=='done')errors.push(`ADMISSION_MISSING — ${entry.kind} has no completed owning operator`);
      if(!upstreamRequest.contexts?.some(c=>c.alias==='@workspaces/fe'&&c.head===snapshot.provenance.fe))errors.push(`ADMISSION_MISSING — ${entry.kind} did not pin the frontend role at this head`);
      const declared=asList(upstreamResponse.fields?.[entry.kind]);
      if(!declared.some(ref=>path.resolve(upstreamBranch,ref)===receiptPath))errors.push(`ADMISSION_MISSING — ${entry.kind} receipt was not emitted by its owner`);
      const text=await readFile(receiptPath,'utf8');
      const heading=entry.kind==='frontend-surface-audit'?'## Served surface':'## Binding';
      const binding=Object.fromEntries(tableUnder(text,heading)??[]);
      const observed=entry.kind==='frontend-surface-audit'?binding['Applied commit']:binding.Head;
      if(observed!==snapshot.provenance.fe)errors.push(`ADMISSION_MISSING — ${entry.kind} receipt names a stale or cross-role head`);
      if(entry.kind==='quality-verification' && !String(binding.Checkout).includes('@workspaces/fe'))errors.push('ADMISSION_MISSING — quality-verification does not identify the frontend checkout');
    } catch { errors.push(`ADMISSION_MISSING — ${entry.kind} role provenance cannot be read from the actual owner request and receipt`); }
  }
  try { const route=JSON.parse(await readFile(path.resolve(session,request.inputs.route),'utf8'));if(route.role!=='fe')errors.push('UAT browser route must identify the frontend role'); }
  catch { errors.push('UAT frontend route provenance is unavailable'); }
  return errors;
}

async function requiresFrontendPin(session, request) {
  const backend=request.contexts?.find(c=>c.alias==='@workspaces/be')?.head;
  try {
    const route=JSON.parse(await readFile(path.resolve(session,request.inputs.route),'utf8'));
    const head=route.sourceHead ?? route.checkout?.sourceHead;
    if(route.role==='fe' && head && head!==backend)return true;
  } catch { /* Existing missing-input gates own an unreadable legacy route. */ }
  for(const kind of ADMISSIONS)try{
    const branch=path.dirname(path.dirname(path.resolve(session,request.inputs[kind])));
    const upstream=JSON.parse(await readFile(path.join(branch,'request/request.json'),'utf8'));
    const head=upstream.contexts?.find(c=>c.alias==='@workspaces/fe')?.head;
    if(head && head!==backend)return true;
  }catch{ /* Legacy admissions can predate role-specific owner metadata. */ }
  return false;
}

export async function validateUatStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'uat.verify') return { errors };
  if (response.status === 'done') errors.push(...auditScopeCarryErrors(branchDir, request, response, root));
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const decided = response.status === 'done';

  // The run identifier and the exclusive lease arrive from the orchestrator, never from a person.
  if (decided && empty(requirements.runId)) errors.push('request.json: the orchestrator supplies runId; a decided run cannot namespace its records without one');
  if (decided && empty(requirements.lease)) errors.push('request.json: the orchestrator supplies the exclusive lease; a decided run cannot write the flow directory without one');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env, hostRoot);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  // Authority for this run's own writes: an approval id, or the environment's own declaration when it
  // marks `seed` and `identity-provisioning` declared for `env`. The declaration is read as it stands,
  // hashed, and checked against the environment schema; a reference is refused for a declaration that
  // is absent, moved, belongs to another environment, is refused by its schema, or marks either class
  // person.
  if (decided && empty(requirements.approval)) errors.push('request.json: approval has no default; a UAT run is never authorised on silence, and an environment that authorises its seeding and its sign-in says so in a declaration the request references');
  else if (!empty(requirements.approval)) {
    const envSchema = await loadEnvironmentSchema(root);
    const ref = parseDeclarationReference(envSchema, requirements.approval);
    if (ref) {
      if (!empty(requirements.env) && ref.env !== String(requirements.env)) errors.push(`request.json: approval references the ${ref.env} declaration while the run drives ${requirements.env}; a declaration authorises its own environment only`);
      const decl = await stackDeclaration(root, ref.env, hostRoot, envSchema);
      if (!decl.exists) errors.push(`request.json: approval references ${decl.rel}, which this installation does not have`);
      else {
        for (const e of decl.errors) errors.push(`request.json: approval references a declaration the environment schema refuses: ${e}`);
        if (decl.hash !== ref.hash) errors.push(`request.json: approval references ${decl.rel} at ${ref.hash} and the file hashes to ${decl.hash}; the declaration moved since it was read, which is AUTHORITY_DRIFT and not an approval`);
        if (decl.authorization) for (const c of UAT_CLASSES) if (decl.authorization[c] !== 'declared') errors.push(`request.json: ${decl.rel} marks ${c} as ${decl.authorization[c]}, so a declaration reference is not an approval for it; an approval id is required`);
      }
    }
  }

  const frontend = (request?.contexts ?? []).find((c) => c.alias === '@workspaces/fe')?.head ?? null;
  const pinned = frontend ?? (request?.contexts ?? []).find((c) => c.alias === '@workspaces/be')?.head ?? null;
  if(!frontend && await requiresFrontendPin(sessionRootOf(branchDir),request))errors.push('split frontend/backend evidence requires an explicit frontend context and role provenance');

  // A branch that never froze a snapshot is judged on its admissions too: the code that names the
  // missing receipt is the one whose resume instruction is right for a person, and it must be
  // reachable on the branch that blocked before any snapshot existed.
  for (const kind of ADMISSIONS) {
    if (request?.inputs?.[kind] === undefined) errors.push(`request.json: ADMISSION_MISSING — input ${kind} is absent`);
  }

  const parsedCaptures = [];
  let snapshot = null;
  if (present.has('uat-snapshot') && has('response/data/snapshot.json')) {
    try { snapshot = JSON.parse(await read('response/data/snapshot.json')); } catch { snapshot = null; }
  } else if (decided) errors.push('response/data/snapshot.json: a done branch needs the frozen snapshot');
  let verdicts = null;
  if (present.has('uat-verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  } else if (decided) errors.push('response/data/verdicts.json: a done branch needs the three lane verdicts');
  errors.push(...provenanceErrors(request,snapshot,verdicts));
  if(snapshot?.provenance)errors.push(...await admissionProvenanceErrors(sessionRootOf(branchDir),request,snapshot));

  if (snapshot) {
    if (!empty(requirements.feature) && snapshot.feature !== requirements.feature) errors.push('response/data/snapshot.json: the snapshot names another feature');
    if (!empty(requirements.flow) && snapshot.flow !== requirements.flow) errors.push('response/data/snapshot.json: the snapshot names another flow');
    if (!empty(requirements.runId) && snapshot.runId !== requirements.runId) errors.push('response/data/snapshot.json: the snapshot names another runId');
    if (!empty(requirements.approval) && snapshot.approval !== requirements.approval) errors.push('response/data/snapshot.json: the snapshot names another authority than the one the request declared');
    if (snapshot.fixtureNamespace !== `uat-${snapshot.runId}`) errors.push(`response/data/snapshot.json: the fixture namespace must be uat-${snapshot.runId}, so cleanup can name exactly what this run wrote`);
    if (snapshot.seed.namespace !== snapshot.fixtureNamespace) errors.push('response/data/snapshot.json: the seed namespace must equal the run fixture namespace');
    // Two sessions may run against one product at once, under the isolation law runtime.serve
    // publishes. Each clause of it that this receipt can carry is checked here.
    const iso = snapshot.isolation;
    if (iso) {
      const sessionId = request?.sessionId ?? null;
      if (sessionId && iso.sessionId !== sessionId) errors.push(`response/data/snapshot.json: the run belongs to session ${iso.sessionId} and this branch to ${sessionId}; no run writes another session's folder`);
      if (response.status === 'done' && !iso.servedContainsCommit) errors.push('response/data/snapshot.json: the served head does not contain the commit this run pinned, which is drift and not a journey');
      for (const id of iso.seededIds) if (!id.startsWith(snapshot.fixtureNamespace)) errors.push(`response/data/snapshot.json: seeded id ${id} lies outside the run namespace ${snapshot.fixtureNamespace}, so this run touched a row it does not own`);
      const seeded = new Set(iso.seededIds);
      for (const id of iso.rollbackIds) if (!seeded.has(id)) errors.push(`response/data/snapshot.json: rollback names ${id}, which this run never seeded`);
    }
    if (pinned !== null && snapshot.commit !== pinned) errors.push(`response/data/snapshot.json: the snapshot froze commit ${snapshot.commit} but the request pinned @workspaces/${frontend?'fe':'be'} at ${pinned}`);
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
      parsedCaptures.push({ f, capture });
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

  // Mode playwright: the walk is written and the runner ran it. A receipt that records the mode is
  // held to it — every walk the receipt declares passes the walk gate and has its result beside it at
  // the digest that ran; every capture names one of those walks and, per assertion, the expect step
  // that produced it, whose target as the walk states it is the capture's control and whose outcome the
  // runner recorded is the assertion's; a capture without its walk, or a walk with a capture the
  // runner did not produce, is refused.
  const walkRefs = asList(response.fields?.['uat-walk']);
  const resultRefs = new Set(asList(response.fields?.['walk-result']));
  const walks = new Map();
  for (const ref of walkRefs) {
    if (!has(ref)) continue;
    const { errors: walkProblems, walk, result } = validateWalkFile(path.join(branchDir, ref), path.join(branchDir, 'response'), { root });
    errors.push(...walkProblems);
    if (walk) walks.set(ref, { walk, result });
  }
  for (const { f, capture } of parsedCaptures) {
    const driver = capture.driver ?? null;
    if (!driver) { if (walks.size) errors.push(`${f}: the receipt records mode playwright (it declares a uat-walk) and this capture carries no driver; under that mode every capture is produced by the runner from the walk`); continue; }
    const bound = walks.get(driver.walkRef);
    if (!bound) { errors.push(`${f}: names walk ${driver.walkRef}, which the receipt does not declare under uat-walk or which is not on disk; a capture without its walk is refused`); continue; }
    if (!resultRefs.has(driver.resultRef) || !has(driver.resultRef) || !bound.result) { errors.push(`${f}: names result ${driver.resultRef}, and no walk-result stands beside the walk on disk and under fields; a capture whose walk nobody ran is refused`); continue; }
    const { walk, result } = bound;
    if (walk.run?.runId !== capture.runId) errors.push(`${f}: the walk ran ${walk.run?.runId ?? 'no run'} and the capture belongs to ${capture.runId}`);
    const resultOutcome = new Map(result.steps.map((s) => [s.id, s.outcome]));
    for (const a of capture.assertions) {
      if (!a.stepId) { errors.push(`${f}: assertion ${a.assertionId} names no walk step; under mode playwright every assertion is the expect step that produced it`); continue; }
      const step = walk.steps.find((s) => s.id === a.stepId);
      if (!step) { errors.push(`${f}: assertion ${a.assertionId} names step ${a.stepId}, which the walk does not carry`); continue; }
      if (step.action !== 'expect' || step.assertion?.caseId !== capture.caseId || step.assertion?.assertionId !== a.assertionId) errors.push(`${f}: assertion ${a.assertionId} names step ${a.stepId}, which does not evidence ${capture.caseId}/${a.assertionId} in the walk`);
      const expected = stepControl(walk, a.stepId);
      if (a.control !== expected) errors.push(`${f}: assertion ${a.assertionId} records control ${JSON.stringify(a.control)} and the walk's step ${a.stepId} pressed ${JSON.stringify(expected)}; the control is copied from the walk, never written by the agent`);
      const ran = resultOutcome.get(a.stepId);
      if (ran !== a.outcome) errors.push(`${f}: assertion ${a.assertionId} is ${a.outcome} here and the runner recorded step ${a.stepId} as ${ran ?? 'not run'}; the outcome is the runner's`);
    }
    const produced = result.captures.find((c) => c.screenshotRef === capture.screenshotRef);
    if (!produced) errors.push(`${f}: points at ${capture.screenshotRef}, which the runner did not produce for this walk`);
    else if (driver.measurementsRef !== undefined && driver.measurementsRef !== produced.measurementsRef) errors.push(`${f}: names measurements ${driver.measurementsRef} and the runner recorded ${produced.measurementsRef ?? 'none'} beside ${capture.screenshotRef}; the record is the runner's`);
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
      if (verdicts.latestRef !== `${snapshot.snapshotRef.replace(/snapshot\.json$/, '')}latest.json`) errors.push('response/data/verdicts.json: latest.json must be the pointer of this flow directory');
      if (verdicts.historyRef !== `${snapshot.snapshotRef.replace(/snapshot\.json$/, '')}history.md`) errors.push('response/data/verdicts.json: history.md must be the history of this flow directory');
      if (verdicts.cleanup.namespace !== snapshot.fixtureNamespace) errors.push('response/data/verdicts.json: cleanup must name the exact run fixture namespace and nothing wider');
    }
    if (pinned !== null && verdicts.commit !== pinned) errors.push(`response/data/verdicts.json: the result commit ${verdicts.commit} is not the pinned head ${pinned}`);
    if (decided && !verdicts.cleanup.performed) errors.push('response/data/verdicts.json: a decided run cleans its own namespace before it publishes');

    const failing = verdicts.lanes.filter((l) => l.verdict === 'fail').map((l) => l.lane);
    const next = new Set(response.next ?? []);
    if (decided && !failing.length && !next.has('git.publish')) errors.push('response/response.json: all three lanes pass, so the run hands to git.publish');
    if (decided && failing.includes('behavior') && !next.has('backend.generate')) errors.push('response/response.json: the behaviour lane failed, so the run hands to backend.generate');
    if (decided && failing.includes('ux') && !next.has('user')) errors.push('response/response.json: a UX failure is a question of intent; it hands to a person, and the flow is verified again only after that decision');
    if (decided && failing.length && next.has('git.publish')) errors.push('response/response.json: a failing lane cannot hand to git.publish');
  }

  if (present.has('uat-flow-verification') && has('response/response.md')) {
    const text = await read('response/response.md');
    // A verdict nobody was shown is a verdict nobody read: the run summary reaches the person
    // reading the conversation, and ## Printed records what was handed over.
    const printed = (tableUnder(text, '## Printed') ?? []).map(([artifact]) => artifact);
    if (decided && !printed.some((p) => p.includes('sheet.png'))) {
      errors.push("response/response.md: ## Printed names no run summary; the stitched sheet is printed before the verdict is published");
    }
    const snap = Object.fromEntries((tableUnder(text, '## Snapshot') ?? []).map(([k, v]) => [k, v]));
    if (snapshot) {
      if (snap.Run !== snapshot.runId) errors.push(`response/response.md: Snapshot names run ${snap.Run}, the frozen snapshot names ${snapshot.runId}`);
      if (snap.Feature !== snapshot.feature) errors.push('response/response.md: Snapshot names another feature');
      if (snap.Flow !== snapshot.flow) errors.push('response/response.md: Snapshot names another flow');
      if (snap.Commit !== snapshot.commit) errors.push('response/response.md: Snapshot names another commit than the frozen one');
      if(snapshot.provenance && (snap['Frontend commit']!==snapshot.provenance.fe || snap['Backend commit']!==snapshot.provenance.be))errors.push('response/response.md: Snapshot must preserve both role-specific commit heads');
      if (snap.Namespace !== snapshot.fixtureNamespace) errors.push('response/response.md: Snapshot names another fixture namespace');
      if (snap.Approval !== snapshot.approval) errors.push('response/response.md: Snapshot names another approval');
      if (snap.Environment !== snapshot.env) errors.push('response/response.md: Snapshot names another environment than the run drove');
      if (snap['Flow source'] !== snapshot.flowSource) errors.push(`response/response.md: Snapshot reads ${snap['Flow source']} but the flow was ${snapshot.flowSource}; a drafted flow is honest and an undeclared draft is not`);
      if (!String(snap.Golden ?? '').startsWith(snapshot.golden.state)) errors.push(`response/response.md: Snapshot reads Golden "${snap.Golden}" but the reference is ${snapshot.golden.state}`);
      if (String(snap.Accounts ?? '').replaceAll('`', '') !== snapshot.accounts.map((a) => a.alias).join(', ')) errors.push('response/response.md: Snapshot names another set of accounts than the run froze');
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
      // The experience lane is scored, not asserted: ## Experience reads what the lens carries, and
      // ## Verdict carries the one row this operator owns.
      const lens = verdicts.experience;
      if (lens) {
        const rows = tableUnder(text, '## Experience') ?? [];
        if (rows.length !== lens.entries.length) errors.push(`response/response.md: Experience has ${rows.length} rows, the lens scores ${lens.entries.length} criteria`);
        for (const [rule, measured, score, rowVerdict] of rows) {
          const scored = lens.entries.find((e) => `\`${e.rule}\`` === rule || e.rule === rule.replaceAll('\`', ''));
          if (!scored) { errors.push(`response/response.md: Experience names ${rule}, which the lens does not score`); continue; }
          if (Number(score) !== scored.score) errors.push(`response/response.md: ${rule} scores ${score} here and ${scored.score} in the verdicts`);
          if (rowVerdict !== scored.verdict) errors.push(`response/response.md: ${rule} is ${rowVerdict} here and ${scored.verdict} in the verdicts`);
          if (measured !== scored.measured) errors.push(`response/response.md: ${rule} is scored on "${measured}", which the run did not measure`);
        }
        const section = sectionText(text, '## Experience');
        const mean = /^- Mean: (\d+(?:\.\d+)?)$/m.exec(section);
        if (!mean) errors.push('response/response.md: Experience closes with no "- Mean: <number>" line');
        else if (Math.abs(Number(mean[1]) - Number(lens.mean)) > 0.005) errors.push(`response/response.md: Experience records a mean of ${mean[1]}; the verdicts record ${lens.mean}`);
        const verdictRows = tableUnder(text, '## Verdict') ?? [];
        const row = verdictRows.find(([topic]) => topic.replaceAll('\`', '') === 'experience');
        if (!row) errors.push('response/response.md: Verdict carries no experience row; it is the one topic this operator closes');
        else {
          if (row[1] !== lens.verdict) errors.push(`response/response.md: Verdict records ${row[1]} for experience; the verdicts record ${lens.verdict}`);
          if (row[2] !== lens.routeTo) errors.push(`response/response.md: Verdict routes experience to ${row[2]}; the verdicts route it to ${lens.routeTo}`);
        }
      }
    }
  } else if (decided) errors.push('response/response.md: a done branch needs the verification receipt');

  // UX-12 computes the experience lane; a receipt may publish it and may not assert it.
  if (verdicts?.experience) {
    const lens = verdicts.experience;
    const at = 'response/data/verdicts.json';
    const seen = new Map();
    for (const row of lens.entries) {
      if (seen.has(row.rule)) errors.push(`${at}: the experience lane scores ${row.rule} twice`);
      seen.set(row.rule, row);
      if (!UX_RULES.includes(row.rule)) errors.push(`${at}: the experience lane scores ${row.rule}, which is not one of the eleven scored criteria (UX-12 is the arithmetic and is not itself scored)`);
      if (row.verdict === 'fail' && row.routeTo === 'none') errors.push(`${at}: the experience lane fails ${row.rule} and routes nowhere`);
      if (row.verdict === 'pass' && row.routeTo !== 'none') errors.push(`${at}: the experience lane passes ${row.rule} and still routes to ${row.routeTo}`);
    }
    for (const rule of UX_RULES) if (!seen.has(rule)) errors.push(`${at}: the experience lane leaves ${rule} unscored; the lane is incomplete until every criterion carries a measurement`);
    if (UX_RULES.every((r) => seen.has(r)) && seen.size === UX_RULES.length) {
      const computed = uxVerdict(UX_RULES.map((r) => seen.get(r)));
      if (Math.abs(Number(lens.mean) - computed.mean) > 0.005) errors.push(`${at}: the experience lane records a mean of ${lens.mean}; the eleven scores average ${computed.mean.toFixed(2)}`);
      if (lens.verdict !== computed.verdict) errors.push(`${at}: the experience lane records ${lens.verdict}; UX-12 makes it ${computed.verdict}`);
    }
    const uxLane = verdicts.lanes?.find((l) => l.lane === 'ux');
    if (uxLane && uxLane.verdict !== (lens.verdict === 'ship' ? 'pass' : 'fail')) {
      errors.push(`${at}: the ux lane reads ${uxLane.verdict} while UX-12 made the experience lens ${lens.verdict}`);
    }
  }

  // A missing record is created, not reported: a drafted flow is honest and says so, and the first run
  // of a flow is the candidate baseline a person promotes rather than a failure against a reference
  // that never existed. Both facts are carried, so neither can be quietly reported as the other.
  if (snapshot) {
    const at = 'response/data/snapshot.json';
    const m = RUN_ID.exec(String(snapshot.runId));
    if (!m) errors.push(`${at}: runId ${snapshot.runId} is not <yyyymmdd-HHMMss>-<commit7>; a run is identified by when it ran and what it verified`);
    else if (m[3] !== String(snapshot.commit).slice(0, 7)) errors.push(`${at}: runId names commit ${m[3]} and the run was pinned at ${String(snapshot.commit).slice(0, 7)}`);
    if (!empty(requirements.env) && snapshot.env !== requirements.env) errors.push(`${at}: the snapshot froze environment ${snapshot.env} and the request named ${requirements.env}`);
    if (snapshot.golden.env !== snapshot.env) errors.push(`${at}: the approved reference was taken in ${snapshot.golden.env} and this run drove ${snapshot.env}; a golden from one environment is not authority for another`);
    if (snapshot.flowSource === 'drafted-from-template' && snapshot.golden.state !== 'candidate') errors.push(`${at}: the flow was drafted this run, so it can have no approved reference yet; the first run is the candidate a person promotes`);
    const aliases = new Set();
    for (const account of snapshot.accounts) {
      if (aliases.has(account.alias)) errors.push(`${at}: the alias ${account.alias} is frozen twice; one alias is one account`);
      aliases.add(account.alias);
      if (!account.credentialRef.startsWith(`.stacks/${snapshot.env}/`)) errors.push(`${at}: the account ${account.alias} resolves its credential in another environment than ${snapshot.env}`);
    }
    for (const c of snapshot.cases) if (!aliases.has(c.as)) errors.push(`${at}: case ${c.caseId} runs as ${c.as}, which no frozen account carries; provisioning creates every alias the flow names`);
  }
  if (snapshot && decided && snapshot.golden.state === 'candidate' && !(response.next ?? []).includes('user')) {
    errors.push('response/response.json: this run produced the first baseline of the flow, so a person promotes the candidate; no run approves its own reference');
  }

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
          && JSON.stringify(recorded.provenance) === JSON.stringify(verdicts.provenance)
          && JSON.stringify(recorded.lanes) === JSON.stringify(verdicts.lanes);
        if (!same) errors.push(`runs/${snapshot.runId}: a run record already exists with a different result; runs are append-only, so a second attempt is a new runId`);
      }
    } else if (decided) errors.push(`runs/${snapshot.runId}: a decided run appends its record under runs/<runId>/ before it emits`);
    const latestFile = path.join(snapshot.flowRoot, 'latest.json');
    if (decided && existsSync(latestFile)) {
      let latest = null;
      try { latest = JSON.parse(await readFile(latestFile, 'utf8')).runId ?? null; } catch { latest = null; }
      if (latest === null) errors.push('latest.json: the pointer must be a file naming one runId; it is never a symlink');
      else if (latest !== snapshot.runId) errors.push(`latest.json: points at ${latest}, but this run published ${snapshot.runId}`);
    }
    const historyFile = path.join(snapshot.flowRoot, 'history.md');
    if (decided) {
      if (!existsSync(historyFile)) errors.push('history.md: a decided run appends one line to the flow history before it emits');
      else if (!(await readFile(historyFile, 'utf8')).includes(snapshot.runId)) errors.push(`history.md: no line names ${snapshot.runId}; the history gains one line per run and loses none`);
    }
    // Custody over the whole record, not over the four files the branch publishes.
    for (const file of filesUnder(path.join(snapshot.flowRoot, 'runs'))) {
      if (!/\.(json|md|txt|log)$/.test(file)) continue;
      if (PASSWORD_LEAK.test(await readFile(file, 'utf8'))) errors.push(`${path.relative(snapshot.flowRoot, file).split(path.sep).join('/')}: the shared UAT password appears under the flow folder; the credential reaches a form or a request body and nothing else`);
    }
  }

  // The flow folder is tracked by the host repository: an ignore line that excludes it is the request
  // gate's problem, because the run would leave no history anyone else could read.
  if (snapshot) {
    let dir = snapshot.flowRoot;
    for (let i = 0; i < 6 && dir; i += 1) {
      const file = path.join(dir, '.gitignore');
      if (existsSync(file)) {
        const line = ignoredLine(await readFile(file, 'utf8'));
        if (line) errors.push(`.gitignore: the line "${line}" excludes the flow folder, so this run would leave no history the next machine can read (INVALID_INPUT)`);
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  if (snapshot && response.status === 'done') {
    try {
      const scope = upstreamAuditScope(branchDir, request, root);
      if (scope && JSON.stringify(snapshot.auditScope) !== JSON.stringify(scope)) errors.push('UAT frozen snapshot must retain the admitted audit scope');
      if (scope) {
        const qualityScope = path.join(sessionRootOf(branchDir), path.dirname(request.inputs['quality-verification']), 'data/audit-scope.json');
        if (!existsSync(qualityScope) || JSON.stringify(JSON.parse(await readFile(qualityScope, 'utf8'))) !== JSON.stringify(scope)) errors.push('UAT quality admission must retain the same audit scope');
      }
    }
    catch (error) { errors.push(error.message); }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateUatStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid uat.verify branch\n');
}
