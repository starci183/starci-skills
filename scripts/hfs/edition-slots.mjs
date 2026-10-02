// edition.mjs - the one edition filter shared by the HFS slot resolver, declaration validation, rule catalog and
// edition-specific rule parameters. Full is the default; lite changes data views, never the checks that consume them.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { EDITIONS } from './manifest-shape.mjs';

/** The presence of `slot` under edition lite for `profile`: `litePresence`, else the slot's own presence. */
export function litePresenceOf(slot, profile) {
  const lp = slot.litePresence;
  if (lp === undefined) return slot.presence;
  return isPlainObject(lp) ? (lp[profile] ?? slot.presence) : lp;
}

/** Whether `slot` exists under `edition` of `manifest` (default: the manifest's own editions). */
export function slotInEdition(manifest, slot, edition) {
  return (slot.editions ?? manifest.editions ?? EDITIONS).includes(edition);
}

/** The slot as `edition` sees it: lite overlays its data, presence and tracking while forbidding every test world. */
export function effectiveSlot(slot, profile, edition) {
  if (edition !== 'lite') return slot;
  const { lite, litePresence, ...base } = slot;
  const presence = litePresenceOf(slot, profile);
  const tracked = presence === 'forbidden' ? 'external' : (slot.tracked === 'external' ? 'tracked' : slot.tracked);
  return { ...base, ...(lite ?? {}), presence, tracked, tests: 'none' };
}

/** The template group hfs sync renders `slot` from under `edition`: `liteManagedBy` (else `managedBy`) in lite, `managedBy` otherwise; undefined when unmanaged. */
export function managedGroupOf(slot, edition) {
  return edition === 'lite' ? (slot.liteManagedBy ?? slot.managedBy) : slot.managedBy;
}

/** The declared edition and the vocabulary against which it is validated. */
export function declarationEdition(manifest, declaration) {
  const edition = declaration.edition ?? 'full';
  const known = manifest.editions ?? EDITIONS;
  return { edition, known, valid: known.includes(edition) };
}

/** Problems of an optional rule-catalog `editions` list, in the catalog schema's words. */
export function ruleEditionProblems(rule, label) {
  if (rule.editions === undefined) return [];
  const bad = [];
  if (!Array.isArray(rule.editions) || !rule.editions.length) return [`${label}.editions must be a non-empty list`];
  for (const value of rule.editions) if (!EDITIONS.includes(value)) bad.push(`${label}.editions has ${JSON.stringify(value)}, not one of ${EDITIONS.join(', ')}`);
  if (new Set(rule.editions).size !== rule.editions.length) bad.push(`${label}.editions repeats a value`);
  return bad;
}

/** Whether a catalogued rule owner judges its finding under `edition`; uncatalogued codes always remain judged. */
export function judgedInEdition(owner, edition = 'full') {
  return !owner?.editions || owner.editions.includes(edition);
}

/** Whether the enforcer `kind:id` of the catalog `rules` runs under `edition`: every rule listing it is judged there, and the enforcer row's own `editions` (a rule with several enforcers where only one is full-only) agrees. A lint rule no rule lists runs everywhere. */
export function enforcerJudgedInEdition(rules, kind, id, edition = 'full') {
  const owners = rules.filter((rule) => rule.enforcers.some((enforcer) => enforcer.kind === kind && enforcer.id === id));
  return owners.every((rule) => judgedInEdition(rule, edition) && rule.enforcers.filter((enforcer) => enforcer.kind === kind && enforcer.id === id).every((enforcer) => judgedInEdition(enforcer, edition)));
}

/** A frozen copy of one profile's parameters, with its lite overrides applied only in the lite edition. */
export function editionRuleParams(params, edition) {
  const { lite, ...base } = params;
  const merged = edition === 'lite' && lite ? { ...base, ...lite } : base;
  const deepFreeze = (value) => { if (value && typeof value === 'object') Object.values(value).forEach(deepFreeze); return Object.freeze(value); };
  return deepFreeze(structuredClone(merged));
}
