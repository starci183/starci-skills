// declaration-slots.mjs - how an app declaration (hfs.json) switches on the opt-in slots of a side: by name (`optionalSlots`), by app kind
// (a slot with `appKind`) and by declared pattern (a slot with `pattern: <name>` is enabled by `sides.<side>.patterns: [<name>]`, one
// mechanism for every pattern: saga, event-bus, fenced-job, ...). slots.mjs asks this file to judge a side's lists and to say whether a
// slot is enabled for a repository.

/** The problems of a side's `optionalSlots` and `patterns` against the manifest. */
export function optionalSlotProblems(manifest, side, s) {
  const bad = [];
  for (const id of s.optionalSlots ?? []) {
    const slot = manifest.slots.find((candidate) => candidate.id === id);
    if (!slot || !slot.profiles.includes(side)) bad.push(`sides.${side}.optionalSlots names ${id}, which is not a ${side} slot`);
    else if (slot.presence !== 'opt-in') bad.push(`sides.${side}.optionalSlots names ${id}, which is ${slot.presence}, not opt-in`);
    else if (slot.appKind !== undefined) bad.push(`sides.${side}.optionalSlots names ${id}; an app of kind ${slot.appKind} enables it`);
  }
  for (const name of s.patterns ?? []) {
    if (!manifest.slots.some((slot) => slot.profiles.includes(side) && slot.pattern === name)) bad.push(`sides.${side}.patterns names ${name}, which no ${side} slot declares as its pattern`);
  }
  if (s.kinds !== undefined && side !== 'be') bad.push(`sides.${side}.kinds belongs to the be side`);
  for (const kind of s.kinds ?? []) {
    if (!(manifest.triggerKinds ?? []).includes(kind)) bad.push(`sides.${side}.kinds names ${kind}, which is not one of triggerKinds (${(manifest.triggerKinds ?? []).join(', ')})`);
  }
  return bad;
}

/** The problems of the shape of a side's `patterns` list (a unique list of pattern names). */
export function patternShapeProblems(s, at, namePattern) {
  const list = s.patterns;
  if (list === undefined) return [];
  return Array.isArray(list) && list.every((value) => namePattern.test(String(value))) && new Set(list).size === list.length ? [] : [`${at}.patterns must be a unique list of pattern names`];
}

/** The problems of the shape of a side's `kinds` list (a unique list of trigger kind names). */
export function kindShapeProblems(s, at, namePattern) {
  const list = s.kinds;
  if (list === undefined) return [];
  return Array.isArray(list) && list.every((value) => namePattern.test(String(value))) && new Set(list).size === list.length ? [] : [`${at}.kinds must be a unique list of trigger kind names`];
}

/** The problems of `ruleParams.be.kindPatterns` (trigger kind -> patterns) and `ruleParams.be.addKinds` (starci app add noun -> {topic, variable, patterns, trigger?, needs?, also?, defaults?, wire?}). */
export function kindParamProblems(be, triggerKinds) {
  const kebab = /^[a-z][a-z0-9-]*$/;
  const names = (list) => Array.isArray(list) && list.every((value) => kebab.test(String(value))) && new Set(list).size === list.length;
  const bad = [];
  const patterns = be.kindPatterns;
  if (patterns === null || typeof patterns !== 'object' || Array.isArray(patterns) || !Object.entries(patterns).every(([kind, list]) => (triggerKinds ?? []).includes(kind) && names(list))) bad.push('ruleParams.be.kindPatterns must map a trigger kind to a unique list of pattern names');
  const nouns = be.addKinds;
  const nounOk = (spec) => spec !== null && typeof spec === 'object' && kebab.test(String(spec.topic)) && kebab.test(String(spec.variable)) && names(spec.patterns) && (spec.trigger === undefined || kebab.test(String(spec.trigger))) && (spec.needs === undefined || names(spec.needs)) && (spec.also === undefined || names(spec.also)) && (spec.defaults === undefined || (typeof spec.defaults === 'object' && !Array.isArray(spec.defaults))) && (spec.wire === undefined || (spec.wire !== null && typeof spec.wire === 'object' && ['file', 'import', 'symbol'].every((key) => typeof spec.wire[key] === 'string' && spec.wire[key] !== '')));
  if (nouns === null || typeof nouns !== 'object' || Array.isArray(nouns) || !Object.entries(nouns).every(([noun, spec]) => kebab.test(noun) && nounOk(spec))) bad.push('ruleParams.be.addKinds must map a noun to {topic, variable, patterns, trigger?, needs?, also?, defaults?}');
  return bad;
}

/** The problems of `ruleParams.be.patternScenarios`: a pattern name to a non-empty list of unique kebab-case scenario ids. */
export function scenarioProblem(scenarios) {
  const kebab = /^[a-z][a-z0-9-]*$/;
  const ok = scenarios !== null && typeof scenarios === 'object' && !Array.isArray(scenarios) && Object.entries(scenarios).every(([name, list]) => kebab.test(name) && Array.isArray(list) && list.length > 0 && list.every((id) => kebab.test(String(id))) && new Set(list).size === list.length);
  return ok ? [] : ['ruleParams.be.patternScenarios must map a pattern name to a non-empty list of unique kebab-case scenario ids'];
}

/** The problems of the `trigger` of a slot against the manifest's `triggerKinds`: a known kind, on a feature-tier slot only. */
export function triggerProblems(slot, triggerKinds) {
  if (slot.trigger === undefined) return [];
  const bad = [];
  if (!(triggerKinds ?? []).includes(slot.trigger)) bad.push(`slot ${slot.id}: trigger ${slot.trigger} is not one of triggerKinds`);
  if (slot.tier !== 'feature') bad.push(`slot ${slot.id}: a trigger belongs to a feature-tier slot`);
  return bad;
}

/** Whether an opt-in slot is enabled for the repository: by its app kind, by name in optionalSlots, or by its declared pattern. */
export function declaredSlotEnabled(slot, repo) {
  if (slot.appKind !== undefined) return repo.apps.some((app) => app.kind === slot.appKind);
  return repo.optionalSlots.includes(slot.id) || (slot.pattern !== undefined && (repo.patterns ?? []).includes(slot.pattern));
}
