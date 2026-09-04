// quality.verify's own law over one branch, on top of the shared step check: the gate plan the
// person declared is the plan that ran, one file per gate; every gate file stands on the same head,
// which is the head the request pinned and the commit the predecessor recorded, and no predecessor was
// produced under mode dry; a frontend delivery plans the presentation sweep; e2e runs only under
// an explicit request and sonar carries the scope it was measured at; a result's exit code, evidence
// and classification match its status; coverage exists exactly where the unit gate produced it and no
// metric sits below its own threshold beside a green unit result; a debt is live, in-boundary and
// recorded; and the receipt's verdict follows the required gates.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { auditScopeCarryErrors } from '../../scripts/audit-scope.mjs';
import { integrationChangesErrors } from '../platform-operate/validate.mjs';
import { coveragePolicyResult, coverageTableErrors } from '../../scripts/coverage-policy.mjs';

// The nine topics the scorecard reports. Eight are closed by the surface audit and one by the UAT
// run; this operator copies each verdict and never recomputes one.
export const SCORECARD_TOPICS = ['presentation', 'composition', 'responsive', 'motion', 'accessibility', 'contrast', 'render-truth', 'taste', 'experience'];
// Any row missing or blocked makes the answer blocked; any fail or fix-first makes it fix-first;
// otherwise ship. Nothing is averaged across rows, because each row already carries its own
// arithmetic.
export function scorecardVerdict(rows) {
  const byTopic = new Map(rows.map((r) => [r.topic, r]));
  if (SCORECARD_TOPICS.some((t) => !byTopic.has(t) || byTopic.get(t).verdict === 'blocked')) return 'blocked';
  if (rows.some((r) => r.verdict === 'fail' || r.verdict === 'fix-first')) return 'fix-first';
  return 'ship';
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const METRICS = ['statements', 'lines', 'functions', 'branches'];
const DEFAULT_GATES = [
  { gate: 'format', required: true },
  { gate: 'lint', required: true },
  { gate: 'typecheck', required: true },
  { gate: 'build', required: true },
  { gate: 'unit-coverage', required: true },
];
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const asList = (v) => (Array.isArray(v) ? v : []);
const isTrue = (v) => v === true || v === 'true' || v === 'yes';

export function integrationGateBindingErrors(result, producer) {
  if(/^session\/[A-Za-z0-9._-]+$/.test(result.sessionBranch))return [];
  const ladder=producer?.delta?.runtimeLadder;
  if(producer?.operatorId!=='platform.operate' || producer?.status!=='done' || ladder?.rung!=='serve' || ladder.integration?.branch!==result.sessionBranch || ladder.servedHead!==result.sourceHead)return ['integration gate must bind the completed platform changes producer at its actual branch and head'];
  return [];
}

// A gate result is measured, never narrated: each status implies an exact shape for the exit code,
// the evidence and the classification, and a shape mismatch is how a claim with no command behind it
// gets recorded as a pass.
function checkResultShape(r, at, errors) {
  if (r.status === 'pass') {
    if (r.exitCode !== 0) errors.push(`${at} passed with a non-zero exit code`);
    if (r.evidenceRef === null) errors.push(`${at} passed with no evidence to open`);
    if (r.classification !== null) errors.push(`${at} passed but carries a failure classification`);
  } else if (r.status === 'fail') {
    if (r.exitCode === null || r.exitCode === 0) errors.push(`${at} failed with an exit code that reports success`);
    if (r.evidenceRef === null) errors.push(`${at} failed with no evidence to open`);
    if (r.classification === null || r.classification === 'external-blocker') errors.push(`${at} failed without an in-boundary, boundary-drift, or flaky classification`);
  } else if (r.status === 'external-blocker') {
    if (r.classification !== 'external-blocker') errors.push(`${at} was blocked externally but is classified otherwise`);
    if (r.evidenceRef === null) errors.push(`${at} was blocked externally with no evidence to open`);
  } else if (r.status === 'skipped-not-requested') {
    // Available to e2e alone: a gate that quietly did not run reads exactly like a gate that passed.
    if (r.gate !== 'e2e') errors.push(`${at} cannot be skipped as not requested`);
    if (r.exitCode !== null) errors.push(`${at} was skipped but reports an exit code`);
    if (r.evidenceRef !== null) errors.push(`${at} was skipped but names evidence`);
    if (r.classification !== null) errors.push(`${at} was skipped but carries a classification`);
  }
}

export async function validateQualityStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, request, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'quality.verify') return { errors };
  if (response.status === 'done') errors.push(...auditScopeCarryErrors(branchDir, request, response, root));
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  // The plan the person declared, before a command runs.
  const plan = asList(requirements.gates).length ? requirements.gates : DEFAULT_GATES;
  const plannedNames = plan.map((g) => g.gate);
  const requiredNames = plan.filter((g) => g.required !== false).map((g) => g.gate);
  if (new Set(plannedNames).size !== plannedNames.length) errors.push('request.json: gates plans the same gate more than once');
  const e2eRequested = isTrue(requirements.explicitE2eRequest);
  const sonarScope = empty(requirements.sonarScope) ? 'new-code' : String(requirements.sonarScope);
  if (plannedNames.includes('e2e') && !e2eRequested) errors.push('request.json: the e2e gate cannot be planned without an explicit request');
  if (!['new-code', 'overall'].includes(sonarScope)) errors.push(`request.json: sonarScope ${sonarScope} is neither new-code nor overall`);

  const debts = asList(requirements.declaredDebts);
  const debtIds = debts.map((d) => d.debtId);
  if (new Set(debtIds).size !== debtIds.length) errors.push('request.json: declaredDebts repeats a debt identifier');
  for (const d of debts) if (!plannedNames.includes(d.gate)) errors.push(`request.json: debt ${d.debtId} covers ${d.gate}, which is not a planned gate`);

  // At least one producer receipt: a verification with no predecessor has no delivery to measure.
  // A dry predecessor is a plan, not a delivery: it has no commit, so there is no head for a gate to
  // stand on. It is refused here, at step 2, rather than later as a confusing gate failure.
  const sessionRoot = sessionRootOf(branchDir);
  let integrationProducer=null, integrationInputSeen=false;
  const changesRef=request?.inputs?.changes;
  if(sessionRoot && changesRef)try{
    const changesPath=path.join(sessionRoot,changesRef),producerResponseDir=path.dirname(changesPath),producerBranch=path.dirname(producerResponseDir);
    integrationInputSeen=Object.fromEntries(tableUnder(await readFile(changesPath,'utf8'),'## Binding')??[]).Operator==='platform.operate';
    const producerResponse=JSON.parse(await readFile(path.join(producerResponseDir,'response.json'),'utf8'));
    if(producerResponse.operatorId==='platform.operate'){
      integrationInputSeen=true;
      const producerRequest=JSON.parse(await readFile(path.join(producerBranch,'request/request.json'),'utf8'));
      const delta=JSON.parse(await readFile(path.join(producerResponseDir,'data/delta.json'),'utf8'));
      if(producerRequest.operatorId!=='platform.operate' || producerResponse.status!=='done' || path.resolve(producerBranch,producerResponse.fields?.changes??'')!==path.resolve(changesPath))errors.push('integration changes must be emitted by a completed platform owner');
      errors.push(...integrationChangesErrors(delta,await readFile(changesPath,'utf8')));
      integrationProducer={...producerResponse,delta};
    }
  }catch{ if(integrationInputSeen)errors.push('integration changes producer provenance is unreadable'); }
  if (sessionRoot) {
    for (const kind of ['changes', 'backend-source-application', 'frontend-source-application']) {
      const ref = request?.inputs?.[kind];
      if (!ref) continue;
      const full = path.join(sessionRoot, ref);
      if (!existsSync(full)) continue;
      let text; try { text = await readFile(full, 'utf8'); } catch { continue; }
      const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
      const wroteNothing = kind === 'changes'
        ? /nothing written/.test(String(binding.Checkout ?? ''))
        : empty(binding.Commit);
      if (wroteNothing) errors.push(`request.json: PREDECESSOR_STALE — the ${kind} input ${ref} was produced under mode dry and carries no commit; a plan has no head for a gate to stand on`);
    }
  }

  const inputs = Object.keys(request?.inputs ?? {});
  if (response.status !== 'blocked' && !inputs.some((k) => ['backend-source-application', 'frontend-source-application', 'changes'].includes(k))) {
    errors.push('request.json: quality.verify needs at least one of backend-source-application, frontend-source-application, changes');
  }

  // A frontend delivery is measured against the presentation laws as well as the compilers. The
  // sweep is a gate here for the same reason it is a conformance check at frontend.source.apply: a
  // green lint and a green build say nothing about which node a class landed on.
  if (inputs.includes('frontend-source-application') && !plannedNames.includes('presentation-sweep')) {
    errors.push('request.json: a frontend delivery plans the presentation-sweep gate; lint and build do not measure which node a class landed on');
  }

  // One file per gate, read from disk so a gate file nobody listed is still caught.
  const gatesDir = path.join(branchDir, 'response', 'data', 'gates');
  const files = existsSync(gatesDir) ? (await readdir(gatesDir)).filter((f) => f.endsWith('.json')).sort() : [];
  const listed = new Set(asList(response.fields?.['gate-result']));
  for (const f of files) if (!listed.has(`response/data/gates/${f}`)) errors.push(`response/response.json: gate-result does not list response/data/gates/${f}`);

  const byGate = new Map();
  for (const f of files) {
    const rel = `response/data/gates/${f}`;
    let r; try { r = JSON.parse(await read(rel)); } catch { errors.push(`${rel}: is not readable JSON`); continue; }
    const at = `${rel}: gate ${r.gate}`;
    if (`${r.gate}.json` !== f) errors.push(`${rel}: names gate ${r.gate}; one gate result lives in one file named after its gate`);
    if (byGate.has(r.gate)) { errors.push(`${rel}: gate ${r.gate} reports more than one result`); continue; }
    byGate.set(r.gate, r);
    if (!plannedNames.includes(r.gate)) errors.push(`${rel}: gate ${r.gate} reports a result but the request never planned it`);
    const planned = plan.find((g) => g.gate === r.gate);
    if (planned && r.required !== (planned.required !== false)) errors.push(`${at} records required ${r.required} but the plan declares ${planned.required !== false}`);
    if (planned && (r.commandRef !== planned.commandRef || r.configRef !== planned.configRef)) errors.push(`${at} commandRef or configRef differs from the planned gate`);
    checkResultShape(r, at, errors);
  }
  for (const g of plannedNames) if (!byGate.has(g) && response.status === 'done') errors.push(`response/data/gates/${g}.json: the plan names ${g} but no result was measured`);

  // Every gate stands on one head, and that head is the one the request pinned and the predecessor recorded.
  const pinned = (request?.contexts ?? []).find((c) => c.alias === '@workspaces/be' || c.alias === '@workspaces/fe')?.head ?? null;
  const heads = new Set([...byGate.values()].map((r) => r.sourceHead));
  if (heads.size > 1) errors.push(`response/data/gates: the gates measured ${heads.size} different heads (${[...heads].join(', ')}); two heads are two deliveries`);
  for (const r of byGate.values()) {
    const at = `response/data/gates/${r.gate}.json`;
    if (pinned && r.sourceHead !== pinned) errors.push(`${at}: the gate measured ${r.sourceHead} but the request pinned ${pinned}`);
    if (r.predecessorCommit !== r.sourceHead) errors.push(`${at}: the predecessor recorded commit ${r.predecessorCommit}, which is not the head ${r.sourceHead} the gate measured`);
    errors.push(...integrationGateBindingErrors(r,integrationProducer).map(e=>`${at}: ${e}`));
    if(integrationProducer && r.sessionBranch!==integrationProducer.delta.runtimeLadder?.integration?.branch)errors.push(`${at}: integration evidence cannot be relabeled as a session branch`);
  }

  const e2e = byGate.get('e2e');
  if (e2e && e2e.status !== 'skipped-not-requested' && !e2eRequested) errors.push('response/data/gates/e2e.json: the e2e suite ran without an explicit request');

  // Sonar carries the scope it was measured at, and only the sonar gate does.
  for (const r of byGate.values()) {
    const at = `response/data/gates/${r.gate}.json`;
    if (r.gate === 'sonar') { if (r.sonarScope !== sonarScope) errors.push(`${at}: sonarScope ${r.sonarScope} differs from the request's ${sonarScope}`); }
    else if (r.sonarScope !== null) errors.push(`${at}: a sonar scope belongs to the sonar gate alone`);
  }

  // Debt is live, in-boundary, and declared before it is carried.
  const debtByGate = new Map();
  for (const r of byGate.values()) {
    if (r.debt === null) continue;
    const at = `response/data/gates/${r.gate}.json`;
    debtByGate.set(r.gate, r.debt);
    if (!debtIds.includes(r.debt.debtId)) errors.push(`${at}: debt ${r.debt.debtId} was never declared in the request`);
    if (Date.parse(r.debt.expiresAt) <= Date.parse(r.observedAt)) errors.push(`${at}: debt ${r.debt.debtId} carries an approval that expired before the gate was measured`);
    if (r.status !== 'fail') errors.push(`${at}: debt ${r.debt.debtId} covers a gate that did not fail`);
    else if (r.classification !== 'in-boundary') errors.push(`${at}: debt ${r.debt.debtId} owes away a ${r.classification} failure that belongs to the boundary owner`);
  }
  for (const d of debts) if (!debtByGate.has(d.gate) && response.status === 'done') errors.push(`response/data/gates/${d.gate}.json: debt ${d.debtId} was declared but the gate result carries no debt`);

  let coverage = null;
  if (present.has('coverage') && has('response/data/coverage.json')) { try { coverage = JSON.parse(await read('response/data/coverage.json')); } catch { coverage = null; } }
  const unit = byGate.get('unit-coverage');
  const unitMeasured = unit !== undefined && unit.status !== 'skipped-not-requested';
  if (coverage === null && unit?.status === 'pass') errors.push('response/data/coverage.json: the unit-coverage gate passed but reports no coverage measurement');
  if (coverage !== null && !unitMeasured) errors.push('response/data/coverage.json: coverage is reported without a measured unit-coverage gate');
  let below = [];
  let coveragePolicy = null;
  if (coverage !== null) {
    coveragePolicy = coveragePolicyResult(root, branchDir, request, coverage);
    errors.push(...coveragePolicy.errors);
    below = METRICS.filter((m) => typeof coverage.thresholds?.[m] === 'number' && coverage[m] < coverage.thresholds[m]);
    if (below.length && unit?.status === 'pass') errors.push(`response/data/coverage.json: unit-coverage passed while ${below.join(', ')} sit below their own threshold`);
  }

  // The verdict follows the required gates, and the receipt is the only place it is stated.
  const unmet = requiredNames.filter((g) => {
    const r = byGate.get(g);
    if (r === undefined) return true;
    if (r.status === 'pass') return false;
    return !(r.status === 'fail' && debtByGate.has(g));
  });
  const expected = unmet.length ? 'fail' : 'pass';

  if (present.has('quality-verification') && has('response/response.md')) {
    const text = await read('response/response.md');
    if (coverage !== null) errors.push(...coverageTableErrors(tableUnder(text, '## Coverage'), coverage, coveragePolicy?.requireCompleteTable));
    const findingKeys = new Set((tableUnder(text, '## Findings') ?? []).map(([code, gate]) => `${code}|${gate === '—' ? 'null' : gate}`));
    const verdict = Object.fromEntries((tableUnder(text, '## Gate verdict') ?? []).map(([k, v]) => [k, v]));
    if (verdict.Verdict !== expected) errors.push(`response/response.md: Verdict says ${verdict.Verdict} but ${unmet.length ? `required gates ${unmet.join(', ')} neither passed nor carry a debt` : 'every required gate passed or is debt-covered'}`);
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (pinned && binding.Head !== pinned) errors.push(`response/response.md: Binding names head ${binding.Head} but the request pinned ${pinned}`);
    const sonar = Object.fromEntries((tableUnder(text, '## Sonar') ?? []).map(([k, v]) => [k, v]));
    if (byGate.has('sonar') && sonar.Scope !== sonarScope) errors.push(`response/response.md: Sonar scope ${sonar.Scope} differs from the measured ${sonarScope}`);
    if (byGate.get('sonar')?.status === 'pass' && sonarScope === 'new-code' && !findingKeys.has('SONAR_NEW_CODE_ONLY|sonar')) errors.push('response/response.md: a passing new-code Sonar gate must record SONAR_NEW_CODE_ONLY, because the project beneath it may be red');
    if (e2e?.status === 'skipped-not-requested' && !findingKeys.has('E2E_NOT_REQUESTED|e2e')) errors.push('response/response.md: a skipped e2e gate must record E2E_NOT_REQUESTED so the absence is visible');
    if (below.length && !findingKeys.has('COVERAGE_BELOW_THRESHOLD|unit-coverage')) errors.push('response/response.md: coverage below a threshold must record COVERAGE_BELOW_THRESHOLD');
    for (const [gate, debt] of debtByGate) if (!findingKeys.has(`DEBT_DECLARED|${gate}`)) errors.push(`response/response.md: debt ${debt.debtId} is carried without recording DEBT_DECLARED`);
    for (const key of findingKeys) { const gate = key.split('|')[1]; if (gate !== 'null' && !plannedNames.includes(gate)) errors.push(`response/response.md: a finding names unplanned gate ${gate}`); }
    // The scorecard: one row per topic, and the line that says whether it passed.
    const rows = (tableUnder(text, '## Verdict') ?? []).map(([topic, v, route]) => ({ topic: topic.replaceAll('`', ''), verdict: v, routeTo: route }));
    for (const topic of SCORECARD_TOPICS) if (!rows.some((r) => r.topic === topic)) errors.push(`response/response.md: Verdict carries no ${topic} row; a topic nobody reported is not a topic that passed`);
    for (const row of rows) {
      if (!SCORECARD_TOPICS.includes(row.topic)) errors.push(`response/response.md: Verdict names ${row.topic}, which is not one of the nine topics`);
      if (row.verdict === 'blocked' && row.routeTo !== 'none') errors.push(`response/response.md: ${row.topic} is blocked and still routes to ${row.routeTo}; a topic nobody observed has no owner to send it to`);
      if ((row.verdict === 'pass' || row.verdict === 'ship') && row.routeTo !== 'none') errors.push(`response/response.md: ${row.topic} ${row.verdict === 'ship' ? 'ships' : 'passes'} and still routes to ${row.routeTo}`);
      if ((row.verdict === 'fail' || row.verdict === 'fix-first') && row.routeTo === 'none') errors.push(`response/response.md: ${row.topic} is ${row.verdict} and routes nowhere`);
    }
    if (rows.length) {
      const line = /^Verdict: (ship|fix-first|blocked)$/m.exec(text);
      const computed = scorecardVerdict(rows);
      if (!line) errors.push('response/response.md: Verdict closes with no "Verdict: ship|fix-first|blocked" line');
      else if (line[1] !== computed) errors.push(`response/response.md: Verdict reads ${line[1]}; the rows make it ${computed}`);
    }

    const mdResults = tableUnder(text, '## Results') ?? [];
    if (mdResults.length !== byGate.size) errors.push(`response/response.md: Results has ${mdResults.length} rows, the gate files measure ${byGate.size}`);
    for (const row of mdResults) {
      const r = byGate.get(row[0]);
      if (!r) { errors.push(`response/response.md: Results names gate ${row[0]}, which no gate file measures`); continue; }
      if (row[1] !== r.status) errors.push(`response/response.md: gate ${row[0]} is ${row[1]} in the receipt and ${r.status} in its gate file`);
    }
    const mdPlan = tableUnder(text, '## Gate plan') ?? [];
    if (mdPlan.length !== plannedNames.length) errors.push(`response/response.md: Gate plan has ${mdPlan.length} rows, the request plans ${plannedNames.length}`);
  } else if (response.status === 'done') errors.push('response/response.md: a done branch needs the verification receipt');

  if (response.status === 'done' && byGate.size === 0) errors.push('response/data/gates: a done branch needs at least one measured gate');
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateQualityStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid quality.verify branch\n');
}
