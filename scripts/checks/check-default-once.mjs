#!/usr/bin/env node
// check-default-once.mjs — DEFAULT_ONCE (R209, RT_CONFIG_DEFAULT_TWICE; part of `npm run check`).
//   node scripts/checks/check-default-once.mjs [--json]
//
// A default for a key that config.example.yaml documents is stated once, by its owner, and every other reader
// asks the owner. The owners today:
//   - scripts/machine/home.mjs — DEFAULTS (workers base/max, landGate.mode, frozenMinutes, pollIntervalMs) and
//     DEFAULT_OWNER_LANGUAGE; supervisorSettings() is the derived reader for all of them, and
//     scripts/lib/i18n.mjs ownerLanguage() is the language accessor over it;
//   - engine/config.mjs — CONNECTOR_DEFAULTS, ASKS_DEFAULTS, UAT_DEFAULTS, SPEC_DEFAULTS,
//     DEFAULT_ALLOCATION_WINDOW_HOURS, the kernel/model pin validation;
//   - engine/orca-config.mjs — ORCA_DEFAULTS (maxWorkerDepth);
//   - scripts/reconciler/state.mjs — configuredMode() owns the controller-mode 'off' default.
// The keys are derived by parsing config.example.yaml (documented leaf names and their documented scalar
// values) and the owner files (the values DEFAULTS/DEFAULT_OWNER_LANGUAGE declare — never restated here).
// This check refuses, in a second file than the owner:
//   - `<key> ??|(|||=) <literal>` where key is a camelCase leaf the example documents (any literal restates the
//     absent-or-default meaning: pollIntervalMs, frozenMinutes, windowHours, maxConcurrent, maxWorkerDepth,
//     worktreeLimit, maxOps, secretsFile, tokenEnv, ...);
//   - the same fallback where key is a lowercase documented leaf and the literal is a value the example or the
//     owner declares for it (mode ?? 'off'/'shared'/'chat', effort ?? 'high', interval ?? '10m',
//     policy ?? 'balanced', profile ?? 'operational', gear ?? 1, port ?? <gateway port>, model/agent picks);
//   - a language fallback restated — `language|lang|owner_language ??/= 'en'|'vi'` anywhere in the fallback
//     chain, and the `language === 'en' ? 'en' : 'vi'` ternary that re-derives the owner language inline;
//     the owner value is DEFAULT_OWNER_LANGUAGE ('en' last resort) and ownerLanguage() (the configured value).
// Scope: tracked source (.mjs/.cjs/.js/.ts/.tsx) under scripts/, engine/, ui/ (minus dist), ext/ and packages/
// (minus generated runtime and specs). Specs/tests are out of scope — a spec spells whatever literal it wants.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';

export const CODE = 'RT_CONFIG_DEFAULT_TWICE';
export const EXAMPLE_FILE = 'config.example.yaml';
export const OWNER_FILES = Object.freeze([
  'scripts/machine/home.mjs', 'engine/config.mjs', 'engine/orca-config.mjs',
  'scripts/reconciler/state.mjs', EXAMPLE_FILE,
  'scripts/checks/check-default-once.mjs', 'tests/checks/check-default-once.spec.mjs',
]);

const SCOPE = /^(?:scripts|engine|ui|ext|packages)\//;
const CODE_EXT = /\.(?:mjs|cjs|js|ts|tsx)$/;
const OUT = /node_modules\/|\/dist\/|^packages\/[^/]+\/runtime\/|^tests\/|\.spec\.|\.starciwork\/|\.stories\.|^packages\/hfs\/templates\//;
// packages/hfs/templates are product seeds and *.stories.* are component demos: the literals they carry are the
// product's own defaults, not the runtime config's keys restated.
const inScope = (rel) => SCOPE.test(rel) && CODE_EXT.test(rel) && !OUT.test(rel) && !OWNER_FILES.includes(rel);

const LANGUAGE_KEYS = ['language', 'lang', 'owner_language', 'ownerLanguage'];
const LANG_RE = String.raw`(?:language|lang|owner_language|ownerLanguage)`;
const ASSIGN = String.raw`(?<![=!<>])=(?![=>])`; // `=` that is not ==/===/=>/</>/<=
/** `language|lang === 'en' ? 'en' : 'vi'` — the owner language re-derived inline. */
const LANGUAGE_TERNARY = new RegExp(String.raw`\b${LANG_RE}\b[^;\n]{0,40}?===\s*['"](en|vi)['"]\s*\?\s*['"]\1['"]\s*:\s*['"](en|vi)['"]`, 'g');
/** `<language key> ... ?? 'en'|'vi'` — a language literal anywhere in a fallback chain headed by a language key. */
const LANGUAGE_CHAIN = new RegExp(String.raw`\b${LANG_RE}\b(?:[^;\n]*?(?:\?\?|\|\||${ASSIGN}))+\s*['"](en|vi)['"]`, 'g');

/** The leaf name → documented scalar values of a parsed config document (objects/arrays/null contribute none). */
export function documentedLeaves(doc) {
  const leaves = new Map();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const v of node) walk(v); return; } // element indices are not key names
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') walk(v);
      else if (typeof v === 'string' || typeof v === 'number') (leaves.get(k) ?? leaves.set(k, new Set()).get(k)).add(String(v));
      else leaves.set(k, leaves.get(k) ?? new Set()); // null/false leaves: documented key, no literal vocabulary
    }
  };
  walk(doc);
  return leaves;
}

