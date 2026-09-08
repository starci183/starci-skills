// generate-banks' own law over one run, on top of the shape check every helper package passes
// (scripts/validate-helper.mjs). A run is a folder under @worktrees/helpers/generate-banks/runs/ and,
// when it finished, the bank it left under @worktrees/banked/<product>:
//   - the run record is this helper's, its runId is its folder, and every output it names sits under
//     one of the Writes aliases the package declares — a helper that wrote anywhere else is the one
//     failure the support layer exists to prevent;
//   - a stopped run wrote no bank at all, because a bank is written whole or not at all;
//   - the bank itself is lawful (scripts/bank.mjs#validateBank): every mission against its schema, the
//     queue against its missions, at least one evidence ref each;
//   - the queue and every mission name this run, so a bank can always be traced to the reading that
//     produced it and a stale draft told from a fresh one;
//   - the queue is in the order a drafted bank comes out in (scripts/bank.mjs#plannedOrder), and no
//     longer than the run's own limit;
//   - a tier hint is copied from the unchecked entry it came from and never invented, because the tier
//     itself belongs to the plan of the mission and a hint nobody can trace is a decision in disguise.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { validateBank, plannedOrder, isDropped, canonical, sha256 } from '../../scripts/bank.mjs';
import { writeAliasOf } from '../../scripts/helper-md.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HELPER = 'generate-banks';
const RUN = 'run.json';
const NOTHING_WRITTEN = new Set(['BANK_EMPTY', 'BANK_UNGROUNDED', 'PRODUCT_UNROUTED', 'INVALID_INPUT']);

