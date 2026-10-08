#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {loadRecords, indexInlineCriteria, resolveRecordRef} from '../record-ownership.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { workCommonDef } from '../../lib/work-schemas.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { fromRoot, isList, repoRoot, shownFile } from './work-consistency-shared.mjs';
import { checkAcceptanceNaming } from './work-consistency-criteria.mjs';
import { checkConflicts, checkGapClosure, checkProvesAsymmetry } from './work-consistency-claims.mjs';
import { checkCatalog } from './work-consistency-catalog.mjs';

/**
 * Every check so far reads one record and asks whether that record agrees with itself: an id
 * matching its directory, a digest matching its bytes, a ref that resolves to something
 * (check-example-work.mjs), or a record against the code and files around it (check-work-deep.mjs). Nothing
 * asked whether the records agree with EACH OTHER, and that is where the worst findings sat: a rule
 * listing `[is-idempotent, is-reversible]` as its acceptance criteria when no `ac/` directory
 * answered either name.
 * The live trees still carry `br.audit.erasure.right` and `br.audit.retention` arguing in one record's
 * `because` that they cannot both hold - both of them marked done - and a second pair, `data.audit.log-line`
 * against `br.task.delete.final`, where the same contradiction was noticed, written down, and left undecided.
 * A todo uat flow says it proves a requirement that is already done, so the requirement's provenance rests on
 * a prover that has not itself been proven. A gap closed by nothing reads as finished. The catalog says a
 * feature is about one thing while the feature record under it says another. And one tree authored
 * `state: uninvestigate`, a word the layout's own `state` enum does not contain, which silently exempts five
 * ui records from every gate rule that fires on `done`.
 *
 * Each of those is two records disagreeing. Each is checkable without judgement, and none of them is
 * checkable from one record at a time. That is the gap this file fills.
 *
 * Severity follows check-work-deep.mjs: REFUSE only for a contradiction that is deterministic (two authored
 * fields that cannot both be true), SUSPECT for a coverage thin spot a human may have decided deliberately,
 * INFO for a divergence worth seeing. A check that refuses everything trains its readers to ignore it.
 */

const root = repoRoot;

/**
 * The schemas whose proof contract is authored as `requiresProof`. All six are declared that way in
 * `schemas/work-*.schema.yaml` (functional-requirement, non-functional-requirement, customer-journey,
 * sds-component, contract, integration).
 *
 * The exclusion matters more than the inclusion. Every work schema *admits* `requiresProof`, but no
 * business-rule in either tree carries one - so "a done record with no declared proof bar is thin" applied
 * to every schema would refuse 114 records that never author it. Records whose proof contract is the
 * outbound `proves` edge instead (implementation, uat-flow, ui-screen) are equally exempt, for the same
 * reason.
 */
export const PROOF_DEMAND_SCHEMAS = new Set([
  'work/functional-requirement@1', 'work/non-functional-requirement@1', 'work/customer-journey@1',
  'work/sds-component@1', 'work/contract@1', 'work/integration@1',
]);

/**
 * The proof kinds whose prover is another RECORD, paired with the record schema that makes that demand.
 * `unit`/`e2e`/`perf` are answered by the record's own evidence runs (and re-running them belongs to a
 * replay tool, not here), `measurement` by the nfr's own measurement, `live` by an integration run against a
 * real server. `provider`/`consumer` are two roles on a contract that no authored field says which prover
 * covers which side, so splitting them would invent an edge the layout does not record.
 *
 * A journey's `uat` demand is deliberately absent. Journeys carry their own walked evidence in this layout
 * (journey.login.first-sign-in is done with an evidence.yaml and is named by no uat-flow's proves in either
 * tree), so demanding a prover record there would refuse a shape the trees agree on.
 */
const PROVER_PAIRING = {
  'work/functional-requirement@1': {kind: 'uat', proverSchema: 'work/uat-flow@1'},
  'work/sds-component@1': {kind: 'implementation', proverSchema: 'work/implementation@1'},
};

const schemaFileFor = schema => path.join(root, 'modules', 'schemas', `work-${String(schema).split('/')[1]?.replace(/@\d+$/, '') ?? ''}.schema.yaml`);
const stateEnumCache = new Map();

/** The `state` values the record's OWN family schema allows, read from `schemas/work-<family>.schema.yaml`'s
 * `$defs.state.enum` - the authority the layout already publishes, read rather than restated here so the two
 * cannot drift. `null` when the family has no per-family schema file or declares no enum: no claim is made
 * about a vocabulary this file cannot read. */
