#!/usr/bin/env node
// check-layers.mjs — the runtime's own source is layered (modules/kernel/runtime-layers.yaml; docs/runtime-layers.md).
// Part of `npm run check`.
//
//   RT_LAYER_EXTERNAL_SPAWN     a child process of an external system's program (git, npm/npx, orca, sonar, docker...)
//                               started outside that system's home, scripts/api/<system>/
//   RT_LAYER_LIB_CHILD_PROCESS  a module under scripts/lib imports child_process (scripts/lib starts nothing)
//   RT_LAYER_SPAWN_UNRESOLVED   outside scripts/api/, a spawn whose program the AST cannot name
//   RT_LAYER_ALLOW_STALE        a runtime-layers.allow.yaml entry no finding matches (the exception is gone: delete it)
//   RT_LAYER_RULES_INVALID      the rule set or its allowlist is malformed (an entry without a reason, an unknown code)
//
// Every .mjs/.cjs/.js/.ts under the rule set's scan roots is parsed with the TypeScript AST (scripts/lib/spawn-calls.mjs);
// no text is grepped. node_modules and the packages' bundled runtime copies are not scanned.
//
//   node scripts/checks/check-layers.mjs [--root <tree>] [--json]
// Exit 0 clean, 1 findings.
import fs from 'node:fs';
import path from 'node:path';
import { spawnCalls } from '../lib/spawn-calls.mjs';
import { sameOrUnder } from '../lib/path-key.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from './common.mjs';

export const RULES_FILE = 'modules/kernel/runtime-layers.yaml';
export const CODES = Object.freeze({
  external: 'RT_LAYER_EXTERNAL_SPAWN',
  lib: 'RT_LAYER_LIB_CHILD_PROCESS',
  unresolved: 'RT_LAYER_SPAWN_UNRESOLVED',
  stale: 'RT_LAYER_ALLOW_STALE',
  invalid: 'RT_LAYER_RULES_INVALID',
});
const ALLOWABLE = new Set([CODES.external, CODES.lib, CODES.unresolved]);
const SOURCE = /\.(?:mjs|cjs|js|ts)$/;

/** The rule set and its allowlist read from `root`: {rules, allow (the valid entries), problems}. An invalid entry allows nothing. */
export function readRules(root = skillRoot) {
  const problems = [];
  const read = (rel) => { try { return parseYaml(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (error) { problems.push(`${rel}: ${String(error?.message ?? error).slice(0, 200)}`); return null; } };
  const rules = read(RULES_FILE) ?? {};
  for (const key of ['scan', 'systems', 'layers']) if (!Array.isArray(rules[key])) problems.push(`${RULES_FILE}: ${key} is not a list`);
  for (const s of rules.systems ?? []) if (!s?.id || !s?.home || !Array.isArray(s?.programs) || !s.programs.length) problems.push(`${RULES_FILE}: system ${JSON.stringify(s)} needs id, home and programs`);
  const allowDoc = rules.allowlist ? read(rules.allowlist) : null;
  const listed = Array.isArray(allowDoc?.entries) ? allowDoc.entries : [];
  const allow = [];
  for (const e of listed) {
    const valid = Boolean(e?.path) && ALLOWABLE.has(e?.code) && Boolean(String(e?.reason ?? '').trim()) && (e?.code !== CODES.external || Boolean(e?.system));
    if (valid) allow.push(e);
    if (!e?.path || !ALLOWABLE.has(e?.code) || !String(e?.reason ?? '').trim()) problems.push(`${rules.allowlist}: entry ${JSON.stringify(e)} needs path, a code (${[...ALLOWABLE].join(', ')}) and a reason`);
    if (e?.code === CODES.external && !e?.system) problems.push(`${rules.allowlist}: entry ${e.path} ${e.code} names no system`);
  }
  return { rules, allow, problems };
}

/**
 * The findings of one source file (repo-relative `rel`, its `text`) under `rules`. Pure.
 * [{code, path, line, system?, program?, message}]
 */
export function fileFindings(rel, text, rules) {
  const found = [];
  const { imports, calls } = spawnCalls(text, rel);
  for (const layer of rules.layers ?? []) {
    if (layer.forbid === 'child_process' && sameOrUnder(rel, layer.path))
      for (const i of imports) found.push({ code: CODES.lib, path: rel, line: i.line, message: `${layer.path} imports ${i.module}: it starts nothing - move the call into scripts/api/<system>/ and import that` });
  }
  const inApi = sameOrUnder(rel, rules.apiRoot ?? 'scripts/api');
  for (const call of calls) {
    for (const program of call.programs) {
      const system = (rules.systems ?? []).find((s) => s.programs.includes(program));
      if (system && !sameOrUnder(rel, system.home))
        found.push({ code: CODES.external, path: rel, line: call.line, system: system.id, program, message: `${call.callee}() starts ${program} outside ${system.home}/ - call the ${system.id} api there` });
    }
    if (!inApi && !call.resolved && !call.passThrough)
      found.push({ code: CODES.unresolved, path: rel, line: call.line, message: `${call.callee}() starts a program the AST cannot name - name it, move the call into scripts/api/<system>/, or record a reviewed exception` });
  }
  return found;
}

const allowKey = (f) => `${f.path}\0${f.code}\0${f.code === CODES.external ? f.system : ''}`;

/** Every source file under the scan roots (repo-relative, forward slashes). */
function sourcesOf(root, scan) {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules') continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.isFile() && SOURCE.test(e.name)) out.push(rel);
    }
  };
  for (const dir of scan) walk(dir);
  return out.sort();
}

/** {ok, findings, allowed, files} over the tree at `root`. */
export function checkLayers(root = skillRoot) {
  const { rules, allow, problems } = readRules(root);
  const findings = problems.map((message) => ({ code: CODES.invalid, path: RULES_FILE, line: 1, message }));
  const raw = [];
  const files = sourcesOf(root, rules.scan ?? []);
  for (const rel of files) raw.push(...fileFindings(rel, fs.readFileSync(path.join(root, rel), 'utf8'), rules));
  const keys = new Map(allow.map((e) => [allowKey({ path: e.path, code: e.code, system: e.system }), e]));
  const used = new Set();
  const allowed = [];
  for (const f of raw) {
    const k = allowKey(f);
    if (keys.has(k)) { used.add(k); allowed.push({ ...f, reason: keys.get(k).reason, lane: keys.get(k).lane ?? null }); } else findings.push(f);
  }
  for (const [k, e] of keys) if (!used.has(k)) findings.push({ code: CODES.stale, path: rules.allowlist, line: 1, message: `the entry ${e.path} ${e.code}${e.system ? ` ${e.system}` : ''} matches no finding: delete it` });
  return { ok: findings.length === 0, findings, allowed, files: files.length };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--root');
  const result = checkLayers(at >= 0 ? path.resolve(argv[at + 1]) : skillRoot);
  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const f of result.findings) console.error(`${f.code} ${f.path}:${f.line} ${f.message}`);
    if (result.ok) console.log(`OK: check-layers - ${result.files} files, external systems spawned only from scripts/api/<system>/, scripts/lib starts nothing (${result.allowed.length} allowlisted finding(s)).`);
  }
  process.exit(result.ok ? 0 : 1);
}
