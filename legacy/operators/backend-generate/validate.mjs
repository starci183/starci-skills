// backend.generate's own law over one branch, on top of the shared step check: the write set arrives
// as exactly one commit on the session branch, and the mutation record, response.json.commits and the
// change record name that same sha; every operation the frozen contract carries is restated once and
// applied; every change lies inside an owner boundary or is a recorded widening (listed under
// ## Widened, marked widened in the mutation record, OWNER_WIDENED taken) and never inside a protected
// ref, names a declared operation, appears once, and carries the hash pair its kind demands; a dry run
// commits nothing, writes no after hash, measures no
// facet and runs no proof, and reports every planned path as unchanged in the change record; every
// declared facet of an applied run has its own conformance file, named for
// the operation and facet it measures, with evidence, and every verdict in a done branch conforms;
// every declared proof ran exactly once in its own file, with a command, an exit code that agrees with
// its result, and a pass; the change record and the receipt describe the same files; no finding names
// an undeclared operation, and a done branch raises no business question.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { validateMigrationOperation } from '../../scripts/migration-operation.mjs';
import { validateMigrationContract } from '../../scripts/migration-contract.mjs';
import { sourceCheckoutOf, sourceWriteErrors } from '../../scripts/workspace-checkout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// A change record is the only durable trace that a file was mutated, so the hash pair has to agree with
// the kind. A modified record whose before and after hashes are equal describes a mutation that never
// happened.
const HASH_SHAPE = { added: { before: 'null', after: 'set' }, modified: { before: 'set', after: 'set' }, deleted: { before: 'set', after: 'null' } };
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));
const listed = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// An owner ref is an exact repository-relative path or a glob: `*` within one segment, `**` across
// segments (`a/**/b` also matches `a/b`, `a/**` matches everything under `a/`). A ref with no glob
// character matches itself only.
const isGlob = (ref) => /[*]/.test(ref);
export function refToRegExp(ref) {
  const segments = ref.split('/');
  let source = '';
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    if (seg === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += seg.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '[^/]*') + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`);
}
const matcherOf = (refs) => {
  const rules = refs.map((ref) => ({ ref, re: refToRegExp(ref) }));
  return (file) => rules.find((r) => r.re.test(file))?.ref ?? null;
};

export async function validateBackendStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'backend.generate') return { errors };
  // `scope` fix: the orchestrator's fix size bounds the moved paths when it publishes one, and nothing
  // widens; the number is read from resources/orchestrator.json#fixSize and hard-coded nowhere here.
  const scope = requirements.scope ?? 'full';
  if (!['full', 'fix'].includes(scope)) errors.push(`request.json: scope ${scope} is neither full nor fix`);
  if (scope === 'fix') {
    if ((response.fallbacks ?? []).includes('OWNER_WIDENED')) errors.push('response/response.json: OWNER_WIDENED was taken under scope fix; a fix widens nothing, and a path outside every boundary is OWNER_CONFLICT');
    let size = null;
    try { size = JSON.parse(await readFile(path.join(root, 'resources', 'orchestrator.json'), 'utf8')).fixSize ?? null; } catch { size = null; }
    let planned = null;
    try { planned = JSON.parse(await readFile(path.join(branchDir, 'response/data/mutations.json'), 'utf8')); } catch { planned = null; }
    const moved = (planned?.changes ?? []).filter((c) => c.change !== 'unchanged').length;
    if (size && Number.isInteger(size.maxFiles) && moved > size.maxFiles) errors.push(`response/data/mutations.json: scope fix moves ${moved} paths and the orchestrator's fix size allows ${size.maxFiles}; a bigger repair runs under scope full`);
  }
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const readJson = async (f) => { try { return JSON.parse(await read(f)); } catch { return null; } };
  // Ownership is a boundary, not a list: `mutableFileRefs` says what the outcome may touch, `protectedRefs`
  // what it may never touch, and a required path outside every boundary is written as a recorded widening.
  const boundaries = Array.isArray(requirements.mutableFileRefs) ? requirements.mutableFileRefs.map(String) : [];
  const protectedRefs = Array.isArray(requirements.protectedRefs) ? requirements.protectedRefs.map(String) : [];
  const insideBoundary = matcherOf(boundaries);
  const insideProtected = matcherOf(protectedRefs);
  const bounded = boundaries.length > 0;
  // Owner sets that overlap: a ref both lists carry, or an exact boundary a protected ref covers, is a boundary nothing may write into.
  for (const ref of boundaries) {
    if (protectedRefs.includes(ref)) errors.push(`request/request.json: ${ref} is both a boundary and a protected ref; overlapping owner sets are OWNER_CONFLICT`);
    else if (!isGlob(ref) && insideProtected(ref)) errors.push(`request/request.json: boundary ${ref} lies inside protected ref ${insideProtected(ref)}; overlapping owner sets are OWNER_CONFLICT`);
  }
  // `mode` decides whether this branch touched the checkout at all; everything below reads differently under dry.
  const mode = requirements.mode ?? 'apply';

  // A blocked branch has no implementation at all, and nothing it may have written is committed.
  if (response.status === 'blocked' && (present.has('backend-source-application') || present.has('mutations') || present.has('conformance') || present.has('proof'))) {
    errors.push('response/response.json: a blocked branch cannot carry an implementation');
  }
  if (response.status === 'blocked' && (response.commits ?? []).length) {
    errors.push('response/response.json: a blocked branch commits nothing');
  }

  const mutations = present.has('mutations') && has('response/data/mutations.json') ? await readJson('response/data/mutations.json') : null;
  const declared = mutations ? mutations.operations : [];
  const declaredById = new Map(declared.map((o) => [o.operationId, o]));
  errors.push(...(await validateMigrationContract(root, branchDir, base.request, mutations)).errors);

  // The plan cannot re-decide the mode the request asked for.
  if (mutations && mutations.mode !== mode) errors.push(`response/data/mutations.json: mode ${mutations.mode} differs from the request's ${mode}`);

  // A dry run answers with the plan alone: nothing committed, nothing measured, nothing hashed after.
  if (mode === 'dry') {
    if (mutations && mutations.commit !== null) errors.push('response/data/mutations.json: a dry run commits nothing, so commit must be null');
    if ((response.commits ?? []).length) errors.push('response/response.json: a dry run records no commit');
    if (present.has('conformance') || present.has('proof')) errors.push('response/response.json: a dry run measures nothing, so it carries no conformance or proof record');
  }

  // One commit on the session branch, named the same way in three places.
  if (response.status === 'done' && mode === 'apply') {
    const commits = response.commits ?? [];
    if (commits.length !== 1) errors.push(`response/response.json: a done branch commits its whole write set once, found ${commits.length} commits`);
    if (mutations && commits.length === 1 && mutations.commit !== commits[0]) errors.push(`response/data/mutations.json: commit ${mutations.commit} differs from response.json commits[0] ${commits[0]}`);
    // Required of an applied branch only: a dry run has no source to measure, and the Outputs table can only say yes or no.
    for (const kind of ['conformance', 'proof']) if (!present.has(kind)) errors.push(`response/response.json: required output ${kind} is not in fields`);
  }
  if (mutations) {
    if (mode === 'apply' && mutations.commit === mutations.base) errors.push('response/data/mutations.json: the commit equals the base, so nothing was written on the session branch');
    for (const operation of declared) {
      const at = `response/data/mutations.json: operation ${operation.operationId}`;
      errors.push(...await validateMigrationOperation(root, operation, at));
      if (insideProtected(operation.writerRef)) errors.push(`${at} names writer ${operation.writerRef} inside protected ref ${insideProtected(operation.writerRef)}; a protected ref is never written, so this is OWNER_CONFLICT`);
      const shipsMigration = (operation.migrationRefs ?? []).length > 0;
      // A migration without a replay proof is a schema change nobody re-ran.
      if (shipsMigration && !operation.proofKinds.includes('migration-replay')) errors.push(`${at} ships a migration without declaring the migration-replay proof`);
      if (shipsMigration && !operation.facets.includes('migration')) errors.push(`${at} ships a migration without declaring the migration facet`);
      if (!shipsMigration && operation.proofKinds.includes('migration-replay')) errors.push(`${at} declares a migration-replay proof but ships no migration`);
      // A mutation arriving through a boundary declared not to mutate.
      if (operation.transactionBoundary === 'read-only' && shipsMigration) errors.push(`${at} is read-only but ships a migration`);
      // A redelivered event applies twice unless something makes the write idempotent.
      if (operation.transport === 'event-consumer' && operation.idempotencyKind === 'none') errors.push(`${at} consumes events with no idempotency and will apply twice on redelivery`);
      if (new Set(operation.facets).size !== operation.facets.length) errors.push(`${at} repeats a contract facet`);
      if (new Set(operation.proofKinds).size !== operation.proofKinds.length) errors.push(`${at} repeats a proof kind`);
      if (new Set(operation.authorityDimensionIds).size !== operation.authorityDimensionIds.length) errors.push(`${at} repeats a business dimension identifier`);
    }
    if (declared.length && declaredById.size !== declared.length) errors.push('response/data/mutations.json: the contract repeats an operationId');

    const changedPaths = new Set();
    for (const change of mutations.changes) {
      if (changedPaths.has(change.path)) errors.push(`response/data/mutations.json: file ${change.path} carries more than one change record`);
      changedPaths.add(change.path);
      if (declaredById.size && !declaredById.has(change.operationId)) errors.push(`response/data/mutations.json: change on ${change.path} names undeclared operation ${change.operationId}`);
      if (insideProtected(change.path)) errors.push(`response/data/mutations.json: change on ${change.path} lies inside protected ref ${insideProtected(change.path)}; a protected ref is never written, even as a widening, so this is OWNER_CONFLICT`);
      // The flag and the boundary must agree: widened means outside every boundary, and nothing else does.
      if (bounded && insideBoundary(change.path) && change.widened === true) errors.push(`response/data/mutations.json: change on ${change.path} is marked widened but lies inside boundary ${insideBoundary(change.path)}; there is nothing to widen`);
      if (bounded && !insideBoundary(change.path) && change.widened !== true) errors.push(`response/data/mutations.json: change on ${change.path} lies outside every owner boundary and is not marked widened: true`);
      const shape = HASH_SHAPE[change.change];
      if ((shape.before === 'set') !== (change.beforeHash !== null)) errors.push(`response/data/mutations.json: change on ${change.path} is ${change.change} with the wrong before hash`);
      if (mode === 'dry') {
        // A planned path has no new content yet, so an after hash could only have been invented.
        if (change.afterHash !== null) errors.push(`response/data/mutations.json: change on ${change.path} reports an after hash under a dry run, which writes nothing`);
      } else {
        if ((shape.after === 'set') !== (change.afterHash !== null)) errors.push(`response/data/mutations.json: change on ${change.path} is ${change.change} with the wrong after hash`);
        if (change.change === 'modified' && change.beforeHash === change.afterHash) errors.push(`response/data/mutations.json: change on ${change.path} records a modification whose hashes are identical`);
      }
    }
  }

  // One conformance file per declared facet, named for what it measures.
  const conformanceKeys = new Set();
  for (const file of listed(response.fields?.conformance)) {
    const record = has(file) ? await readJson(file) : null;
    if (!record) continue;
    const expected = `response/data/conformance/${record.operationId}.${record.facet}.json`;
    if (file !== expected) errors.push(`${file}: a conformance record of ${record.operationId} ${record.facet} must be filed as ${expected}`);
    const key = `${record.operationId}|${record.facet}`;
    if (conformanceKeys.has(key)) errors.push(`${file}: operation ${record.operationId} records ${record.facet} conformance twice`);
    conformanceKeys.add(key);
    const operation = declaredById.get(record.operationId);
    if (declaredById.size && !operation) { errors.push(`${file}: conformance names undeclared operation ${record.operationId}`); continue; }
    if (operation && !operation.facets.includes(record.facet)) errors.push(`${file}: operation ${record.operationId} proves undeclared facet ${record.facet}`);
    if (mutations && record.contractFingerprint !== mutations.contractFingerprint) errors.push(`${file}: measured against another contract fingerprint than the one filled`);
    // A widened or narrowed facet means the frozen contract was not filled as written.
    if (response.status === 'done' && record.verdict !== 'conforms') errors.push(`${file}: operation ${record.operationId} reports ${record.verdict} ${record.facet} conformance in a done branch`);
    if (empty(record.evidenceRef)) errors.push(`${file}: operation ${record.operationId} asserts ${record.facet} conformance with no evidence`);
  }

  const proofKeys = new Set();
  for (const file of listed(response.fields?.proof)) {
    const record = has(file) ? await readJson(file) : null;
    if (!record) continue;
    const expected = `response/data/proofs/${record.operationId}.${record.proofKind}.json`;
    if (file !== expected) errors.push(`${file}: a proof of ${record.operationId} ${record.proofKind} must be filed as ${expected}`);
    const key = `${record.operationId}|${record.proofKind}`;
    if (proofKeys.has(key)) errors.push(`${file}: operation ${record.operationId} records the ${record.proofKind} proof twice`);
    proofKeys.add(key);
    const operation = declaredById.get(record.operationId);
    if (declaredById.size && !operation) { errors.push(`${file}: proof names undeclared operation ${record.operationId}`); continue; }
    if (operation && !operation.proofKinds.includes(record.proofKind)) errors.push(`${file}: operation ${record.operationId} runs undeclared proof ${record.proofKind}`);
    if (mutations && record.contractFingerprint !== mutations.contractFingerprint) errors.push(`${file}: run against another contract fingerprint than the one filled`);
    // The exit code is what was actually read; the verdict is a reading of it.
    if ((record.exitCode === 0) !== (record.result === 'passed')) errors.push(`${file}: exit code ${record.exitCode} contradicts the ${record.result} verdict`);
    if (response.status === 'done' && record.result !== 'passed') errors.push(`${file}: operation ${record.operationId} reports a failed ${record.proofKind} proof in a done branch`);
  }

  if (response.status === 'done' && mode === 'apply') {
    for (const operation of declared) {
      // Silence about a facet reads exactly like a pass.
      for (const facet of operation.facets) if (!conformanceKeys.has(`${operation.operationId}|${facet}`)) errors.push(`response/data/conformance/${operation.operationId}.${facet}.json: the operation declares the ${facet} facet and no record proves it`);
      for (const proofKind of operation.proofKinds) if (!proofKeys.has(`${operation.operationId}|${proofKind}`)) errors.push(`response/data/proofs/${operation.operationId}.${proofKind}.json: the operation declares the ${proofKind} proof and never ran it`);
    }
  }

  let receiptFiles = null;
  if (present.has('backend-source-application') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = fields(tableUnder(text, '## Binding'));
    if (!empty(requirements.outcome) && binding.Outcome !== requirements.outcome) errors.push('response/response.md: Outcome differs from the request');
    if (!empty(requirements.featureId) && binding.Feature !== requirements.featureId) errors.push('response/response.md: Feature differs from the request');
    if (binding.Mode !== undefined && binding.Mode !== mode) errors.push(`response/response.md: Mode ${binding.Mode} differs from the request's ${mode}`);
    if (mutations) {
      if (binding['Contract fingerprint'] !== mutations.contractFingerprint) errors.push('response/response.md: Contract fingerprint differs from the fingerprint the mutations were measured against');
      if (binding.Base !== mutations.base) errors.push('response/response.md: Base differs from the base the session branch was cut from');
      if (binding.Branch !== mutations.branch) errors.push('response/response.md: Branch differs from the session branch the write set lives on');
      if (binding.Commit !== (mutations.commit ?? '—')) errors.push('response/response.md: Commit differs from the one commit the write set arrived as');
    }

    const applied = new Set();
    for (const [operationId, transport, writer, transaction, idempotency, decisions] of tableUnder(text, '## Operations') ?? []) {
      if (applied.has(operationId)) errors.push(`response/response.md: operation ${operationId} is declared more than once`);
      applied.add(operationId);
      const operation = declaredById.get(operationId);
      if (declaredById.size && !operation) { errors.push(`response/response.md: operation ${operationId} is not in the frozen contract`); continue; }
      if (!operation) continue;
      if (transport !== operation.transport) errors.push(`response/response.md: operation ${operationId} reports transport ${transport}, the contract froze ${operation.transport}`);
      if (writer !== operation.writerRef) errors.push(`response/response.md: operation ${operationId} reports writer ${writer}, the contract froze ${operation.writerRef}`);
      if (transaction !== operation.transactionBoundary) errors.push(`response/response.md: operation ${operationId} reports transaction ${transaction}, the contract froze ${operation.transactionBoundary}`);
      if (idempotency !== operation.idempotencyKind) errors.push(`response/response.md: operation ${operationId} reports idempotency ${idempotency}, the contract froze ${operation.idempotencyKind}`);
      const cited = String(decisions).split(',').map((s) => s.trim()).filter(Boolean);
      for (const dimensionId of cited) if (!operation.authorityDimensionIds.includes(dimensionId)) errors.push(`response/response.md: operation ${operationId} cites dimension ${dimensionId}, which the contract does not bind`);
      for (const dimensionId of operation.authorityDimensionIds) if (!cited.includes(dimensionId)) errors.push(`response/response.md: operation ${operationId} does not restate approved dimension ${dimensionId}`);
    }
    if (response.status === 'done') for (const operationId of declaredById.keys()) if (!applied.has(operationId)) errors.push(`response/response.md: operation ${operationId} was declared but never applied`);

    const seenFiles = new Set();
    const changeById = new Map((mutations?.changes ?? []).map((c) => [c.path, c]));
    for (const [file, changeKind, operationId, before, after] of tableUnder(text, '## Changes') ?? []) {
      if (seenFiles.has(file)) errors.push(`response/response.md: file ${file} carries more than one change record`);
      seenFiles.add(file);
      const record = changeById.get(file);
      if (mutations && !record) { errors.push(`response/response.md: change on ${file} is absent from the mutation record`); continue; }
      if (!record) continue;
      if (changeKind !== record.change) errors.push(`response/response.md: change on ${file} is ${changeKind} here and ${record.change} in the mutation record`);
      if (operationId !== record.operationId) errors.push(`response/response.md: change on ${file} names operation ${operationId}, the mutation record names ${record.operationId}`);
      if ((empty(before) ? null : before) !== record.beforeHash) errors.push(`response/response.md: change on ${file} disagrees with the mutation record on the before hash`);
      if ((empty(after) ? null : after) !== record.afterHash) errors.push(`response/response.md: change on ${file} disagrees with the mutation record on the after hash`);
    }
    if (mutations) for (const p of changeById.keys()) if (!seenFiles.has(p)) errors.push(`response/response.md: the mutation record changed ${p}, which the receipt omits`);
    receiptFiles = seenFiles;

    // ## Widened is the receipt's admission of every write outside the owner boundary: one row per
    // widened path, naming a declared boundary as the nearest one, never a path a boundary already covers
    // and never a protected ref; a written path outside every boundary with no row is an unrecorded
    // widening, which is OWNER_CONFLICT. The rows and the OWNER_WIDENED fallback exist together or not at all.
    const widenedRows = tableUnder(text, '## Widened') ?? [];
    const widened = new Map();
    const touched = new Set([...changeById.keys(), ...declared.map((o) => o.writerRef)]);
    for (const [file, nearest] of widenedRows) {
      if (widened.has(file)) errors.push(`response/response.md: ${file} is listed under ## Widened more than once`);
      widened.set(file, nearest);
      if (bounded && insideBoundary(file)) errors.push(`response/response.md: ${file} is listed under ## Widened but lies inside boundary ${insideBoundary(file)}; there is nothing to widen`);
      if (insideProtected(file)) errors.push(`response/response.md: ${file} is listed under ## Widened but lies inside protected ref ${insideProtected(file)}; a protected ref is never written, so this is OWNER_CONFLICT`);
      if (bounded && !boundaries.includes(nearest)) errors.push(`response/response.md: ${file} names nearest boundary ${nearest}, which mutableFileRefs does not declare`);
      if (mutations && !touched.has(file)) errors.push(`response/response.md: ${file} is listed under ## Widened but no change record or writer touches it`);
    }
    if (bounded && mutations) {
      for (const p of changeById.keys()) if (!insideBoundary(p) && !widened.has(p)) errors.push(`response/data/mutations.json: change on ${p} lies outside every owner boundary and is not listed under ## Widened; an unrecorded widening is OWNER_CONFLICT`);
      for (const operation of declared) if (!insideBoundary(operation.writerRef) && !widened.has(operation.writerRef)) errors.push(`response/data/mutations.json: operation ${operation.operationId} names writer ${operation.writerRef} outside every owner boundary and not listed under ## Widened; an unrecorded widening is OWNER_CONFLICT`);
    }
    const tookWidening = (response.fallbacks ?? []).includes('OWNER_WIDENED');
    if (tookWidening && widened.size === 0) errors.push('response/response.json: OWNER_WIDENED was taken but ## Widened lists no path; a fallback with nothing behind it was not taken');
    if (!tookWidening && widened.size > 0) errors.push('response/response.md: ## Widened lists a path but response.json does not record OWNER_WIDENED as taken');

    for (const [code, operationId] of tableUnder(text, '## Findings') ?? []) {
      if (!empty(operationId) && declaredById.size && !declaredById.has(operationId)) errors.push(`response/response.md: finding ${code} names undeclared operation ${operationId}`);
      // Raising the business question and shipping anyway is the exact contradiction to catch.
      if (code === 'BUSINESS_QUESTION_RAISED' && response.status === 'done') errors.push('response/response.md: a done branch cannot raise an unresolved business question');
    }
  }

  // The change record the next step reads must describe the same files and pin the same commit.
  if (present.has('changes') && has('response/changes.md')) {
    const text = await read('response/changes.md');
    if (mutations) {
      const binding = fields(tableUnder(text, '## Binding'));
      // What the branch did to the checkout, beside what it wrote into it: the preflight that ran before
      // the first write, and the reflog entries the checkout gained while the branch held it
      // (scripts/workspace-checkout.mjs#sourceWriteErrors, orchestrator.json#sourceWrites).
      errors.push(...sourceWriteErrors({
        at: 'response/changes.md', binding, base: mutations.base, branch: mutations.branch, mode,
        commits: response.commits ?? [], status: response.status,
        checkout: sourceCheckoutOf(root, branchDir, base.request),
      }));
      const checkout = binding.Checkout ?? '';
      // A dry run wrote nothing, so the next request can only pin the base it read.
      const expected = mode === 'dry'
        ? `@workspaces/be at ${mutations.base} on ${mutations.branch}, nothing written`
        : `@workspaces/be at ${mutations.base} → ${mutations.commit} on ${mutations.branch}`;
      const seen = checkout.replaceAll('`', '').replace(/\s+/g, ' ').trim();
      if (seen !== expected) errors.push(`response/changes.md: Checkout must read ${expected}, so the next request can pin exactly what was written; it reads ${seen}`);
    }
    if (mode === 'dry') {
      // The Change column reports the working tree, and a dry run left every path in it alone.
      for (const [file, kind] of tableUnder(text, '## Files') ?? []) {
        if (kind !== 'unchanged') errors.push(`response/changes.md: ${file} is reported ${kind} under a dry run, which leaves every path unchanged in the working tree`);
      }
    }
    if (receiptFiles) {
      const changed = new Set((tableUnder(text, '## Files') ?? []).map(([p]) => p));
      for (const file of changed) if (!receiptFiles.has(file)) errors.push(`response/changes.md: ${file} is not in the receipt's change records`);
      for (const file of receiptFiles) if (!changed.has(file)) errors.push(`response/changes.md: the receipt changed ${file}, which the change record omits`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateBackendStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid backend.generate branch\n');
}