export function declaredStateValues(schema) {
  if (stateEnumCache.has(schema)) return stateEnumCache.get(schema);
  const file = schemaFileFor(schema);
  let allowed = null;
  if (fs.existsSync(file)) {
    try {
      const doc = parseYaml(fs.readFileSync(file, 'utf8'));
      let enumValues = doc?.$defs?.state?.enum;
      if (!Array.isArray(enumValues)) {
        // The shared `state` shape moved to work-common.schema.yaml; the family file keeps only the $ref.
        const ref = /^urn:work:common:1#\/\$defs\/(.+)$/
          .exec(doc?.properties?.state?.$ref ?? doc?.$defs?.state?.$ref ?? '')?.[1];
        if (ref) enumValues = workCommonDef(ref, root)?.enum;
      }
      if (Array.isArray(enumValues) && enumValues.length) allowed = enumValues;
    } catch { allowed = null; }
  }
  stateEnumCache.set(schema, allowed);
  return allowed;
}

/** Resolve `a.b` against an object; `forEach` demands name one field of the record, and the live trees use a
 * dotted path for `stateMachine.transitions`, so a single-key lookup would call every sds component's
 * transition demand dangling. */
const fieldOf = (record, dottedPath) => String(dottedPath).split('.').reduce((holder, key) =>
  holder && typeof holder === 'object' ? holder[key] : undefined, record);

// ---- concept 2: does a done record demand what it claims to have proven ----
// `requiresProof` is the record's own statement of what would convince a reader (schemas/work-functional-
// requirement.schema.yaml's $defs.requiresProof). Coverage is read against the record's own claims: a flow
// that composes three rules and demands one unit tick has a bar that does not grow with its composition,
// and a `forEach` naming a field the record does not carry is a demand nobody can ever satisfy.
function checkForEachDemands({ refuse }, file, data, demand) {
  for (const [kind, spec] of Object.entries(demand ?? {})) {
    if (!spec || typeof spec !== 'object' || typeof spec.forEach !== 'string') continue;
    if (fieldOf(data, spec.forEach) === undefined) {
      refuse(file, 'PROOF_FOREACH_DANGLING',
        `requiresProof.${kind}.forEach names "${spec.forEach}", a field this record does not carry - the demand can never be satisfied entry by entry`);
    }
  }
}

function checkComposedProof({ suspect }, file, { id, data, demand }) {
  const composes = isList(data.composes);
  const unit = demand.unit;
  if (composes.length && !unit) {
    suspect(file, 'PROOF_COVERAGE_GAP',
      `${id} is done and composes ${composes.length} rule(s) but demands no unit proof of them; a flow-level run can pass while a composed rule is wrong in a case the flow never reaches`);
  } else if (composes.length >= 2 && !unit.forEach) {
    suspect(file, 'PROOF_COVERAGE_GAP',
      `${id} is done, composes ${composes.length} rules, and its requiresProof.unit carries no forEach: composes - one unit result now answers for a rule list that has grown since`);
  }
  if (composes.length && !demand.e2e) {
    suspect(file, 'PROOF_COVERAGE_GAP',
      `${id} is done, composes ${composes.length} rule(s) through ${[...new Set(composes.map(c => c?.module).filter(Boolean))].join(', ') || 'no named module'}, and declares no e2e demand - composition is exactly what no isolated test can see`);
  }
}

function checkProverClaimed({ suspect, proversOf }, file, { id, rec, demand }) {
  const pairing = PROVER_PAIRING[rec.schema];
  if (!pairing || !demand?.[pairing.kind]?.required) return;
  const claimed = (proversOf.get(id) ?? []).filter(prover => prover.schema === pairing.proverSchema);
  if (!claimed.length) {
    suspect(file, 'PROOF_UNCLAIMED',
      `${id} is done and its requiresProof.${pairing.kind} demands a ${pairing.proverSchema.split('/')[1]}, but no ${pairing.proverSchema} record in this tree names ${id} in its proves - the demand is stated and unclaimed`);
  }
}

function checkJourneyRoute({ records, refuse, canon }, file, { id, data }) {
  const route = isList(data.requirements);
  const unresolved = route.filter(stepId => records.get(canon(stepId))?.data?.state !== 'done');
  if (data.state === 'done' && unresolved.length) {
    refuse(file, 'PROOF_ROUTE_UNHOLDS',
      `${id} is done while its own requiresProof.requirements.forEach demands each route entry hold in its own right, and ${unresolved.join(', ')} ${unresolved.length > 1 ? 'are' : 'is'} ${unresolved.map(stepId => records.get(canon(stepId))?.data?.state ?? '(missing)').join(', ')}`);
  }
}

