// land-cli-specs.mjs - the land gate's rule for specs that reach a changed file by SPAWNING the CLI.
//
// A spec that runs `scripts/kernel/cli.mjs report ...` or `packages/cli/bin/starci.mjs kernel report ...` never imports the code behind the verb,
// so neither the name rule nor the import rule of `direct` selects it; the bounded smoke set of `touching` picks 24 of the specs that reach a hub
// only through the graph. On 2026-10-07 a change to a shared verb helper passed the gate and broke 13 specs that each spawned the CLI and ran a
// verb the change reached. Such a spec counts as direct: it spawns the CLI entry the verb belongs to AND names the verb, and the verb's handler
// reaches a changed file through relative imports.
//
// A verb's handler is its own module (`<dispatcher dir>/verbs/<verb>.mjs`) when there is one, else the dispatcher itself; a verb that has no
// module of its own is reached only when the dispatcher file is the one that changed (its imports are every verb's), never by a helper.
import fs from 'node:fs';
import path from 'node:path';
import { reachableFrom } from '../lib/spec-deps.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { CATALOG_DIR, loadCatalog } from '../cli/catalog.mjs';
import { byCodeUnit } from '../../engine/by-code-unit.mjs';

const STARCI_BIN = 'starci.mjs';
const posix = (file) => String(file).replaceAll('\\', '/');

/** The flat verb list of a loaded catalog (scripts/cli/catalog.mjs loadCatalog): [{group, verb, dispatcher}] where dispatcher is the repo path of the verb's script or module. */
export const catalogVerbs = (loaded) => loaded.groups.flatMap((group) => group.verbs
  .map((entry) => ({ group: group.group, verb: entry.verb, dispatcher: posix(entry.impl?.script ?? entry.impl?.module ?? '') }))
  .filter((entry) => entry.dispatcher));

const handlerOf = (root, entry) => {
  const own = `${path.posix.dirname(entry.dispatcher)}/verbs/${entry.verb}.mjs`;
  return fs.existsSync(path.join(root, own)) ? own : entry.dispatcher;
};

// The import distance from `handler` to the nearest changed file (1 = it imports one), or Infinity; `cache` holds the direct imports reachableFrom filed.
function distanceTo(handler, wanted, cache) {
  const seen = new Set([handler]);
  let frontier = [handler];
  for (let distance = 1; frontier.length > 0; distance += 1) {
    const next = [];
    for (const file of frontier) {
      for (const dep of cache.get(file) ?? []) {
        if (wanted.has(dep)) return distance;
        if (!seen.has(dep)) {
          seen.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** allocation.landGate.cliVerbs (modules/models/runtimes.yaml): how many changed verbs the CLI rule follows past the verbs that import a changed file themselves. */
export function cliVerbLimit() {
  const limit = Number(allocationSettings()?.landGate?.cliVerbs);
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('modules/models/runtimes.yaml allocation.landGate.cliVerbs must declare a positive number of verbs');
  return limit;
}

/**
 * The verbs whose handler reaches a changed file (or whose dispatcher is one), nearest first: [{group, verb, dispatcher, distance}]. A verb
 * whose handler imports a changed file itself (distance 1), or whose dispatcher changed, is always kept; the verbs that reach it deeper
 * follow in order of distance until `limit` verbs are kept in all.
 */
export function changedVerbs({ root, changed, verbs, cache = new Map(), limit = cliVerbLimit() }) {
  const wanted = new Set(changed.map(posix));
  const sharing = new Map();
  for (const entry of verbs) sharing.set(entry.dispatcher, (sharing.get(entry.dispatcher) ?? 0) + 1);
  const reached = [];
  for (const entry of verbs) {
    const handler = handlerOf(root, entry);
    if (wanted.has(entry.dispatcher) || wanted.has(handler)) reached.push({ ...entry, distance: 0 });
    else if (handler !== entry.dispatcher || sharing.get(handler) === 1) {
      reachableFrom(root, handler, { cache });
      const distance = distanceTo(handler, wanted, cache);
      if (distance !== Infinity) reached.push({ ...entry, distance });
    }
  }
  reached.sort((a, b) => a.distance - b.distance || byCodeUnit(`${a.group} ${a.verb}`, `${b.group} ${b.verb}`));
  const near = reached.filter((entry) => entry.distance <= 1);
  return [...near, ...reached.slice(near.length, Math.max(near.length, limit))];
}

const textOf = (root, file, texts) => {
  if (!texts.has(file)) {
    try { texts.set(file, fs.readFileSync(path.join(root, file), 'utf8')); } catch { texts.set(file, ''); }
  }
  return texts.get(file);
};
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
// the verb written as a quoted argument, or as `starci <group> <verb>` / `<group> <verb>`
const namesVerb = (code, entry) => new RegExp(String.raw`['"\`]${escapeRe(entry.verb)}['"\`]|\b${escapeRe(entry.group)}\s+${escapeRe(entry.verb)}\b`).test(code);

/**
 * The specs that spawn the CLI entry of a changed verb and name that verb. `specs` = [{file, code}] (code without comment lines);
 * `verbs` = catalogVerbs(...). Returns spec paths.
 */
export function specsExercisingChangedVerbs({ root, changed, specs, verbs }) {
  const cache = new Map();
  const hit = changedVerbs({ root, changed, verbs, cache });
  if (!hit.length) return [];
  const texts = new Map();
  // the spec or a test helper it reaches runs packages/cli/bin/starci.mjs
  const runsStarci = (spec, reach) => spec.code.includes(STARCI_BIN) || [...reach].some((file) => file.startsWith('tests/helpers/') && textOf(root, file, texts).includes(STARCI_BIN));
  return specs.filter((spec) => {
    const reach = reachableFrom(root, spec.file, { cache });
    return hit.some((entry) => namesVerb(spec.code, entry) && (reach.has(entry.dispatcher) || runsStarci(spec, reach)));
  }).map((spec) => spec.file);
}

/** The CLI rule over the specs the land gate holds: `code` = Map spec path -> code without comment lines. A tree without a CLI catalog has no verbs. */
export function cliSpecsOf({ root, changed, code }) {
  if (!fs.existsSync(path.join(root, CATALOG_DIR))) return [];
  const specs = [...code].map(([file, text]) => ({ file, code: text }));
  return specsExercisingChangedVerbs({ root, changed: changed.filter((file) => !file.startsWith('tests/')), specs, verbs: catalogVerbs(loadCatalog(root)) });
}
