// api.verify's own law over one branch, on top of the shared step check: the run's authority is
// covered — an approval id, or the environment declaration's reference where it marks the run's own
// classes declared; the record binds the served head from the platform receipt the request handed in,
// and the ancestry claim is that receipt's and not this branch's; every case is the runner's, carries a
// status and an evidence reference, and stands in the runner's own output; a case that did not hold, or
// that the runner named and never ran, forces API_CASE_FAILED and can never be a done branch; a done
// branch publishes three lanes and every one of them passes; a record outside the seed's namespace is
// API_NAMESPACE_LEAK; the run history is append-only; and no case row, verdict, receipt sentence or line
// of the runner's output carries the credential.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { PASSWORD_LEAK } from '../../scripts/sweep-secrets.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { hostRootOf, sessionRootOf, missingStack, loadEnvironmentSchema, parseDeclarationReference, stackDeclaration } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// What this run itself writes: the suite's rows into the environment's data, and the sign-in as the
// flow's account. Provisioning the account and placing the seed are other operators' jobs.
export const API_CLASSES = ['seed', 'identity-provisioning'];
export const LANES = ['contract', 'data', 'lifecycle'];
// A run identifier is the moment it ran and the head it verified, so two runs of one flow at one commit
// stay distinguishable and a record can be placed against its commit without opening it.
export const RUN_ID = /^(\d{8})-(\d{6})-([0-9a-f]{7})$/;
// The credential is resolved where the suite consumes it; a run that wrote it anywhere failed its
// custody. The pattern lives with every other secret shape in scripts/sweep-secrets.mjs.
export { PASSWORD_LEAK };

const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
// A case is a pass only when the runner said it held. A case it named and never ran proved nothing, and
// a zero-proof row is not evidence a lane may stand on.
export const held = (c) => c?.status === 'pass';

// The served head is the platform receipt's, read from the delta the runtime branch wrote beside it. A
// branch that restates a head nobody attested has bound nothing.
export async function servedHeadOf(session, request) {
  const ref = request?.inputs?.['platform-operation-receipt'];
  if (!session || !ref) return null;
  try {
    const delta = JSON.parse(await readFile(path.join(path.dirname(path.resolve(session, ref)), 'data', 'delta.json'), 'utf8'));
    const ladder = delta.runtimeLadder ?? null;
    if (!ladder) return null;
    return { servedHead: ladder.servedHead ?? null, contains: ladder.contains ?? [] };
  } catch { return null; }
}

