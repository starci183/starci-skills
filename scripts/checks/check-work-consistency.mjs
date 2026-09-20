#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {walk} from './check-example-work.mjs';
import {loadRecords, inlineCriteriaOf, INLINE_CRITERION_FIELDS, indexInlineCriteria, resolveRecordRef} from '../example/example-ownership.mjs';

/**
 * Every check in the fleet so far reads one record and asks whether that record agrees with itself: an id
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The schemas whose proof contract is authored as `requiresProof`. Four of them are declared that way in
 * `schemas/work-*.schema.yaml` (functional-requirement, non-functional-requirement, customer-journey,
 * sds-component); contract and integration author it in both live trees and have no per-family schema file
 * of their own, so the trees are the evidence for their inclusion.
 *
 * The exclusion matters more than the inclusion. `work/business-rule.schema.yaml` is `additionalProperties:
 * false` and lists no `requiresProof`, and no business-rule in either tree carries one - so "a done record
 * with no declared proof bar is thin" applied to every schema would refuse 114 records that are structurally
 * incapable of satisfying it. Records whose proof contract is the outbound `proves` edge instead
 * (implementation, uat-flow, ui-screen) are equally exempt, for the same reason.
 */
export const PROOF_DEMAND_SCHEMAS = new Set([
  'work/functional-requirement', 'work/non-functional-requirement', 'work/customer-journey',
  'work/sds-component', 'work/contract', 'work/integration',
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
  'work/functional-requirement': {kind: 'uat', proverSchema: 'work/uat-flow'},
  'work/sds-component': {kind: 'implementation', proverSchema: 'work/implementation'},
};

const schemaFileFor = schema => path.join(root, 'modules', 'schemas', `work-${String(schema).split('/')[1] ?? ''}.schema.yaml`);
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
      const enumValues = parseYaml(fs.readFileSync(file, 'utf8'))?.$defs?.state?.enum;
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

const isList = value => Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
const normaliseSentence = value => String(value ?? '').trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const shownFile = rec => path.relative(root, path.join(rec.dir, 'index.yaml')).replaceAll('\\', '/');

/**
 * Runs every same-tree check against one `.starciwork` rooted at `workRoot`. `records` is the map
 * `loadRecords` builds for that tree (passed in rather than re-read so the cross-tree parity check sees the
 * identical inventory the per-record checks walked). Findings are appended to `sink`, which also collects the
 * per-tree vocabulary the parity check needs. Exported so the fixture test can point it at a throwaway tree.
 */
export function checkConsistencyTree(workRoot, records, sink) {
  const refuse = (file, code, message) => sink.refuse.push(`${file}: ${message} [${code}]`);
  const suspect = (file, code, message) => sink.suspect.push(`${file}: ${message} [${code}]`);

  // ---- reverse `proves` index: who claims to have proven this record, and are they done ----
  // Compact format: a `P#frag` or collapsed `ac.*` proves target resolves to the record carrying the
  // criterion, so the reverse index keys on the canonical id.
  const inline = indexInlineCriteria(records);
  const canon = ref => resolveRecordRef(records, ref, inline) ?? ref;
  const proversOf = new Map();
  for (const [id, rec] of records) {
    if (!Array.isArray(rec.data?.proves)) continue;
    for (const targetId of rec.data.proves) {
      const canonical = typeof targetId === 'string' ? canon(targetId) : targetId;
      if (!proversOf.has(canonical)) proversOf.set(canonical, []);
      proversOf.get(canonical).push({id, schema: rec.schema, state: rec.data.state});
    }
  }

  // ---- concept 1: acceptanceCriteria short names vs the criteria beside the rule ----
  // The rule's list holds the last segment of each criterion's id (schemas/work-business-rule.schema.yaml),
  // which is either its directory name under ac/ or - in the v11 compact format - an inline entry on the
  // rule's own `acceptance:`/`statements:` carrying `id: <ac-id>`. That is a promise across two places
  // with nothing keeping it: `ac.rule` is cross-checked because a criterion names its rule explicitly,
  // while the rule's own half of the pair was never resolved. Both directions are checked here, because
  // the asymmetry can be either side forgetting the other.
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/business-rule') continue;
    const named = isList(rec.data.acceptanceCriteria);
    const acRoot = path.join(rec.dir, 'ac');
    const criterionDirs = fs.existsSync(acRoot)
      ? fs.readdirSync(acRoot, {withFileTypes: true}).filter(entry => entry.isDirectory()).map(entry => entry.name)
      : [];
    const inlineCriteria = inlineCriteriaOf(rec.data);
    const criterionIdOf = name => id.replace(/^br\./, 'ac.') + '.' + name;
    const inlineMatch = name => inlineCriteria.find(c =>
      c.id === criterionIdOf(name) || c.id === name || c.name === name || (c.id && c.id.split('.').pop() === name));

    for (const name of named) {
      const criterionId = criterionIdOf(name);
      const criterion = records.get(criterionId);
      const inlineEntry = inlineMatch(name);
      if (!criterionDirs.includes(name) && !criterion && !inlineEntry) {
        const message = `acceptanceCriteria names "${name}", which answers no criterion here: expected ${criterionId} at ${path.relative(root, acRoot).replaceAll('\\', '/')}/${name} or as an inline acceptance entry`;
        if (criterionDirs.length || inlineCriteria.length) refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
          `${message}; this rule does own criteria (${[...criterionDirs, ...inlineCriteria.map(c => c.name ?? c.id)].join(', ')}), so the name is stale, not the convention`);
        else suspect(shownFile(rec), 'AC_NAMING_ASYMMETRY',
          `${message}; the rule owns no criteria at all, which may be a deliberate deferral but is unchecked today`);
        continue;
      }
      if (criterionDirs.includes(name) && !criterion && !inlineEntry) {
        refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
          `acceptanceCriteria names "${name}" and ${path.relative(root, acRoot).replaceAll('\\', '/')}/${name} exists, but no record inside it carries the id ${criterionId} its place requires`);
        continue;
      }
      const answers = criterion?.data?.rule ?? inlineEntry?.entry?.rule;
      if (answers != null && answers !== id) {
        refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
          `acceptanceCriteria names "${name}", but the criterion ${criterionId} answers ${answers}, not ${id}`);
      }
    }

    // The reverse direction for inlined criteria: when the rule still authors an acceptanceCriteria
    // list, every inline entry must be reachable through it, or no reader reaches the criterion.
    if (isList(rec.data.acceptanceCriteria).length || criterionDirs.length) {
      for (const c of inlineCriteria) {
        const shortName = c.name ?? c.id?.split('.').pop();
        if (shortName && !named.includes(shortName)) {
          refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
            `inline criterion ${c.id ?? shortName} sits in ${id}'s acceptance entries but its acceptanceCriteria is [${named.join(', ')}] - it does not list ${shortName}, so no reader reaches this criterion from the rule`);
        }
      }
    }
  }
  for (const [criterionId, rec] of records) {
    if (rec.schema !== 'work/acceptance-criterion') continue;
    const owner = records.get(rec.data.rule);
    if (!owner) continue; // a dangling `rule` ref is refused by check-example-work.mjs's ref resolution
    const dirName = path.basename(rec.dir);
    // Compact format: a kept-separate criterion is reachable when the rule's acceptanceCriteria names
    // its directory OR when an acceptance/statements entry points at it (`ref`/`id`/`name` naming the
    // criterion's own id or its dir name - a pointer entry needs no other fields).
    const named = new Set(isList(owner.data.acceptanceCriteria));
    for (const field of INLINE_CRITERION_FIELDS) {
      for (const e of Array.isArray(owner.data[field]) ? owner.data[field] : []) {
        if (e && typeof e === 'object') for (const t of [e.id, e.name, e.ref]) if (typeof t === 'string') named.add(t);
      }
    }
    if (!named.has(dirName) && !named.has(criterionId)) {
      refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
        `criterion proves ${owner.id} but ${owner.id}'s acceptanceCriteria is [${isList(owner.data.acceptanceCriteria).join(', ')}] - it does not list ${dirName}, so no reader reaches this criterion from the rule`);
    }
    const criterionPath = path.relative(owner.dir, rec.dir).replaceAll('\\', '/');
    if (owner.dir === rec.dir || !criterionPath.startsWith('ac/')) {
      refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
        `criterion proves ${owner.id} but does not live under its rule's ac/ directory (${shownFile(rec)} vs ${shownFile(owner)})`);
    }
  }

  // ---- concept 2: does a done record demand what it claims to have proven ----
  // `requiresProof` is the record's own statement of what would convince a reader (schemas/work-functional-
  // requirement.schema.yaml's $defs.requiresProof). Coverage is read against the record's own claims: a flow
  // that composes three rules and demands one unit tick has a bar that does not grow with its composition,
  // and a `forEach` naming a field the record does not carry is a demand nobody can ever satisfy.
  for (const [id, rec] of records) {
    const data = rec.data ?? {};
    const file = shownFile(rec);
    const demand = data.requiresProof;

    for (const [kind, spec] of Object.entries(demand ?? {})) {
      if (!spec || typeof spec !== 'object' || typeof spec.forEach !== 'string') continue;
      if (fieldOf(data, spec.forEach) === undefined) {
        refuse(file, 'PROOF_FOREACH_DANGLING',
          `requiresProof.${kind}.forEach names "${spec.forEach}", a field this record does not carry - the demand can never be satisfied entry by entry`);
      }
    }
    if (data.state !== 'done') continue;

    if (PROOF_DEMAND_SCHEMAS.has(rec.schema) && !demand) {
      suspect(file, 'PROOF_COVERAGE_THIN',
        `${id} is done and declares no requiresProof at all, so nothing says what would have to be observed before it counted as proven`);
    }
    if (rec.schema === 'work/functional-requirement' && demand) {
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
    const pairing = PROVER_PAIRING[rec.schema];
    if (pairing && demand?.[pairing.kind]?.required) {
      const claimed = (proversOf.get(id) ?? []).filter(prover => prover.schema === pairing.proverSchema);
      if (!claimed.length) {
        suspect(file, 'PROOF_UNCLAIMED',
          `${id} is done and its requiresProof.${pairing.kind} demands a ${pairing.proverSchema.split('/')[1]}, but no ${pairing.proverSchema} record in this tree names ${id} in its proves - the demand is stated and unclaimed`);
      }
    }
    if (rec.schema === 'work/customer-journey') {
      const route = isList(data.requirements);
      const unresolved = route.filter(stepId => records.get(canon(stepId))?.data?.state !== 'done');
      if (data.state === 'done' && unresolved.length) {
        refuse(file, 'PROOF_ROUTE_UNHOLDS',
          `${id} is done while its own requiresProof.requirements.forEach demands each route entry hold in its own right, and ${unresolved.join(', ')} ${unresolved.length > 1 ? 'are' : 'is'} ${unresolved.map(stepId => records.get(canon(stepId))?.data?.state ?? '(missing)').join(', ')}`);
      }
    }
  }

  // ---- concept 3: a contradiction between two records needs a third to settle it ----
  // conflictsWith says "these two cannot both be true". The layout's answer to that is a
  // work/policy-decision naming both sides (schemas list tension.records for exactly this). Two done records
  // that contradict each other with no decision are a tree asserting a contradiction; the same pair with a
  // todo side is only an honest outstanding conflict, so it is warned, not refused.
  const decisionResolverOf = (leftId, rightId) => [...records.values()].find(candidate => {
    if (candidate.schema !== 'work/policy-decision') return false;
    if (candidate.data.outcome !== 'decided') return false;
    const names = [];
    const collect = node => {
      if (typeof node === 'string') { names.push(node); return; }
      if (Array.isArray(node)) return node.forEach(collect);
      if (node && typeof node === 'object') return Object.values(node).forEach(collect);
    };
    collect(candidate.data);
    return names.includes(leftId) && names.includes(rightId);
  });
  const settledPairs = new Set();
  for (const [id, rec] of records) {
    for (const edge of isList(rec.data.conflictsWith)) {
      const otherId = typeof edge?.record === 'string' ? canon(edge.record) : edge?.record;
      if (!otherId || !records.has(otherId)) continue; // dangling refs belong to the base gate
      const pairKey = [id, otherId].sort().join('|');
      if (settledPairs.has(pairKey)) continue;
      settledPairs.add(pairKey);
      const other = records.get(otherId);
      const bothDone = rec.data.state === 'done' && other.data.state === 'done';
      const resolver = decisionResolverOf(id, otherId);
      if (resolver) continue;
      const message = `${id} (${rec.data.state}) and ${otherId} (${other.data.state}) each declare the other impossible - `
        + `"${String(edge.because ?? other.data.conflictsWith?.find(e => e?.record === id || (typeof e?.record === 'string' && canon(e.record) === id))?.because ?? '(no because recorded)').slice(0, 160)}" `
        + '- and no work/policy-decision naming both sides settles it';
      const file = shownFile(rec);
      if (bothDone) refuse(file, 'CONFLICT_WITHOUT_DECISION', `${message}; two done records cannot both be true of the same product`);
      else suspect(file, 'CONFLICT_WITHOUT_DECISION', `${message}; neither side is done yet, so this is an open conflict rather than a contradiction`);
    }
  }

  // ---- concept 4: a prover that has not itself been proven ----
  // check-example-work.mjs refuses the loud half of this (a done record proving a todo target). The quiet
  // half is the asymmetry this tree actually lives with: a todo uat flow lists done requirements in its
  // `proves`, and whatever derives the requirement's provenance from `proves` edges now says it is proven by
  // a run that has not happened. The derived index classifies `proves` as an unclassified edge
  // (scripts/example/example-derive.mjs's EDGE_FIELD_NAMES), so "is it in the derived provenance" would answer no for
  // all 89 edges in both trees and mean nothing - the asymmetry worth naming is the state disagreement.
  for (const [id, rec] of records) {
    if (rec.data?.state !== 'todo' || !Array.isArray(rec.data.proves)) continue;
    const doneTargets = rec.data.proves.filter(targetId => records.get(canon(targetId))?.data?.state === 'done');
    if (!doneTargets.length) continue;
    suspect(shownFile(rec), 'PROVES_ASYMMETRY',
      `${id} is todo but its proves names ${doneTargets.length} record(s) already done (${doneTargets.join(', ')}) - their provenance now rests on a prover that is not itself proven`);
  }

  // ---- concept 5: gap closure claims ----
  // The base gate covers a gap whose closers are not done. What nothing covers is the claim with no evidence
  // attached to it at all: `state: done` with no `closedBy`, which reads as "this absence is filled" while
  // naming nothing that filled it - and the mirror image, a gap still `todo` whose named closers are all
  // done, which is either a stale gap or an overclaimed closer.
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/gap') continue;
    const closers = isList(rec.data.closedBy);
    const file = shownFile(rec);
    if (rec.data.state === 'done' && !closers.length) {
      suspect(file, 'GAP_CLOSED_BY_NOTHING',
        `${id} records the gap as closed and names no closedBy - nothing in this tree says what closed it, so the claim is unfalsifiable`);
    }
    if (rec.data.state === 'todo' && closers.length && closers.every(closerId => records.get(canon(closerId))?.data?.state === 'done')) {
      suspect(file, 'GAP_CLOSURE_STALE',
        `${id} is still open while every record it names as its closer is done (${closers.join(', ')}) - either the gap is stale or one of those done claims is not`);
    }
  }

  // ---- concept 6: the catalog and the feature node under it ----
  // The catalog is the tree's table of contents and the work/feature node is the same feature described a
  // second time. Two copies of one fact is where drift lives: check-work-deep.mjs's CATALOG_DRIFT compares
  // directory names to entries, so it stays silent about an entry whose feature directory exists but holds
  // no feature record, and about a record whose title no longer says what the catalog says it says.
  const catalogFile = path.join(workRoot, 'index.yaml');
  let catalog = null;
  try { catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8')); } catch { catalog = null; }
  const catalogShown = path.relative(root, catalogFile).replaceAll('\\', '/');
  if (!catalog?.features) {
    refuse(catalogShown, 'CATALOG_DIRTY', 'no readable work/catalog features list at the tree root, so nothing here can be reconciled with it');
  } else {
    for (const entry of catalog.features) {
      const entryId = String(entry?.id ?? '');
      const entryShown = `${catalogShown} (feature entry ${entryId || '(unnamed)'})`;
      const featureFile = path.join(workRoot, String(entry?.directory ?? ''), 'index.yaml');
      const featureShown = path.relative(root, featureFile).replaceAll('\\', '/');
      let feature = null;
      try { feature = fs.existsSync(featureFile) ? parseYaml(fs.readFileSync(featureFile, 'utf8')) : null; } catch { feature = null; }
      if (!feature || feature.schema !== 'work/feature') {
        refuse(entryShown, 'CATALOG_DIRTY', `entry points at ${featureShown}, which is ${feature ? `a ${feature.schema}` : 'absent'} - every catalog entry needs a work/feature node beside it`);
        continue;
      }
      if (feature.id !== entryId) refuse(entryShown, 'CATALOG_DIRTY', `entry id is ${entryId} but the feature record beside it is ${feature.id}`);
      if (path.basename(String(entry?.directory ?? '')) !== entryId) {
        refuse(entryShown, 'CATALOG_DIRTY', `entry id is ${entryId} while its directory is named ${path.basename(String(entry?.directory ?? ''))} - the id is the second segment of every record under it`);
      }
      const catalogSentence = normaliseSentence(entry.description);
      const titleSentence = normaliseSentence(feature.title);
      if (catalogSentence === titleSentence) continue;
      const truncated = catalogSentence.startsWith(titleSentence) || titleSentence.startsWith(catalogSentence);
      suspect(entryShown, 'CATALOG_TITLE_DRIFT',
        `the catalog describes the feature as "${entry.description}" while the feature node titles it "${feature.title}" - ${truncated ? 'one is the other truncated' : 'two different sentences about one feature'}`);
    }
  }

  // ---- concept 7: a state the layout has no word for ----
  // `state` is a two-value enum in every family schema that declares one, and `stale` is deliberately absent
  // because the checker derives it (schemas/work-business-rule.schema.yaml's $defs.state). An invented third
  // value is not a stylistic complaint, it is a hole: every rule in check-example-work.mjs fires on
  // `state === 'done'` or `state === 'todo'`, so a record carrying a word neither matches escapes all of
  // them while still reading as finished work to a human skimming the tree.
  for (const [id, rec] of records) {
    const authored = rec.data?.state;
    if (authored == null) continue;
    const allowed = declaredStateValues(rec.schema);
    if (allowed && !allowed.includes(authored)) {
      refuse(shownFile(rec), 'STATE_VOCABULARY_UNKNOWN',
        `${id} carries state "${authored}", which ${path.relative(root, schemaFileFor(rec.schema)).replaceAll('\\', '/')} declares no such value (its enum is [${allowed.join(', ')}]) - the record matches neither the done rules nor the todo ones`);
    }
  }
}

