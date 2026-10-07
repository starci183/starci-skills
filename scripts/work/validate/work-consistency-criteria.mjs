// Concept 1 of check-work-consistency.mjs: acceptanceCriteria short names against the criteria beside the rule.
//
// ---- concept 1: acceptanceCriteria short names vs the criteria beside the rule ----
// The rule's list holds the last segment of each criterion's id (schemas/work-business-rule.schema.yaml),
// which is either its directory name under ac/ or - in the v11 compact format - an inline entry on the
// rule's own `acceptance:`/`statements:` carrying `id: <ac-id>`. That is a promise across two places
// with nothing keeping it: `ac.rule` is cross-checked because a criterion names its rule explicitly,
// while the rule's own half of the pair was never resolved. Both directions are checked here, because
// the asymmetry can be either side forgetting the other.
import fs from 'node:fs';
import path from 'node:path';
import { inlineCriteriaOf, INLINE_CRITERION_FIELDS } from '../record-ownership.mjs';
import { fromRoot, isList, shownFile } from './work-consistency-shared.mjs';

/** The refusal or suspect of a name that answers no criterion of the rule. */
function reportUnanswered({ refuse, suspect }, { rec, criterionDirs, inlineCriteria, acRoot }, { name, criterionId }) {
  const message = `acceptanceCriteria names "${name}", which answers no criterion here: expected ${criterionId} at ${fromRoot(acRoot)}/${name} or as an inline acceptance entry`;
  if (criterionDirs.length || inlineCriteria.length) refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
    `${message}; this rule does own criteria (${[...criterionDirs, ...inlineCriteria.map(c => c.name ?? c.id)].join(', ')}), so the name is stale, not the convention`);
  else suspect(shownFile(rec), 'AC_NAMING_ASYMMETRY',
    `${message}; the rule owns no criteria at all, which may be a deliberate deferral but is unchecked today`);
}

function checkNamedCriterion(ctx, scope, name) {
  const { records, refuse } = ctx;
  const { id, rec, acRoot, criterionDirs, criterionIdOf, inlineMatch } = scope;
  const criterionId = criterionIdOf(name);
  const criterion = records.get(criterionId);
  const inlineEntry = inlineMatch(name);
  if (!criterionDirs.includes(name) && !criterion && !inlineEntry) {
    reportUnanswered(ctx, scope, { name, criterionId });
    return;
  }
  if (criterionDirs.includes(name) && !criterion && !inlineEntry) {
    refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
      `acceptanceCriteria names "${name}" and ${fromRoot(acRoot)}/${name} exists, but no record inside it carries the id ${criterionId} its place requires`);
    return;
  }
  const answers = criterion?.data?.rule ?? inlineEntry?.entry?.rule;
  if (answers != null && answers !== id) {
    refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
      `acceptanceCriteria names "${name}", but the criterion ${criterionId} answers ${answers}, not ${id}`);
  }
}

// The reverse direction for inlined criteria: when the rule still authors an acceptanceCriteria
// list, every inline entry must be reachable through it, or no reader reaches the criterion.
function checkInlineReachable({ refuse }, { id, rec, inlineCriteria }, named) {
  if (!Object.hasOwn(rec.data, 'acceptanceCriteria')) return;
  for (const c of inlineCriteria) {
    const shortName = c.name ?? c.id?.split('.').pop();
    if (shortName && !named.includes(shortName)) {
      refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
        `inline criterion ${c.id ?? shortName} sits in ${id}'s acceptance entries but its acceptanceCriteria is [${named.join(', ')}] - it does not list ${shortName}, so no reader reaches this criterion from the rule`);
    }
  }
}

function checkRuleCriteria(ctx, id, rec) {
  const named = isList(rec.data.acceptanceCriteria);
  const acRoot = path.join(rec.dir, 'ac');
  const criterionDirs = fs.existsSync(acRoot)
    ? fs.readdirSync(acRoot, {withFileTypes: true}).filter(entry => entry.isDirectory()).map(entry => entry.name)
    : [];
  const inlineCriteria = inlineCriteriaOf(rec.data);
  const criterionIdOf = name => id.replace(/^br\./, 'ac.') + '.' + name;
  const inlineMatch = name => inlineCriteria.find(c =>
    c.id === criterionIdOf(name) || c.id === name || c.name === name || (c.id && c.id.split('.').pop() === name));
  const scope = { id, rec, acRoot, criterionDirs, inlineCriteria, criterionIdOf, inlineMatch };
  for (const name of named) checkNamedCriterion(ctx, scope, name);
  checkInlineReachable(ctx, scope, named);
}

/** The string pointers (`id`, `name`, `ref`) an inline acceptance/statements entry carries. */
const pointersOf = entry => (entry && typeof entry === 'object' ? [entry.id, entry.name, entry.ref].filter(t => typeof t === 'string') : []);

/** The names a rule's acceptanceCriteria list and its inline acceptance/statements entries give. */
function namesReachableFrom(owner) {
  const named = new Set(isList(owner.data.acceptanceCriteria));
  for (const field of INLINE_CRITERION_FIELDS) {
    for (const e of Array.isArray(owner.data[field]) ? owner.data[field] : []) for (const t of pointersOf(e)) named.add(t);
  }
  return named;
}

// The current business-rule schema has no acceptanceCriteria reverse list. A criterion's rule id
// and its place under that rule's ac/ directory are sufficient; only records that actually
// author a reverse list or explicit pointer can disagree with it.
const hasReverseLink = owner => Object.hasOwn(owner.data, 'acceptanceCriteria') ||
  INLINE_CRITERION_FIELDS.some(field => Array.isArray(owner.data[field]) &&
    owner.data[field].some(e => pointersOf(e).length > 0));

function checkCriterionPlace({ records, refuse }, criterionId, rec) {
  const owner = records.get(rec.data.rule);
  if (!owner) return; // a dangling `rule` ref is refused by check-example-work.mjs's ref resolution
  const dirName = path.basename(rec.dir);
  // Compact format: a kept-separate criterion is reachable when the rule's acceptanceCriteria names
  // its directory OR when an acceptance/statements entry points at it (`ref`/`id`/`name` naming the
  // criterion's own id or its dir name - a pointer entry needs no other fields).
  const named = namesReachableFrom(owner);
  if (hasReverseLink(owner) && !named.has(dirName) && !named.has(criterionId)) {
    refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
      `criterion proves ${owner.id} but ${owner.id}'s acceptanceCriteria is [${isList(owner.data.acceptanceCriteria).join(', ')}] - it does not list ${dirName}, so no reader reaches this criterion from the rule`);
  }
  const criterionPath = path.relative(owner.dir, rec.dir).replaceAll('\\', '/');
  if (owner.dir === rec.dir || !criterionPath.startsWith('ac/')) {
    refuse(shownFile(rec), 'AC_NAMING_ASYMMETRY',
      `criterion proves ${owner.id} but does not live under its rule's ac/ directory (${shownFile(rec)} vs ${shownFile(owner)})`);
  }
}

export function checkAcceptanceNaming(ctx) {
  for (const [id, rec] of ctx.records) {
    if (rec.schema === 'work/business-rule@1') checkRuleCriteria(ctx, id, rec);
  }
  for (const [criterionId, rec] of ctx.records) {
    if (rec.schema === 'work/acceptance-criterion@1') checkCriterionPlace(ctx, criterionId, rec);
  }
}