export async function validateApiStep(branchDir, root = ROOT, { hostRoot = hostRootOf(root) } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'api.verify') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const decided = response.status === 'done';
  const session = sessionRootOf(branchDir);

  // The run identifier arrives from the orchestrator, never from a person.
  if (decided && empty(requirements.runId)) errors.push('request.json: the orchestrator supplies runId; a decided run cannot name the record its observations are written under without one');

  // An env names a stack of this installation; the vocabulary is the folder, not a list kept here.
  const missing = missingStack(root, requirements.env, hostRoot);
  if (missing) errors.push(`request.json: env ${requirements.env} names ${missing}, which this installation does not have`);

  // Authority for this run's own writes: an approval id, or the environment's own declaration when it
  // marks `seed` and `identity-provisioning` declared for `env`. The declaration is read as it stands,
  // hashed, and checked against the environment schema; a reference is refused for a declaration that is
  // absent, moved, belongs to another environment, is refused by its schema, or marks either class person.
  if (decided && empty(requirements.approval)) errors.push('request.json: approval has no default; an API walk is never authorised on silence, and an environment that authorises running a suite against its data and signing in says so in a declaration the request references');
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
        if (decl.authorization) for (const c of API_CLASSES) if (decl.authorization[c] !== 'declared') errors.push(`request.json: ${decl.rel} marks ${c} as ${decl.authorization[c]}, so a declaration reference is not an approval for it; an approval id is required`);
      }
    }
  }

  const pinned = (request?.contexts ?? []).find((c) => c.alias === '@workspaces/be')?.head ?? null;

  let cases = null;
  if (present.has('api-cases') && has('response/data/cases.json')) {
    try { cases = JSON.parse(await read('response/data/cases.json')); } catch { cases = null; }
  } else if (decided) errors.push('response/data/cases.json: a done branch needs the runner\'s per-case results');
  let verdicts = null;
  if (present.has('api-verdicts') && has('response/data/verdicts.json')) {
    try { verdicts = JSON.parse(await read('response/data/verdicts.json')); } catch { verdicts = null; }
  } else if (decided) errors.push('response/data/verdicts.json: a done branch needs the three lane verdicts');

  // A blocked branch that reached per-case results still publishes them: the rows are what the delivery
  // owner reads. A stop before the suite ran publishes nothing, and that is how the two are told apart.
  if (response.status === 'blocked' && response.stop === 'API_CASE_FAILED' && !cases) {
    errors.push('response/data/cases.json: API_CASE_FAILED names a case the runner reported, so the case record is published with the stop; a failure nobody can read is not a finding');
  }

  if (cases) {
    const at = 'response/data/cases.json';
    if (!empty(requirements.flow) && cases.flow !== requirements.flow) errors.push(`${at}: the record names flow ${cases.flow} and the request named ${requirements.flow}`);
    if (!empty(requirements.runId) && cases.runId !== requirements.runId) errors.push(`${at}: the record belongs to run ${cases.runId} and the request named ${requirements.runId}`);
    if (pinned !== null && cases.commit !== pinned) errors.push(`${at}: the record verifies commit ${cases.commit} but the request pinned @workspaces/be at ${pinned}`);
    const m = RUN_ID.exec(String(cases.runId));
    if (!m) errors.push(`${at}: runId ${cases.runId} is not <yyyymmdd-HHMMss>-<commit7>; a run is identified by when it ran and what it verified`);
    else if (m[3] !== String(cases.commit).slice(0, 7)) errors.push(`${at}: runId names commit ${m[3]} and the run was pinned at ${String(cases.commit).slice(0, 7)}`);
    if (cases.namespace && !String(cases.namespace).includes(String(cases.runId))) errors.push(`${at}: the namespace ${cases.namespace} does not carry the runId ${cases.runId}, so what this run wrote cannot be named apart from what another run wrote`);
    if (cases.account && !String(cases.account.credentialRef ?? '').startsWith(`.stacks/${requirements.env ?? ''}/`)) errors.push(`${at}: the account resolves its credential in another environment than ${requirements.env}`);

    // The served head is the platform receipt's. A record that names a head no receipt attested, or a
    // different one, has bound nothing; and the ancestry claim is the receipt's, not this branch's.
    const attested = await servedHeadOf(session, request);
    if (!cases.servedHead) errors.push(`${at}: the record names no served head; the suite ran against something and a run that cannot say what has proved nothing about the product`);
    else if (attested === null) errors.push(`${at}: the served head ${cases.servedHead} is bound from no platform-operation-receipt this request handed in; the entry is the attested one, never a re-derived one`);
    else {
      if (attested.servedHead !== cases.servedHead) errors.push(`${at}: the record names served head ${cases.servedHead} and the platform receipt attests ${attested.servedHead ?? 'none'}`);
      const contains = attested.contains.includes(cases.commit);
      if (cases.servedContainsCommit !== contains) errors.push(`${at}: the record says the served head ${cases.servedContainsCommit ? 'contains' : 'does not contain'} the pinned commit and the platform receipt records the opposite; the ancestry test is the receipt's`);
    }
    if (decided && cases.servedContainsCommit === false) errors.push(`${at}: the served head does not contain the commit this run pinned, which is drift and not a walk`);

    // Every case is the runner's: it carries a status and an evidence reference, and it stands in the
    // runner's own output. A row nobody can trace back to that output is a row the agent could have
    // written, and a case the branch writes is a source write.
    const ids = cases.cases?.map((c) => c.caseId) ?? [];
    if (new Set(ids).size !== ids.length) errors.push(`${at}: the record names the same case twice`);
    let output = null;
    if (cases.outputRef && has(cases.outputRef)) { try { output = await read(cases.outputRef); } catch { output = null; } }
    else errors.push(`${at}: outputRef ${cases.outputRef} is not on the branch; the runner's own output is what every case row is read back against`);
    for (const c of cases.cases ?? []) {
      if (empty(c.status)) errors.push(`${at}: case ${c.caseId} carries no status`);
      if (empty(c.evidenceRef)) errors.push(`${at}: case ${c.caseId} carries no evidence reference; a case nobody can read back is not evidence`);
      if (output !== null && !output.includes(c.caseId)) errors.push(`${at}: case ${c.caseId} stands in no line of ${cases.outputRef}; the cases are the runner's, and a case this branch wrote is a source write that belongs to backend.generate`);
    }
    // A case that did not hold — reported failing, or named and never run — is the stop, never a done run.
    const notHeld = (cases.cases ?? []).filter((c) => !held(c));
    if (notHeld.length && decided) errors.push(`${at}: ${notHeld.map((c) => `${c.caseId} (${c.status})`).join(', ')} did not hold, so this branch stops with API_CASE_FAILED; a suite with a case that proved nothing is not a passing walk`);
    if (notHeld.length && response.status === 'blocked' && response.stop !== 'API_CASE_FAILED') errors.push(`${at}: ${notHeld.length} case(s) did not hold and the branch stopped with ${response.stop}; a case the runner reported failing is API_CASE_FAILED`);
    if (!notHeld.length && response.stop === 'API_CASE_FAILED') errors.push(`${at}: the branch stops with API_CASE_FAILED and every case the runner reported held; a stop names what actually happened`);
    if (decided && cases.exitCode !== 0) errors.push(`${at}: the runner exited ${cases.exitCode} and the branch is done; a non-zero exit is the suite saying it did not pass`);
  }

  if (verdicts) {
    const at = 'response/data/verdicts.json';
    const names = verdicts.lanes.map((l) => l.lane);
    for (const lane of LANES) if (!names.includes(lane)) errors.push(`${at}: the ${lane} lane is missing; the three lanes are judged apart and all three are published`);
    for (const name of names) if (!LANES.includes(name)) errors.push(`${at}: ${name} is not one of the three lanes`);
    if (new Set(names).size !== names.length) errors.push(`${at}: a lane may report at most one verdict`);
    if (cases) {
      if (verdicts.runId !== cases.runId) errors.push(`${at}: the result belongs to another run than the case record`);
      if (verdicts.commit !== cases.commit) errors.push(`${at}: the result carries commit ${verdicts.commit} but the run was pinned at ${cases.commit}`);
      if (verdicts.servedHead !== cases.servedHead) errors.push(`${at}: the result names served head ${verdicts.servedHead} and the case record names ${cases.servedHead}`);
      if (verdicts.namespace !== cases.namespace) errors.push(`${at}: the result names namespace ${verdicts.namespace} and the run wrote under ${cases.namespace}`);
      const flow = `.worktrees/e2e/${cases.flow}`;
      if (verdicts.resultRef !== `${flow}/runs/${verdicts.runId}/result.json`) errors.push(`${at}: the result must be appended under ${flow}/runs/<runId>/ of this flow directory`);
      if (verdicts.latestRef !== `${flow}/latest.json`) errors.push(`${at}: ${flow}/latest.json must be the pointer of this flow's API history`);
      if (verdicts.historyRef !== `${flow}/history.md`) errors.push(`${at}: ${flow}/history.md must be the history of this flow's API walks`);
    }
    if (verdicts.cleanup.namespace !== verdicts.namespace) errors.push(`${at}: cleanup must name the exact run namespace and nothing wider`);
    if (decided && !verdicts.cleanup.performed) errors.push(`${at}: a decided run deletes its own namespace before it publishes`);

    // Every record the suite wrote lies inside the namespace the seed placed. One outside it is a leak:
    // the run reached a row the flow does not own, and no cleanup this operator may perform takes it back.
    const outside = (verdicts.records ?? []).filter((r) => r.inNamespace === false || !String(r.id).includes(verdicts.namespace));
    if (outside.length) {
      errors.push(`${at}: ${outside.map((r) => `${r.id} in ${r.store}`).join(', ')} lies outside the run namespace ${verdicts.namespace}, which is API_NAMESPACE_LEAK`);
      if (decided) errors.push(`${at}: a record outside the run namespace cannot be published as a done walk; the branch stops with API_NAMESPACE_LEAK`);
    }
    for (const r of verdicts.records ?? []) if (empty(r.readBackRef)) errors.push(`${at}: record ${r.id} was not read back through the API; a row only a direct query can see is a row the product does not serve`);

    // A done branch publishes three passing lanes and hands on; a failing lane is a stop, not a verdict
    // this operator publishes as done.
    const failing = verdicts.lanes.filter((l) => l.verdict !== 'pass').map((l) => l.lane);
    if (decided && failing.length) errors.push(`response/response.json: the ${failing.join(' and ')} lane did not pass, so this branch does not end done; a lane that failed is the stop that names its owner`);
    if (decided && !(response.next ?? []).includes('git.publish')) errors.push('response/response.json: all three lanes pass, so the run hands to git.publish');
    if (cases) {
      const contract = verdicts.lanes.find((l) => l.lane === 'contract');
      const notHeld = (cases.cases ?? []).filter((c) => !held(c));
      if (contract && contract.verdict === 'pass' && notHeld.length) errors.push(`${at}: the contract lane passes while ${notHeld.length} case(s) did not hold; the lane is the runner's outcome, not a reading of it`);
    }
  }

  if (present.has('api-verification') && has('response/response.md')) {
    const text = await read('response/response.md');
    const bind = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    // A verdict nobody was shown is a verdict nobody read: the case results reach the person reading the
    // conversation, and ## Printed records what was handed over.
    const printed = (tableUnder(text, '## Printed') ?? []).map(([artifact]) => artifact);
    if (decided && !printed.some((p) => p.includes('cases.json'))) errors.push('response/response.md: ## Printed names no case results; the per-case results are printed before the lanes are published');
    if (cases) {
      if (bind.Run !== cases.runId) errors.push(`response/response.md: Binding names run ${bind.Run}, the case record names ${cases.runId}`);
      if (bind.Flow !== cases.flow) errors.push('response/response.md: Binding names another flow');
      if (bind['Pinned commit'] !== cases.commit) errors.push('response/response.md: Binding names another pinned commit than the case record');
      if (bind['Served head'] !== cases.servedHead) errors.push('response/response.md: Binding names another served head than the case record; the head that answered is what the suite actually measured');
      if (bind.Namespace !== cases.namespace) errors.push('response/response.md: Binding names another namespace');
      if (bind.Command !== cases.command) errors.push('response/response.md: Binding names another command than the one that ran');
      if (String(bind['Exit code'] ?? '') !== String(cases.exitCode)) errors.push('response/response.md: Binding names another exit code than the runner returned');
      if (bind.Approval !== requirements.approval) errors.push('response/response.md: Binding names another authority than the one the request declared');
      if (bind.Environment !== requirements.env) errors.push('response/response.md: Binding names another environment than the run drove');
      const rows = tableUnder(text, '## Cases') ?? [];
      if (rows.length !== (cases.cases ?? []).length) errors.push(`response/response.md: Cases has ${rows.length} rows, the runner reported ${(cases.cases ?? []).length}`);
      for (const [caseId, , status] of rows) {
        const row = (cases.cases ?? []).find((c) => c.caseId === caseId);
        if (!row) { errors.push(`response/response.md: Cases names ${caseId}, which the runner did not report`); continue; }
        if (row.status !== status) errors.push(`response/response.md: ${caseId} reads ${status} here and ${row.status} in the case record`);
      }
    }
    if (verdicts) {
      for (const [lane, verdict] of tableUnder(text, '## Lanes') ?? []) {
        const entry = verdicts.lanes.find((l) => l.lane === lane);
        if (!entry) { errors.push(`response/response.md: Lanes names ${lane}, which the verdicts do not`); continue; }
        if (entry.verdict !== verdict) errors.push(`response/response.md: the ${lane} lane reads ${verdict} but the verdicts say ${entry.verdict}`);
      }
      for (const [record, , inside] of tableUnder(text, '## Namespace') ?? []) {
        const entry = (verdicts.records ?? []).find((r) => r.id === record);
        if (!entry) { errors.push(`response/response.md: Namespace names ${record}, which the verdicts did not read back`); continue; }
        if (entry.inNamespace !== (inside === 'yes')) errors.push(`response/response.md: ${record} reads ${inside} here and the verdicts record ${entry.inNamespace ? 'yes' : 'no'}`);
      }
    }
  } else if (decided) errors.push('response/response.md: a done branch needs the verification receipt');

  // Custody is proved on the written bytes, not asserted in prose. The runner's own output is published
  // evidence and is swept exactly like the record it produced.
  const scanned = ['response/response.md', 'response/response.json', 'response/data/cases.json', 'response/data/verdicts.json', ...asList(response.fields?.['api-output'])];
  for (const f of scanned) {
    if (!has(f)) continue;
    if (PASSWORD_LEAK.test(await read(f))) errors.push(`${f}: the shared UAT credential appears in a file this operator writes; it is resolved by name where the suite consumes it and is never recorded`);
  }

  // The run history is append-only: a run folder that exists already is never rewritten.
  if (verdicts && verdicts.flowRoot && existsSync(verdicts.flowRoot)) {
    const resultFile = path.join(verdicts.flowRoot, 'api', 'runs', verdicts.runId, 'result.json');
    if (existsSync(resultFile)) {
      let recorded = null;
      try { recorded = JSON.parse(await readFile(resultFile, 'utf8')); } catch { recorded = null; }
      if (recorded === null) errors.push(`${verdicts.resultRef}: the existing run record cannot be read, and a run record is never overwritten`);
      else if (recorded.runId !== verdicts.runId || recorded.commit !== verdicts.commit || JSON.stringify(recorded.lanes) !== JSON.stringify(verdicts.lanes)) {
        errors.push(`api/runs/${verdicts.runId}: a run record already exists with a different result; runs are append-only, so a second attempt is a new runId`);
      }
    } else if (decided || response.stop === 'API_CASE_FAILED') errors.push(`api/runs/${verdicts.runId}: a run that reached per-case results appends its record before it emits`);
    const latestFile = path.join(verdicts.flowRoot, 'api', 'latest.json');
    if (decided && existsSync(latestFile)) {
      let latest = null;
      try { latest = JSON.parse(await readFile(latestFile, 'utf8')).runId ?? null; } catch { latest = null; }
      if (latest === null) errors.push('api/latest.json: the pointer must be a file naming one runId; it is never a symlink');
      else if (latest !== verdicts.runId) errors.push(`api/latest.json: points at ${latest}, but this run published ${verdicts.runId}`);
    }
    const historyFile = path.join(verdicts.flowRoot, 'api', 'history.md');
    if (decided) {
      if (!existsSync(historyFile)) errors.push('api/history.md: a decided run appends one line to the flow\'s API history before it emits');
      else if (!(await readFile(historyFile, 'utf8')).includes(verdicts.runId)) errors.push(`api/history.md: no line names ${verdicts.runId}; the history gains one line per run and loses none`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateApiStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid api.verify branch\n');
}