export async function validateGenerateBanksRun(runDir, hostRoot, { root = ROOT } = {}) {
  const errors = [];
  const at = `runs/${path.basename(runDir)}/${RUN}`;
  const file = path.join(runDir, RUN);
  if (!existsSync(file)) return { errors: [`${at}: missing; a helper run leaves exactly one run record`] };
  let run;
  try { run = JSON.parse(await readFile(file, 'utf8')); } catch (e) { return { errors: [`${at}: ${e.message}`] }; }
  const schema = JSON.parse(await readFile(path.join(root, 'templates', 'kinds', 'helper-run.schema.json'), 'utf8'));
  errors.push(...validateAgainst(schema, run, at));
  if (errors.length) return { errors };

  if (run.helper !== HELPER) errors.push(`${at}: helper ${run.helper} is not ${HELPER}`);
  if (run.runId !== path.basename(runDir)) errors.push(`${at}: runId ${run.runId} is not the folder ${path.basename(runDir)}`);
  const manifest = JSON.parse(await readFile(path.join(root, 'helpers', HELPER, 'helper.json'), 'utf8'));
  const writable = new Set(manifest.writes ?? []);
  for (const out of run.outputs ?? []) {
    const parsed = writeAliasOf(out);
    const base = [...writable].filter((w) => parsed && (parsed.alias === w || out.startsWith(`${w}/`))).sort((a, b) => b.length - a.length)[0];
    if (!base) errors.push(`${at}: output ${out} is under no Writes alias of ${HELPER} (${[...writable].join(', ')}); a helper writes only what its package declares`);
  }

  const product = run.args?.product;
  const wroteBank = (run.outputs ?? []).some((o) => o.startsWith('@worktrees/banked'));
  if (run.contractVersion === 'starci/v2.2') {
    const inputRefs = new Set((run.inputs ?? []).map((input) => input.ref));
    for (const source of run.sourceCoverage ?? []) {
      if (!inputRefs.has(source.ref)) errors.push(`${at}: sourceCoverage ref ${source.ref} is absent from inputs; coverage names what this run actually read`);
      if (!(source.evidence ?? []).length) errors.push(`${at}: sourceCoverage ref ${source.ref} carries no evidence`);
      for (const evidence of source.evidence ?? []) if (!inputRefs.has(evidence)) errors.push(`${at}: sourceCoverage evidence ${evidence} is absent from inputs; evidence must resolve to a recorded read`);
    }
    const incomplete = (run.sourceCoverage ?? []).some((source) => source.state !== 'valid');
    if (incomplete && run.outcome !== 'incomplete') errors.push(`${at}: missing, invalid or stale source coverage requires outcome incomplete`);
    if (!incomplete && run.outcome === 'incomplete') errors.push(`${at}: outcome incomplete names no missing, invalid or stale source`);
    if (run.outcome === 'empty' && wroteBank) errors.push(`${at}: outcome empty names a bank output; an empty reading changes no bank`);
    if (['incomplete', 'reused'].includes(run.outcome) && wroteBank) errors.push(`${at}: outcome ${run.outcome} names a bank output; an unchanged bank is not rewritten`);
    if (['drafted', 'updated'].includes(run.outcome) && !wroteBank) errors.push(`${at}: outcome ${run.outcome} names no bank output`);
    if (!(run.outputs ?? []).includes(`@worktrees/helpers/${HELPER}/runs/${run.runId}/run.json`)) errors.push(`${at}: every outcome, including empty and incomplete, names its own immutable run record`);
  }
  if (run.stop) {
    if (NOTHING_WRITTEN.has(run.stop) && wroteBank) errors.push(`${at}: stopped with ${run.stop} and still names a bank output; a bank is written whole or not at all`);
    if (run.contractVersion === 'starci/v2.2' && JSON.stringify(run.bankBefore) !== JSON.stringify(run.bankAfter)) errors.push(`${at}: a stopped run changed its bank summary`);
    return { errors };
  }
  if (!product) { errors.push(`${at}: a finished run names the product it banked in args.product`); return { errors }; }

  const { errors: bankErrors, bank } = await validateBank(hostRoot, product, { root });
  errors.push(...bankErrors);
  if (bankErrors.length || !bank.queue) return { errors };

  if (run.contractVersion === 'starci/v2.2') {
    const after = run.bankAfter;
    if (after.queueHash !== bank.hash) errors.push(`${at}: bankAfter.queueHash ${after.queueHash} does not match emitted bank ${bank.hash}`);
    const approvalHash = bank.approvals ? sha256(canonical(bank.approvals)) : null;
    if (after.approvalHash !== approvalHash) errors.push(`${at}: bankAfter.approvalHash does not match approvals.json bytes`);
    const actualEntries = bank.queue.entries.map(({ missionId, status }) => ({ missionId, status }));
    if (JSON.stringify(after.entries) !== JSON.stringify(actualEntries)) errors.push(`${at}: bankAfter.entries does not match the emitted queue order and status`);
    const beforeById = new Map((run.bankBefore?.entries ?? []).map((entry) => [entry.missionId, entry.status]));
    const afterById = new Map((after.entries ?? []).map((entry) => [entry.missionId, entry.status]));
    for (const [missionId, status] of beforeById) {
      if (status !== 'banked' && afterById.get(missionId) !== status) errors.push(`${at}: existing mission ${missionId} status ${status} was not preserved`);
    }
    if (run.bankBefore?.approvalHash !== null && run.bankBefore?.approvalHash !== after.approvalHash) errors.push(`${at}: existing approval bytes changed during helper drafting`);
    for (const join of run.deduplications ?? []) {
      if (!afterById.has(join.keptMissionId)) errors.push(`${at}: deduplication keeps missing mission ${join.keptMissionId}`);
      for (const merged of join.mergedMissionIds) if (afterById.has(merged)) errors.push(`${at}: deduplication says ${merged} merged into ${join.keptMissionId}, but both remain in the queue`);
      if (!(join.evidence ?? []).length) errors.push(`${at}: deduplication for ${join.keptMissionId} names no joined evidence`);
    }
    if (['empty', 'incomplete', 'reused'].includes(run.outcome) && JSON.stringify(run.bankBefore) !== JSON.stringify(run.bankAfter)) errors.push(`${at}: outcome ${run.outcome} changed the bank summary`);
  }

  const names = (o) => o?.helper === HELPER && o?.runId === run.runId;
  const wroteThisBank = run.contractVersion !== 'starci/v2.2' || ['drafted', 'updated'].includes(run.outcome);
  if (wroteThisBank && !names(bank.queue.bankedBy)) errors.push(`@worktrees/banked/${product}/queue.json: bankedBy does not name run ${run.runId} of ${HELPER}; every changed bank names the run that drafted it`);
  for (const [id, mission] of bank.missions) {
    if (wroteThisBank && !names(mission.bankedBy)) errors.push(`@worktrees/banked/${product}/${id}/mission.json: bankedBy does not name run ${run.runId} of ${HELPER}`);
    if (mission.tierHint && !(mission.evidenceRefs ?? []).some((r) => r.startsWith('unchecked:'))) errors.push(`@worktrees/banked/${product}/${id}/mission.json: tierHint ${mission.tierHint} names no unchecked: evidence ref; a tier hint is copied from the ledger entry it came from, never invented`);
  }
  const live = bank.queue.entries.filter((e) => !isDropped(e));
  const limit = run.args?.limit;
  if (Number.isInteger(limit) && live.length > limit) errors.push(`@worktrees/banked/${product}/queue.json: ${live.length} entries past the run's limit of ${limit}; a reading that finds more banks the most grounded and says what it left`);
  const order = plannedOrder(bank.queue.entries);
  if (order === null) errors.push(`@worktrees/banked/${product}/queue.json: dependsOn is a cycle; nothing in it could ever be taken`);
  else if (order.join() !== live.map((e) => e.missionId).join()) errors.push(`@worktrees/banked/${product}/queue.json: the queue reads ${live.map((e) => e.missionId).join(', ')} and a drafted bank comes out as ${order.join(', ')}; a helper orders by what a mission waits for, then by priority, then by id`);
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [target, hostArg] = process.argv.slice(2);
  if (!target) { process.stderr.write('usage: node validate.mjs <@worktrees/helpers/generate-banks/runs/<runId>> [hostRoot]\n'); process.exit(2); }
  const runDir = path.resolve(target);
  const hostRoot = hostArg ? path.resolve(hostArg) : path.resolve(ROOT, '..');
  const { errors } = await validateGenerateBanksRun(runDir, hostRoot);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid generate-banks run\n');
}
