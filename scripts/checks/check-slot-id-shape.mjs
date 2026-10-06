#!/usr/bin/env node
// check-slot-id-shape.mjs — SLOT_ID_SHAPE (R211, RT_SLOT_ID_SHAPE; part of `npm run check`).
//   runs in the check stage (self-check slot-id-shape); --json prints the findings as JSON
//
// A slot id names a place, once, in one grammar; the manifests state the grammar and the check enforces it.
// The vocabulary is read from the manifests, never restated here:
//   knowledge/hfs/slots.yaml         — kind app: `naming.prefixes`, `naming.sameConceptPairs`,
//                                      `naming.refusedPairs`, `naming.glossary` (S9-02), `appKinds`,
//                                      `ruleParams.<side>.suffixes` / `bannedSuffixes`.
//   knowledge/hfs/runtime-slots.yaml — kind runtime: `profiles` names the one id prefix.
//
// The laws, over the slots of each manifest:
//   - an id is dot-separated lowercase kebab segments ([a-z][a-z0-9-]*, no leading digit, no empty or
//     doubled dash);
//   - the first segment is a declared prefix (naming.prefixes of the app manifest, profiles of the
//     runtime manifest);
//   - `<side>.app.<kind>` names a kind of appKinds.<side>;
//   - a deeper id names its parent: an explicit `parent` field must be a declared id the id extends;
//     otherwise a proper prefix (>= 2 segments) is a declared id, or the id is a depth-3 member of a
//     family (`<prefix>.<group>`) at least two slots share — a lone deep orphan invents a family;
//   - the role-suffix vocabulary has no synonym pairs: a profile's `suffixes` never shares a word with
//     `bannedSuffixes`, and no `naming.refusedPairs` pair is live in `suffixes` on both sides. The one
//     owner-approved exception is `naming.sameConceptPairs` (step + saga-step: `.saga-step.ts` stays) —
//     both members must stay live or the exception is stale.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

export const CODE = 'RT_SLOT_ID_SHAPE';
const APP_MANIFEST = 'knowledge/hfs/slots.yaml';
const RUNTIME_MANIFEST = 'knowledge/hfs/runtime-slots.yaml';
/** The manifests a slot id may live in, in scan order. */
const MANIFESTS = Object.freeze([APP_MANIFEST, RUNTIME_MANIFEST]);

const SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const pairsOf = (v) => (Array.isArray(v) ? v.filter((p) => Array.isArray(p) && p.length === 2) : []);

/** The id prefixes of a manifest: naming.prefixes of an app manifest, profiles of a runtime manifest. */
export function prefixesOf(doc) {
  if (Array.isArray(doc?.naming?.prefixes) && doc.naming.prefixes.length) return doc.naming.prefixes.map(String);
  if (Array.isArray(doc?.profiles) && doc.profiles.length) return doc.profiles.map(String);
  return [];
}

/** The shape findings of one slot id. */
const slotFinding = (file, slot, { ids, prefixes, families, appKinds }, push) => {
  const id = String(slot?.id ?? '');
  const segs = id.split('.');
  if (!segs.every((s) => SEGMENT.test(s))) {
    push(file, `${file} slot id "${id}" is not dot-separated lowercase kebab segments (no leading digit, empty or doubled dash)`);
    return;
  }
  if (!prefixes.has(segs[0])) push(file, `${file} slot id "${id}" begins with "${segs[0]}", which is not a declared prefix (${[...prefixes].join(', ')})`);
  if (slot.parent !== undefined) {
    const parent = String(slot.parent);
    if (!ids.has(parent)) push(file, `${file} slot ${id} names parent "${parent}", which is not a declared slot id`);
    else if (!id.startsWith(`${parent}.`)) push(file, `${file} slot ${id} must extend its parent ${parent} (id starts with <parent>.)`);
    return;
  }
  if (segs.length < 3) return;
  if (segs[1] === 'app' && segs.length === 3) {
    if (!appKinds?.[segs[0]]?.includes(segs[2])) push(file, `${file} slot ${id}: <side>.app.<kind> names an appKinds.${segs[0]} kind (${(appKinds?.[segs[0]] ?? []).join(', ')})`);
    return;
  }
  const extendsDeclared = segs.slice(0, -1).some((_, i) => i >= 1 && ids.has(segs.slice(0, i + 1).join('.')));
  if (!extendsDeclared && !(segs.length === 3 && (families.get(`${segs[0]}.${segs[1]}`) ?? 0) >= 2)) {
    push(file, `${file} slot id "${id}" extends no declared slot id and shares no family — name a parent, or give the family a second member`);
  }
};

