// slot-semantic-problems.mjs - semantic checks for the HFS slot manifest.
import { isPlainObject } from '../../engine/plain-object.mjs';
import { braceVariants } from '../lib/glob.mjs';
import { triggerProblems } from './declaration-slots.mjs';
import { litePresenceOf, slotInEdition } from './edition-slots.mjs';
import { manifestKind, RUNTIME_KIND, runtimeSemanticProblems } from './manifest-shape.mjs';
import { APP_SCOPE, PROFILES } from './slot-manifest-shape.mjs';

function checkAppRootSlot(slot, bad) {
  for (const key of ['appKind', 'owner', 'layers', 'kinds', 'composedBy', 'requiredWhen', 'requiredInstances']) {
    if (slot[key] !== undefined) bad.push(`slot ${slot.id}: an app-root slot has no ${key}`);
  }
  if (slot.tier !== 'none') bad.push(`slot ${slot.id}: an app-root slot has tier none`);
}

function checkSideSlot(slot, profile, manifest, bad) {
  const tiers = manifest.tiers[profile];
  if (slot.tier !== 'none' && slot.tier !== 'inherit' && !(slot.tier in tiers)) bad.push(`slot ${slot.id}: tier ${slot.tier} is not a ${profile} tier`);
  if (slot.appKind !== undefined && !manifest.appKinds[profile].includes(slot.appKind)) bad.push(`slot ${slot.id}: app kind ${slot.appKind} is not a ${profile} kind`);
  bad.push(...triggerProblems(slot, manifest.triggerKinds));
}

function claimSlotPatterns(slot, profile, claimed, bad, braceVariants) {
  if (slot.appKind !== undefined) return;
  for (const variant of braceVariants(slot.path)) {
    const key = `${profile}:${variant}`;
    if (claimed.has(key)) bad.push(`slots ${claimed.get(key)} and ${slot.id} claim the same pattern ${variant} on ${profile}`);
    else claimed.set(key, slot.id);
  }
}

function checkSlotProfiles(slot, manifest, claimed, bad, braceVariants) {
  for (const profile of slot.profiles) {
    if (profile === APP_SCOPE) checkAppRootSlot(slot, bad);
    else checkSideSlot(slot, profile, manifest, bad);
    claimSlotPatterns(slot, profile, claimed, bad, braceVariants);
  }
}

function checkLitePath(slot, pathVars, varsOf, bad, braceVariants, compileVariant) {
  if (slot.lite?.path === undefined) return;
  for (const name of varsOf(slot.lite.path)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: lite.path binds <${name}>, which the path does not`);
  for (const variant of braceVariants(slot.lite.path)) {
    try { compileVariant(slot, variant); } catch (error) { bad.push(`slot ${slot.id}: lite.path ${variant} does not compile (${error.message})`); }
  }
}

function checkNamedPathBindings(slot, pathVars, varsOf, bad) {
  for (const name of Object.keys(slot.requiredInstances ?? {})) {
    if (!pathVars.has(name)) bad.push(`slot ${slot.id}: requiredInstances names <${name}>, which the path does not bind`);
  }
  for (const file of Object.values(slot.roles ?? {})) {
    for (const name of varsOf(file)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: roles names <${name}> in ${file}, which the path does not bind`);
  }
  for (const entry of slot.requires ?? []) {
    for (const name of varsOf(entry)) if (!pathVars.has(name)) bad.push(`slot ${slot.id}: requires ${entry} uses <${name}>, which the path does not bind`);
  }
}

function checkSlotPatternCompilation(slot, bad, braceVariants, compileVariant) {
  for (const variant of braceVariants(slot.path)) {
    try { compileVariant(slot, variant); } catch (error) { bad.push(`slot ${slot.id}: pattern ${variant} does not compile (${error.message})`); }
  }
}

function checkSlotComposition(slot, manifest, bad) {
  for (const kind of slot.composedBy ?? []) {
    if (!slot.profiles.every((profile) => manifest.appKinds[profile].includes(kind))) bad.push(`slot ${slot.id}: composedBy names ${kind}, which is not an app kind of every profile of the slot`);
  }
  if (slot.layers !== undefined && slot.tier !== 'none' && !slot.profiles.every((profile) => manifest.tiers[profile][slot.tier]?.lowerLayerOnly)) bad.push(`slot ${slot.id}: layers need a lowerLayerOnly tier`);
}