function checkProofDemand(ctx, id, rec) {
  const data = rec.data ?? {};
  const file = shownFile(rec);
  const demand = data.requiresProof;
  checkForEachDemands(ctx, file, data, demand);
  if (data.state !== 'done') return;
  if (PROOF_DEMAND_SCHEMAS.has(rec.schema) && !demand) {
    ctx.suspect(file, 'PROOF_COVERAGE_THIN',
      `${id} is done and declares no requiresProof at all, so nothing says what would have to be observed before it counted as proven`);
  }
  if (rec.schema === 'work/functional-requirement@1' && demand) checkComposedProof(ctx, file, { id, data, demand });
  checkProverClaimed(ctx, file, { id, rec, demand });
  if (rec.schema === 'work/customer-journey@1') checkJourneyRoute(ctx, file, { id, data });
}

// ---- concept 7: a state the layout has no word for ----
// `state` is a two-value enum in every family schema that declares one, and `stale` is deliberately absent
// because the checker derives it (schemas/work-business-rule.schema.yaml's $defs.state). An invented third
// value is not a stylistic complaint, it is a hole: every rule in check-example-work.mjs fires on
// `state === 'done'` or `state === 'todo'`, so a record carrying a word neither matches escapes all of
// them while still reading as finished work to a human skimming the tree.
function checkStateVocabulary({ records, refuse }) {
  for (const [id, rec] of records) {
    const authored = rec.data?.state;
    if (authored == null) continue;
    const allowed = declaredStateValues(rec.schema);
    if (allowed && !allowed.includes(authored)) {
      refuse(shownFile(rec), 'STATE_VOCABULARY_UNKNOWN',
        `${id} carries state "${authored}", which ${fromRoot(schemaFileFor(rec.schema))} declares no such value (its enum is [${allowed.join(', ')}]) - the record matches neither the done rules nor the todo ones`);
    }
  }
}

// ---- reverse `proves` index: who claims to have proven this record, and are they done ----
// Compact format: a `P#frag` or collapsed `ac.*` proves target resolves to the record carrying the
// criterion, so the reverse index keys on the canonical id.
function proversIndex(records, canon) {
  const proversOf = new Map();
  for (const [id, rec] of records) {
    if (!Array.isArray(rec.data?.proves)) continue;
    for (const targetId of rec.data.proves) {
      const canonical = typeof targetId === 'string' ? canon(targetId) : targetId;
      if (!proversOf.has(canonical)) proversOf.set(canonical, []);
      proversOf.get(canonical).push({id, schema: rec.schema, state: rec.data.state});
    }
  }
  return proversOf;
}

/**
 * Runs every same-tree check against one `.starciwork` rooted at `workRoot`. `records` is the map
 * `loadRecords` builds for that tree (passed in rather than re-read so the cross-tree parity check sees the
 * identical inventory the per-record checks walked). Findings are appended to `sink`, which also collects the
 * per-tree vocabulary the parity check needs. Exported so the fixture test can point it at a throwaway tree.
 */
function checkConsistencyTree(workRoot, records, sink) {
  const refuse = (file, code, message) => sink.refuse.push(`${file}: ${message} [${code}]`);
  const suspect = (file, code, message) => sink.suspect.push(`${file}: ${message} [${code}]`);
  const inline = indexInlineCriteria(records);
  const canon = ref => resolveRecordRef(records, ref, inline) ?? ref;
  const ctx = { workRoot, records, refuse, suspect, canon, proversOf: proversIndex(records, canon) };
  checkAcceptanceNaming(ctx);
  for (const [id, rec] of records) checkProofDemand(ctx, id, rec);
  checkConflicts(ctx);
  checkProvesAsymmetry(ctx);
  checkGapClosure(ctx);
  checkCatalog(ctx);
  checkStateVocabulary(ctx);
}

/** One-call form for a caller that has not already loaded the tree: build the record map, run every same-tree
 * check, and hand back the filled `{refuse, suspect, info}` sink. Used by this file's CLI and by
 * tests/checks/work-consistency.spec.mjs, which points it at a throwaway tree. */
export function checkWorkConsistencyTree(workRoot) {
  const sink = {refuse: [], suspect: [], info: []};
  checkConsistencyTree(workRoot, loadRecords(workRoot, walk), sink);
  return sink;
}