/** The slot-id shape findings of one parsed manifest {file, doc}. */
export function slotIdFindings({ file, doc }) {
  const findings = [];
  const push = (path, message) => findings.push({ code: CODE, path, message });
  const slots = Array.isArray(doc?.slots) ? doc.slots : [];
  const prefixes = new Set(prefixesOf(doc));
  const ids = new Set(slots.map((s) => String(s?.id ?? '')).filter(Boolean));

  // A depth-3 id may introduce a family (`be.tests.*`, `fe.modules.*`) when at least two slots share it.
  const families = new Map();
  for (const id of ids) {
    const segs = id.split('.');
    if (segs.length >= 3) families.set(`${segs[0]}.${segs[1]}`, (families.get(`${segs[0]}.${segs[1]}`) ?? 0) + 1);
  }
  const context = { ids, prefixes, families, appKinds: doc?.appKinds ?? {} };

  for (const slot of slots) slotFinding(file, slot, context, push);
  return findings;
}

/** The suffix-vocabulary findings of one ruleParams profile. */
const profileSuffixFindings = (file, doc, profile, rp, push) => {
  const suffixes = new Set(rp?.suffixes ?? []);
  const banned = new Set(rp?.bannedSuffixes ?? []);
  for (const word of [...banned].sort(byCodeUnit)) {
    if (suffixes.has(word)) push(`${file} ruleParams.${profile}: "${word}" is both a suffix and a bannedSuffix — a role word is declared once`);
  }
  for (const [a, b] of pairsOf(doc?.naming?.refusedPairs)) {
    if (suffixes.has(a) && suffixes.has(b)) push(`${file} ruleParams.${profile}: suffixes holds the refused synonym pair ${a}/${b} — keep one, ban the other`);
  }
  for (const [a, b] of pairsOf(doc?.naming?.sameConceptPairs)) {
    if (!(suffixes.has(a) && suffixes.has(b))) push(`${file} naming.sameConceptPairs: the declared exception ${a}/${b} is not both live in ruleParams.${profile}.suffixes — keep both or drop the pair`);
  }
};

/** The suffix-vocabulary findings of one parsed manifest {file, doc}: disjoint lists, refused pairs, live exceptions. */
export function suffixFindings({ file, doc }) {
  const findings = [];
  const push = (message) => findings.push({ code: CODE, path: file, message });
  for (const [profile, rp] of Object.entries(doc?.ruleParams ?? {})) {
    if (rp?.suffixes === undefined && rp?.bannedSuffixes === undefined) continue;
    profileSuffixFindings(file, doc, profile, rp, push);
  }
  return findings;
}

/** Run SLOT_ID_SHAPE on the manifests under `root`. */
export function checkSlotIdShape(root = skillRoot) {
  const findings = [];
  for (const rel of MANIFESTS) {
    const doc = parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
    const ctx = { file: rel, doc };
    findings.push(...slotIdFindings(ctx), ...suffixFindings(ctx));
  }
  return findings;
}

if (isMain(import.meta.url)) process.exit(printFindings(checkSlotIdShape(), "OK: every slot id follows the manifest's declared grammar and the suffix vocabulary holds no undeclared synonyms."));