/** Leaf names the example documents only in comments (`# mode: chat`, `# workers: {base, max}`, `# frozenMinutes: <n>`). */
export function commentedLeaves(exampleText) {
  const leaves = new Map();
  for (const line of exampleText.split('\n')) {
    if (!/^\s*#/.test(line)) continue;
    for (const m of line.matchAll(/\b([a-z][\w]*)\s*:\s*([a-z][\w]*(?:\|[a-z][\w]*)*)/g))
      for (const v of m[2].split('|')) (leaves.get(m[1]) ?? leaves.set(m[1], new Set()).get(m[1])).add(v);
    for (const m of line.matchAll(/\{([^}]*)\}/g))
      for (const name of m[1].split(',').map((s) => s.trim()).filter((s) => /^[a-zA-Z][\w]*$/.test(s)))
        leaves.set(name, leaves.get(name) ?? new Set()); // `{base, max}` names leaves with no literal
    const keyed = /^[\s#]*([a-z][\w]*)\s*:/.exec(line)?.[1];
    if (keyed) leaves.set(keyed, leaves.get(keyed) ?? new Set()); // `# frozenMinutes: <n>` documents the key
  }
  return leaves;
}

/** The literal values scripts/machine/home.mjs declares (DEFAULTS block + DEFAULT_OWNER_LANGUAGE). */
export function ownerDefaults(homeText) {
  const defaults = /DEFAULTS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)\)/.exec(homeText)?.[1] ?? '';
  const values = new Map();
  for (const m of defaults.matchAll(/\b([a-zA-Z][\w]*)\s*:\s*([\d_]+|'[^']*')/g))
    (values.get(m[1]) ?? values.set(m[1], new Set()).get(m[1])).add(m[2].replace(/'/g, '').replace(/_/g, ''));
  const lang = /DEFAULT_OWNER_LANGUAGE\s*=\s*'([^']+)'/.exec(homeText)?.[1];
  return { values, language: lang ?? null };
}

// A restated default is a literal: a quoted string or a number. A bare word on the right is an identifier —
// `key ?? OWNER_CONST` is exactly the compliant read, not a restatement.
const LITERAL = String.raw`(?:['"]([^'"]+)['"]|(\d[\d_]*))`;
const FALLBACK = String.raw`(?:\?\?|\|\||${ASSIGN})`;

/**
 * The DEFAULT_ONCE findings over {rel: text}: [{code, path, message}].
 * `leaves` is the documentedLeaves() map; `ownerValues` the ownerDefaults().values map.
 */
export function defaultOnceFindings(files, { leaves, ownerValues = new Map(), ownerLanguage = 'en' } = {}) {
  const findings = [];
  const langValues = new Set(['en', 'vi', ...(ownerLanguage ? [ownerLanguage] : [])]);
  for (const [rel, text] of Object.entries(files)) {
    if (!inScope(rel)) continue;
    const push = (key, literal) => findings.push({ code: CODE, path: rel, message: `${rel} restates the default ${key}=${literal} — read it through the owner (scripts/machine/home.mjs / engine config) instead` });
    for (const m of text.matchAll(LANGUAGE_TERNARY)) push('language', `'${m[1]}' ? '${m[1]}' : '${m[2]}'`);
    for (const m of text.matchAll(LANGUAGE_CHAIN)) {
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      if (/<[a-zA-Z!][^<>]*$/.test(text.slice(lineStart, m.index))) continue; // a markup attribute (html lang="en"), not a config default
      if (langValues.has(m[1])) push('language', m[1]);
    }
    for (const [leaf, docValues] of leaves) {
      if (LANGUAGE_KEYS.includes(leaf)) continue;
      const distinctive = /[A-Z]/.test(leaf); // camelCase leaf names are config keys by shape; lowercase ones gate on vocabulary
      const values = new Set([...(docValues ?? []), ...(ownerValues.get(leaf) ?? [])]);
      if (!distinctive && !values.size) continue;
      const re = new RegExp(String.raw`\b${leaf}\b\s*${FALLBACK}\s*${LITERAL}`, 'g');
      for (const m of text.matchAll(re)) {
        const literal = m[1] ?? m[2]?.replace(/_/g, '');
        if (!distinctive && !values.has(literal)) continue;
        push(leaf, literal);
      }
    }
  }
  return findings;
}

/** Run DEFAULT_ONCE on the runtime at `root`. */
export function checkDefaultOnce(root = skillRoot) {
  const tracked = gitOutputOf(lsFiles(['-z'], { dir: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean);
  const files = {};
  for (const rel of tracked) {
    if (!inScope(rel)) continue;
    try { files[rel] = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { /* a lane may hold an uncommitted deletion */ }
  }
  const exampleText = fs.readFileSync(path.join(root, EXAMPLE_FILE), 'utf8');
  const doc = parseYaml(exampleText);
  const leaves = documentedLeaves(doc);
  for (const [leaf, vals] of commentedLeaves(exampleText)) {
    const set = leaves.get(leaf) ?? leaves.set(leaf, new Set()).get(leaf);
    for (const v of vals) set.add(v);
  }
  const home = fs.readFileSync(path.join(root, 'scripts/machine/home.mjs'), 'utf8');
  const { values, language } = ownerDefaults(home);
  return defaultOnceFindings(files, { leaves, ownerValues: values, ownerLanguage: language });
}

if (isMain(import.meta.url)) {
  const findings = checkDefaultOnce();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.message}`);
    if (!findings.length) console.log(`OK: every documented default is read through its owner.`);
  }
  process.exit(findings.length ? 1 : 0);
}
