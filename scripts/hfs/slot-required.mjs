// slot-required.mjs - what a scope (the app root or one side) must contain, without walking it: the files an instance of a slot
// requires, and the paths and minimum instance counts of every required slot. A scope is the one slots.mjs builds.
import path from 'node:path';
import { braceVariants } from '../lib/glob.mjs';
import { classifyIn, slotEnabled } from './slot-classify.mjs';
import { fillVars, varsOf } from './slot-match.mjs';

/** One `requires` entry of a slot placed under `root`: a leading / makes it repository-relative, the variables are filled from `bindings`. */
function requiredEntry(entry, bindings, root) {
  const rooted = entry.startsWith('/');
  const filled = fillVars(rooted ? entry.slice(1) : entry, bindings);
  return rooted || !root || root === '.' ? filled : `${root}/${filled}`;
}

/** The files and directories the instance holding `p` must contain (directories end with /); {path} entries are repo-relative. */
export function requiredFilesIn(scope, input) {
  const c = classifyIn(scope, input);
  if (!c.slot) return [];
  const slot = scope.byId.get(c.slot);
  return (slot.requires ?? []).map((entry) => requiredEntry(entry, c.bindings, c.root));
}

function growBindings(combos, name, values) {
  const next = [];
  for (const combo of combos) {
    for (const value of values) next.push({ ...combo, [name]: value });
  }
  combos.splice(0, combos.length, ...next);
}

const expandApps = (repo, slot) => repo.apps.filter((a) => slot.appKind === undefined || a.kind === slot.appKind);

function appendRequiredVariantPaths(repo, slot, variant, paths) {
  const names = [...new Set(varsOf(variant))];
  const fixed = { ...slot.requiredInstances };
  const open = names.filter((name) => name !== 'app' && !(name in fixed));
  if (open.length) return;
  const combos = [{}];
  if (names.includes('app')) growBindings(combos, 'app', expandApps(repo, slot).map((app) => app.name));
  for (const [name, values] of Object.entries(fixed)) growBindings(combos, name, values);
  const isInstance = names.length > 0;
  for (const bindings of combos) {
    const target = fillVars(variant, bindings);
    paths.push({ slot: slot.id, path: target, via: isInstance ? 'instance' : 'slot' });
    const root = target.endsWith('/') ? target.slice(0, -1) : path.posix.dirname(target);
    for (const entry of slot.requires ?? []) paths.push({ slot: slot.id, path: requiredEntry(entry, bindings, root), via: 'requires' });
  }
}

function appendRequiredSlotPaths(scope, slot, paths, minimums) {
  if (slot.presence !== 'required' || !slotEnabled(scope, slot)) return;
  if (slot.requiredWhen === 'connections' && !scope.repo.connections.length) return;
  if (slot.minInstances) minimums.push({ slot: slot.id, min: slot.minInstances, ...(slot.appKind ? { appKind: slot.appKind } : {}) });
  for (const variant of braceVariants(slot.path)) appendRequiredVariantPaths(scope.repo, slot, variant, paths);
}

function uniqueRequiredPaths(paths) {
  const seen = new Set();
  return paths.filter((entry) => {
    const key = `${entry.slot}|${entry.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * What the repository must contain, without walking it: {paths: [{slot, path, via}], minimums: [{slot, min}]}.
 * via is slot (a fixed path), instance (a requiredInstances or app-kind root) or requires (a file an instance needs).
 */
export function requiredPathsIn(scope) {
  const paths = [];
  const minimums = [];
  for (const slot of scope.slots) appendRequiredSlotPaths(scope, slot, paths, minimums);
  return { paths: uniqueRequiredPaths(paths), minimums };
}