/** One-call form for a caller that has not already loaded the tree: build the record map, run every same-tree
 * check, and hand back the filled `{refuse, suspect, info}` sink. Used by this file's CLI and by
 * tests/work-consistency.spec.mjs, which points it at a throwaway tree. */
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
  /** Field names outside the current contract: check-example-work.mjs's concept 9 refuses them on
   * work/implementation, so a tree authoring them anywhere else is worth naming in the same breath as
   * the divergence. */
  const NON_CONTRACT_PATH_FIELDS = new Set(['directory', 'files', 'targetFiles']);
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
    .sort();

  for (const schema of sharedSchemas) {
    const onlyHereOf = index => [...fieldsByTree[index].bySchema.get(schema)]
      .filter(field => fieldsByTree.some(other => !other.bySchema.get(schema).has(field)))
      .sort();
    const sides = fieldsByTree.map((tree, index) => ({label: tree.label, onlyHere: onlyHereOf(index)}))
      .filter(side => side.onlyHere.length);
    if (!sides.length) continue;
    const foreignFields = sides.flatMap(side => side.onlyHere.filter(field => NON_CONTRACT_PATH_FIELDS.has(field)));
    const counts = perTree.map(entry => {
      const owned = [...entry.records.values()].filter(rec => rec.schema === schema).length;
      return `${entry.label}=${owned}`;
    }).join(', ');
    const divergence = sides.map(side => `only ${side.label}: ${side.onlyHere.join(', ')}`).join('; ');
    sink.info.push(`(both trees): ${schema} is authored ${sides.length === 1 ? 'by one tree only' : 'two different ways'} (${counts} record(s)) - ${divergence}`
      + `${foreignFields.length ? `; ${foreignFields.join(', ')} ${foreignFields.length > 1 ? 'are' : 'is'} not part of the current contract` : ''} [PARITY_FIELD]`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const treeArg = args.includes('--tree') ? args[args.indexOf('--tree') + 1] : null;
  const workRoots = treeArg ? [path.resolve(treeArg)]
    : walk(path.join(root, 'examples')).filter(file => file.endsWith(`.starciwork${path.sep}index.yaml`)).map(path.dirname);

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
  for (const [tier, lines] of bySeverity) for (const line of lines.sort()) console.log(`${tier.padEnd(7)} ${line}`);
  console.log(`\n${recordCount} record(s) across ${workRoots.length} tree(s): ${sink.refuse.length} refused, ${sink.suspect.length} suspect, ${sink.info.length} info`);
  process.exitCode = sink.refuse.length ? 1 : 0;
}
