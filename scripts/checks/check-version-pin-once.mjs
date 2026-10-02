#!/usr/bin/env node
// check-version-pin-once.mjs — VERSION_PIN_ONCE (R210, RT_VERSION_RESTATED; part of `npm run check`).
//   node scripts/checks/check-version-pin-once.mjs [--json]
//
// knowledge/hfs/canon-pins.yaml owns the version of every @starci package and every canon-pinned
// dependency; a product's package.json files are the declared install sites. Anywhere else, a semver
// literal equal to a pin — or a `name@x.y.z` specifier — restates it, UNLESS the literal sits on a
// DECLARED BINDING key: the `version:` keys the refreshers own and rewrite in place:
//   canon.version        — modules/models/code-patterns.yaml profile bindings, held to the pin by
//                          check-canon-pins.mjs CANON_BINDING_VERSION;
//   provenance.version,
//   identity.version     — knowledge/grammars/*/ snapshot headers, rewritten by
//                          scripts/work/ui/grammar-knowledge.mjs --write (withVersion).
// A restatement is fixed by naming the pin, never the literal: "the pinned @starci/grammar",
// "(the pinned pair)", "knowledge/hfs/canon-pins.yaml" — the check then finds nothing to repeat.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';

export const CODE = 'RT_VERSION_RESTATED';
export const PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
/** The `version:` leaf is a declared binding when its enclosing YAML block is one of these keys. */
export const BINDING_KEYS = Object.freeze(['canon', 'provenance', 'identity']);

const EXT = /\.(?:mjs|cjs|js|ts|tsx|yaml|yml|md|json|cmd|ps1|sh|toml)$/;
const OUT = /node_modules\/|(?:^|\/)package\.json$|(?:^|\/)package-lock\.json$|(?:^|\/)pnpm-lock\.yaml$|(?:^|\/)yarn\.lock$|CHANGELOG|packages\/[^/]+\/runtime\/|^tests\/|\.spec\.|\.starciwork\/|modules\/kernel\/contract-changes\//;
const inScope = (rel) => EXT.test(rel) && rel !== PINS_FILE && !OUT.test(rel);

const SEMVER = /\d+\.\d+\.\d+/g;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WINDOW = 4;

/** pin name → version for every pin in the canon-pins document. */
export function pinsOf(pinsDoc) {
  const pins = new Map();
  for (const [name, entry] of Object.entries(pinsDoc?.pins ?? {})) {
    if (/^\d+\.\d+\.\d+$/.test(String(entry?.version ?? ''))) pins.set(name, String(entry.version));
  }
  return pins;
}

/** True when lines[i] is a `version:` leaf nested directly under a binding key (canon/provenance/identity). */
export function isBindingLeaf(lines, i) {
  const line = lines[i];
  const inline = /^(\s*)([A-Za-z_][\w-]*)\s*:\s*\{[^}]*\bversion\s*:/.exec(line);
  if (inline && BINDING_KEYS.includes(inline[2])) return true; // `canon: {..., version: x}` — the inline binding form
  const head = /^(\s*)(?:-\s+)?([A-Za-z_][\w-]*)\s*:/.exec(line);
  if (!head || head[2] !== 'version') return false;
  const indent = head[1].length;
  for (let j = i - 1; j >= 0; j -= 1) {
    const m = /^(\s*)([A-Za-z_][\w-]*)\s*:/.exec(lines[j]);
    if (m && m[1].length < indent) return BINDING_KEYS.includes(m[2]);
  }
  return false;
}

/**
 * The VERSION_PIN_ONCE findings over {rel: text}: [{code, path, message}].
 * A semver literal equal to pin P's version restates the pin when P's name appears within WINDOW
 * lines of it (the `name@x.y.z` specifier form included) — unless the literal is a binding leaf.
 */
export function versionPinFindings(files, pins) {
  const findings = [];
  const names = [...pins.keys()];
  const nameRe = new RegExp(String.raw`(?<![w@/-])(?:${names.map(escRe).join('|')})(?![w-])`, 'g');
  for (const [rel, text] of Object.entries(files)) {
    if (!inScope(rel)) continue;
    const lines = text.split('\n');
    const push = (i, name, ver) => findings.push({ code: CODE, path: `${rel}:${i + 1}`, message: `${rel}:${i + 1} restates the ${name}@${ver} pin — name the pin (canon-pins.yaml), not the version literal` });
    for (let i = 0; i < lines.length; i += 1) {
      for (const m of lines[i].matchAll(SEMVER)) {
        const ver = m[0];
        const window = lines.slice(Math.max(0, i - WINDOW), Math.min(lines.length, i + WINDOW + 1)).join('\n');
        for (const nm of window.matchAll(nameRe)) {
          if (pins.get(nm[0]) !== ver) continue;
          if (isBindingLeaf(lines, i)) break;
          push(i, nm[0], ver);
          break;
        }
      }
    }
  }
  return findings;
}

/** Run VERSION_PIN_ONCE on the runtime at `root`. */
export function checkVersionPinOnce(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  const pins = pinsOf(parseYaml(fs.readFileSync(path.join(root, PINS_FILE), 'utf8')));
  const files = {};
  for (const rel of tracked) {
    if (!inScope(rel)) continue;
    try { files[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* a lane may hold an uncommitted deletion */ }
  }
  return versionPinFindings(files, pins);
}

if (isMain(import.meta.url)) {
  const findings = checkVersionPinOnce();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(`OK: every pinned version is spelled once, in canon-pins.yaml.`);
  }
  process.exit(findings.length ? 1 : 0);
}
