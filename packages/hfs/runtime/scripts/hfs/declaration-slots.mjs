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
  return bad;
}

/** The problem of the shape of a side's `patterns` list (a unique list of pattern names), or null. */
export function patternShapeProblem(s, at, namePattern) {
  const list = s.patterns;
  if (list === undefined) return null;
  return Array.isArray(list) && list.every((value) => namePattern.test(String(value))) && new Set(list).size === list.length ? null : `${at}.patterns must be a unique list of pattern names`;
}

/** Whether an opt-in slot is enabled for the repository: by its app kind, by name in optionalSlots, or by its declared pattern. */
export function declaredSlotEnabled(slot, repo) {
  if (slot.appKind !== undefined) return repo.apps.some((app) => app.kind === slot.appKind);
  return repo.optionalSlots.includes(slot.id) || (slot.pattern !== undefined && (repo.patterns ?? []).includes(slot.pattern));
}
