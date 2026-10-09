#!/usr/bin/env node
// check-held-surfacing.mjs - RT_HELD_UNSURFACED (R240; part of `npm run check`).
//   runs in the check stage (self-check held-surfacing); --json prints the findings as JSON
//
// A failure code the catalogue gives to a role (`owner: supervisor` or `owner: owner`) with `kind: runtime-fault` is a state that role must be able to learn of. The runtime is built to
// stop rather than guess, so a stop nobody is told of stands for hours until someone reads source. Each such entry therefore names, in modules/kernel/failure-codes.yaml, the
// house mechanism that reaches its owner, and this check proves the mechanism exists and is wired to that file:
//   surfacedBy: decision-item   surfacedAs = a Decision Item kind (scripts/machine/decisions.mjs DI_KINDS); surfacedAt opens items and names that kind
//   surfacedBy: sla-clock       surfacedAs = a code of modules/reconciler/sla.yaml with an owner; surfacedAt sets a clock under that code
//   surfacedBy: incident        surfacedAs = an incident kind; surfacedAt opens incidents and names that kind
//   surfacedBy: digest          surfacedAs = a departure of modules/reconciler/operating-standard.yaml (a problem line of `starci debug digest`); surfacedAt names it
//   surfacedBy: notifier        surfacedAs = an urgent class of scripts/reconciler/notifier.mjs, which sends the owner an alert
//   surfacedBy: caller          the refusal is the answer of a verb the owning role itself ran, in the same call; surfacedAt is that verb, never a reconciler file (a loop is no owner)
//   surfacedBy: open            nothing reaches the owner yet; openCase names the edge-case registry entry (status open) that carries the exact reason
// Every entry also names a producer: surfacedAt contains the code (or, for a mechanism that reaches the code through another name, the name in surfacedAs).
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { DI_KINDS } from '../machine/decisions.mjs';
import { escapeRegExp } from '../lib/regex.mjs';

export const CODE = 'RT_HELD_UNSURFACED';
export const CATALOG_FILE = 'modules/kernel/failure-codes.yaml';
export const MECHANISMS = Object.freeze(['decision-item', 'sla-clock', 'incident', 'digest', 'notifier', 'caller', 'open']);
const OWNING_ROLES = Object.freeze(['supervisor', 'owner']);
const OPENS_DECISION = /openDecision\w*\(|\.di\(|\bdi\(|openSupDecision\(/;
const OPENS_INCIDENT = /openIncident\(/;
const SETS_CLOCK = /\b(?:clock|openClock|setClock|openSlaEpisode)\(/;
const CONTROLLER_DIR = 'scripts/reconciler/';

/** The catalogue entries this check judges: a runtime fault given to the Supervisor or the owner. */
export const heldEntries = (catalog) => Object.entries(catalog).filter(([, entry]) => entry?.kind === 'runtime-fault' && OWNING_ROLES.includes(entry.owner));

const finding = (code, message) => ({ code: CODE, path: CATALOG_FILE, message: `${code}: ${message}` });
const literal = (name) => new RegExp(`['"\`]${escapeRegExp(String(name))}['"\`]`);

/** The mechanism proofs: each answers a message when the entry does not hold, else null. `world` carries the files and registries the proofs read. */
const PROOFS = {
  'decision-item': (e, world) => (!DI_KINDS.includes(e.surfacedAs) ? `${e.surfacedAs} is not a Decision Item kind`
    : world.refute(e, [OPENS_DECISION, literal(e.surfacedAs)], 'opens Decision Items naming that kind')),
  'sla-clock': (e, world) => (!world.sla[e.surfacedAs]?.owner ? `${e.surfacedAs} is no code of modules/reconciler/sla.yaml with an owner`
    : world.refute(e, [SETS_CLOCK, literal(e.surfacedAs)], 'sets a clock under that code')),
  incident: (e, world) => world.refute(e, [OPENS_INCIDENT, literal(e.surfacedAs)], 'opens incidents of that kind'),
  digest: (e, world) => (!world.departures.has(e.surfacedAs) ? `${e.surfacedAs} is no departure of modules/reconciler/operating-standard.yaml`
    : world.refute(e, [literal(e.surfacedAs)], 'names that problem line')),
  notifier: (e, world) => world.refute(e, [literal(e.surfacedAs), /URGENT_CLASSES/], 'sends the owner that urgent class'),
  caller: (e, world) => (e.surfacedAt.startsWith(CONTROLLER_DIR) ? 'a reconciler file is a loop, not the role that ran a verb; name the verb or the mechanism that reaches the owner'
    : world.refute(e, [literal(e.code)], 'contains the code it answers')),
  open: (e, world) => (world.cases.get(e.openCase)?.status === 'open' ? null : `openCase ${e.openCase ?? '(none)'} is no edge-case registry entry with status open`),
};

/** One entry against its declaration: the findings (none when it names a mechanism that holds). Pure over `world`. */
export function entryFindings(code, entry, world) {
  const e = { ...entry, code };
  const proof = PROOFS[e.surfacedBy];
  if (!proof) return [finding(code, `owner ${e.owner} has no surfacedBy (${MECHANISMS.join(' | ')}): the stop it names would stand silent`)];
  if (e.surfacedBy !== 'open' && !world.has(e.surfacedAt)) return [finding(code, `surfacedAt ${e.surfacedAt ?? '(none)'} is no file of the tree`)];
  const message = proof(e, world);
  return message ? [finding(code, `${e.surfacedBy}: ${message}`)] : [];
}

/** The findings of the whole catalogue. Pure over `world` = {sla, departures, cases, has(file), refute(entry, patterns, what)}. */
export function heldSurfacingFindings(catalog, world) {
  return heldEntries(catalog).flatMap(([code, entry]) => entryFindings(code, entry, world));
}

/** The world of a tree at `root`: its registries, and the file reads the proofs make. */
export function worldOf(root) {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const sla = parseYaml(read('modules/reconciler/sla.yaml')).codes ?? {};
  const departures = new Set(Object.keys(parseYaml(read('modules/reconciler/operating-standard.yaml')).departures ?? {}));
  const cases = new Map((parseYaml(read('modules/reconciler/edge-cases.yaml')).cases ?? []).map((entry) => [entry.id, entry]));
  const has = (file) => typeof file === 'string' && fs.existsSync(path.join(root, file));
  const refute = (entry, patterns, what) => {
    const text = read(entry.surfacedAt);
    return patterns.every((pattern) => pattern.test(text)) ? null : `${entry.surfacedAt} does not show that it ${what}`;
  };
  return { sla, departures, cases, has, refute };
}

/** Run the check on the runtime at `root`. */
export function checkHeldSurfacing(root = skillRoot) {
  const catalog = parseYaml(fs.readFileSync(path.join(root, CATALOG_FILE), 'utf8'));
  return heldSurfacingFindings(catalog, worldOf(root));
}

if (isMain(import.meta.url)) process.exit(printFindings(checkHeldSurfacing(), 'OK: every runtime fault given to the Supervisor or the owner names a mechanism that reaches them.'));