function checkSlotSemantics(slot, manifest, claimed, bad, helpers) {
  if (claimed.ids.has(slot.id)) bad.push(`slot id ${slot.id} appears twice`);
  claimed.ids.add(slot.id);
  const pathVars = new Set(helpers.varsOf(slot.path));
  checkSlotProfiles(slot, manifest, claimed.patterns, bad, helpers.braceVariants);
  if (slot.appKind !== undefined && !pathVars.has('app')) bad.push(`slot ${slot.id}: an app-kind slot binds <app> in its path`);
  if (slot.requiredWhen !== undefined && slot.presence !== 'required') bad.push(`slot ${slot.id}: requiredWhen belongs to a required slot`);
  if (!slotInEdition(manifest, slot, 'lite') && (slot.litePresence !== undefined || slot.lite !== undefined)) bad.push(`slot ${slot.id}: litePresence/lite on a slot lite never sees (editions)`);
  if (isPlainObject(slot.litePresence) && slot.profiles.includes(APP_SCOPE)) bad.push(`slot ${slot.id}: an app-root slot takes a bare litePresence, not a per-side map`);
  for (const profile of slot.profiles) {
    if (litePresenceOf(slot, profile) === 'forbidden' && typeof slot.goesTo !== 'string') bad.push(`slot ${slot.id}: forbidden in lite for ${profile}, so it says where the content goes (goesTo)`);
  }
  checkLitePath(slot, pathVars, helpers.varsOf, bad, helpers.braceVariants, helpers.compileVariant);
  checkNamedPathBindings(slot, pathVars, helpers.varsOf, bad);
  checkSlotPatternCompilation(slot, bad, helpers.braceVariants, helpers.compileVariant);
  checkSlotComposition(slot, manifest, bad);
}

function checkSideReads(manifest, bad, braceVariants) {
  for (const side of PROFILES) {
    for (const read of manifest.sides[side].reads) {
      const [owner, ...rest] = read.split('/');
      const below = rest.join('/');
      if (owner === side) bad.push(`sides.${side}.reads names ${read}, which is its own side`);
      else if (PROFILES.includes(owner)) {
        const owned = manifest.slots.some((slot) => slot.profiles.includes(owner) && slot.presence !== 'forbidden' && braceVariants(slot.path).some((variant) => variant.startsWith(below)));
        if (!owned) bad.push(`sides.${side}.reads names ${read}, which no ${owner} slot owns`);
      } else {
        const owned = manifest.slots.some((slot) => slot.profiles.includes(APP_SCOPE) && slot.presence !== 'forbidden' && braceVariants(slot.path).some((variant) => variant.startsWith(read)));
        if (!owned) bad.push(`sides.${side}.reads names ${read}, which no app-root slot owns`);
      }
    }
  }
}

function checkProfileTierTargets(manifest, profile, bad) {
  for (const [tier, def] of Object.entries(manifest.tiers[profile])) {
    for (const target of def.mayImport) {
      if (!(target in manifest.tiers[profile])) bad.push(`tiers.${profile}.${tier}.mayImport names ${target}, which is not a ${profile} tier`);
    }
  }
}

function checkProfileAppKinds(manifest, profile, bad) {
  for (const kind of manifest.appKinds[profile]) {
    const owners = manifest.slots.filter((slot) => slot.profiles.includes(profile) && slot.appKind === kind);
    if (owners.length !== 1) bad.push(`${profile} app kind ${kind} must have exactly one slot (found ${owners.length})`);
  }
}

function checkProfileMaps(manifest, bad) {
  for (const profile of PROFILES) {
    checkProfileTierTargets(manifest, profile, bad);
    checkProfileAppKinds(manifest, profile, bad);
  }
}

/** The rules a JSON Schema cannot state: unique ids, tiers named and reachable, app kinds, variables, no duplicate pattern. */
export function manifestSemanticProblems(manifest, helpers) {
  const bad = [];
  const claimed = { ids: new Set(), patterns: new Map() };
  for (const slot of manifest.slots) checkSlotSemantics(slot, manifest, claimed, bad, helpers);
  if (manifestKind(manifest) === RUNTIME_KIND) return [...bad, ...runtimeSemanticProblems(manifest)];
  checkSideReads(manifest, bad, helpers.braceVariants);
  checkProfileMaps(manifest, bad);
  const major = Number(manifest.version.split('.')[0]);
  if (String(manifest.schema) !== `starci/hfs-slots@${major}`) bad.push(`schema ${manifest.schema} does not carry the major of version ${manifest.version}`);
  return bad;
}