/**
 * Cross-tree parity (concept 8). Both example trees claim to be statements of the same layout, so a field one
 * tree authors on a record family and the other never does is a convention that forked - which is why the
 * same audit finding keeps returning in a different shape in each tree.
 *
 * One line per record family, not one per field: the trees diverge in blocks (the two brand records share
 * three keys out of ten), and a flat per-field list buried the interesting part under 70 lines of "the
 * skeleton tree has not authored that yet". Record counts ride along so a reader can weigh "different shape"
 * against "one tree has one of these and the other has twenty".
 *
 * Value vocabularies are deliberately NOT compared. Every value divergence on the live trees was
 * `state: uninvestigate`, which is a record contradicting its own family schema and concept 7 refuses it;
 * the remaining candidates (`state: done`, `change.kind: breaking` in one tree only) measure how far that
 * tree's work has advanced, not which convention it follows.
 *
 * INFO tier throughout: a forked convention is a fact a human adjudicates, and the younger tree is unfinished
 * rather than wrong. Schemas with no records at all in the other tree are skipped - a whole family missing is
 * a scope fact, not drift.
 */
export function checkTreeParity(perTree, sink) {
  if (perTree.length < 2) {
    sink.info.push('(single tree): parity skipped, comparing conventions needs both example trees [PARITY_SKIPPED]');
    return;
  }
  const fieldsByTree = perTree.map(entry => {
    const bySchema = new Map();
    for (const rec of entry.records.values()) {
      if (!bySchema.has(rec.schema)) bySchema.set(rec.schema, new Set());
      for (const field of Object.keys(rec.data ?? {})) bySchema.get(rec.schema).add(field);
    }
    return {label: entry.label, bySchema, records: entry.records};
  });
  const sharedSchemas = [...fieldsByTree[0].bySchema.keys()]
    .filter(schema => fieldsByTree.every(tree => tree.bySchema.has(schema)))
    .sort(byCodeUnit);
  for (const schema of sharedSchemas) {
    const line = parityLine(perTree, fieldsByTree, schema);
    if (line) sink.info.push(line);
  }
}

/** Field names outside the current contract: check-example-work.mjs's concept 9 refuses them on
 * work/implementation@1, so a tree authoring them anywhere else is worth naming in the same breath as
 * the divergence. */
const NON_CONTRACT_PATH_FIELDS = new Set(['directory', 'files', 'targetFiles']);

/** The PARITY_FIELD line of one record family the trees author differently, or null when they agree. */
function parityLine(perTree, fieldsByTree, schema) {
  const onlyHereOf = index => [...fieldsByTree[index].bySchema.get(schema)]
    .filter(field => fieldsByTree.some(other => !other.bySchema.get(schema).has(field)))
    .sort(byCodeUnit);
  const sides = fieldsByTree.map((tree, index) => ({label: tree.label, onlyHere: onlyHereOf(index)}))
    .filter(side => side.onlyHere.length);
  if (!sides.length) return null;
  const foreignFields = sides.flatMap(side => side.onlyHere.filter(field => NON_CONTRACT_PATH_FIELDS.has(field)));
  const counts = perTree.map(entry => {
    const owned = [...entry.records.values()].filter(rec => rec.schema === schema).length;
    return `${entry.label}=${owned}`;
  }).join(', ');
  const divergence = sides.map(side => `only ${side.label}: ${side.onlyHere.join(', ')}`).join('; ');
  return `(both trees): ${schema} is authored ${sides.length === 1 ? 'by one tree only' : 'two different ways'} (${counts} record(s)) - ${divergence}`
    + `${foreignFields.length ? '; ' + foreignFields.join(', ') + ' ' + (foreignFields.length > 1 && 'are' || 'is') + ' not part of the current contract' : ''} [PARITY_FIELD]`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const workRoots = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(dir => path.dirname(dir));

  const sink = {refuse: [], suspect: [], info: []};
  const perTree = [];
  let recordCount = 0;
  for (const workRoot of workRoots) {
    const records = loadRecords(workRoot, walk);
    recordCount += records.size;
    perTree.push({workRoot, label: path.basename(path.dirname(workRoot)), records});
    checkConsistencyTree(workRoot, records, sink);
  }
  checkTreeParity(perTree, sink);

  const bySeverity = [
    ['REFUSE', sink.refuse], ['SUSPECT', sink.suspect], ['INFO', sink.info],
  ];
  for (const [tier, lines] of bySeverity) for (const line of lines.sort(byCodeUnit)) console.log(`${tier.padEnd(7)} ${line}`);
  console.log(`\n${recordCount} record(s) across ${workRoots.length} tree(s): ${sink.refuse.length} refused, ${sink.suspect.length} suspect, ${sink.info.length} info`);
  process.exitCode = sink.refuse.length ? 1 : 0;
}
