#!/usr/bin/env node
// check-schema-shared.mjs — SCHEMA_SHARED. Two module families carry one sharing mechanism each, and
// this check refuses the duplication that mechanism exists to prevent:
//
//   modules/schemas/work-*.schema.yaml — the shared vocabulary lives once in
//     modules/schemas/work-common.schema.yaml ($id urn:work:common:1) and every use is a
//     {$ref: "urn:work:common:1#/$defs/<name>"} stub. A "block" is a YAML subtree, not a raw text
//     window: a run of `key: / $ref:` lines is the mechanism itself, while a subtree that renders
//     as 5+ lines of minimal YAML and occurs identically in 3+ files is duplication waiting to
//     drift (RT_SCHEMA_NOT_SHARED).
//
//   modules/ops/ops/*.yaml — the shared fragments live once in modules/ops/_common.yaml under
//     `shared:` and a manifest binds them with the `shared` markers mergeOpShared expands
//     (scripts/lib/op-shared.mjs). An entry that still carries every leaf of its named fragment
//     verbatim restates it — `path: shared` would render the identical manifest — and so do a
//     placeholders value or a graphPolicy.location literal equal to the shared one
//     (RT_OP_FIELD_NOT_COMMON). A `purpose`/`content` text leaf restated in 3+ manifests restates
//     the fragment's leaf just the same. A path kept literal beside a shared purpose is the
//     documented marker pattern, not a violation: the merge needs the literal.
//
//   runs in the check stage (self-check schema-shared); --json prints the findings as JSON
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { isMain } from '../lib/is-main.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

const WORK_SCHEMA = /^work-.*\.schema\.yaml$/;
const MIN_LINES = 5;
const MIN_FILES = 3;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The lines a minimal 2-space YAML rendering of `v` spans: one per scalar leaf and per
 *  collection entry. A `{$ref: ...}` stub is one line, so the sharing mechanism never counts. */
const linesOf = (v) => {
  if (isObj(v)) {
    const keys = Object.values(v);
    return keys.length ? keys.reduce((n, x) => n + linesOf(x), 0) : 1;
  }
  if (Array.isArray(v)) return v.length ? v.reduce((n, x) => n + linesOf(x), 0) : 1;
  return 1;
};

/** Every subtree of `doc` that is worth sharing: {signature, lines, trail} of each object/array
 *  node of MIN_LINES or more. */
function* subtrees(node, trail = '') {
  if (node == null || typeof node !== 'object') return;
  if (linesOf(node) >= MIN_LINES) yield { signature: JSON.stringify(node), trail };
  for (const [k, v] of Object.entries(node)) yield* subtrees(v, trail ? `${trail}.${k}` : k);
}

/** frag ⊆ entry, leaf by leaf — true when every leaf the fragment declares is deep-equal in the
 *  entry, which is exactly when the `shared` markers would render the entry unchanged. */
const restates = (frag, entry) => {
  if (isObj(frag) && isObj(entry)) return Object.keys(frag).every((k) => k in entry && restates(frag[k], entry[k]));
  return eq(frag, entry);
};

const byId = (list) => new Map((Array.isArray(list) ? list : [])
  .filter((e) => isObj(e) && e.id != null).map((e) => [String(e.id), e]));

function checkWorkSchemas(root, findings) {
  const dir = path.join(root, 'modules', 'schemas');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => WORK_SCHEMA.test(f)).sort() : [];
  const seen = new Map(); // signature -> {files:Set, trail, lines}
  for (const file of files) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch { continue; } // unreadable YAML is the parse check's finding, not this one's
    const inFile = new Set();
    for (const node of subtrees(doc)) {
      if (inFile.has(node.signature)) continue; // one file stamps a block once
      inFile.add(node.signature);
      let rec = seen.get(node.signature);
      if (!rec) { rec = { files: new Set(), trail: node.trail }; seen.set(node.signature, rec); }
      rec.files.add(file);
    }
  }
  for (const [signature, rec] of seen) {
    if (rec.files.size < MIN_FILES) continue;
    findings.push({
      code: 'RT_SCHEMA_NOT_SHARED',
      path: [...rec.files].sort(byCodeUnit).join(', '),
      message: `the block at ${rec.trail || '(root)'} is identical in ${rec.files.size} work schemas — move it to modules/schemas/work-common.schema.yaml and bind it with a urn:work:common:1#/$defs/<name> $ref: ${signature.slice(0, 120)}`,
    });
  }
}

function checkOpManifests(root, findings) {
  const opsDir = path.join(root, 'modules', 'ops', 'ops');
  const commonFile = path.join(root, 'modules', 'ops', '_common.yaml');
  if (!fs.existsSync(opsDir)) return;
  let shared = {};
  if (fs.existsSync(commonFile)) {
    try { shared = parseYaml(fs.readFileSync(commonFile, 'utf8'))?.shared ?? {}; }
    catch { shared = {}; }
  }
  const leafRestated = new Map(); // `${section}.${id}.${leaf}` -> Set(file)
  for (const file of fs.readdirSync(opsDir).filter((f) => f.endsWith('.yaml')).sort()) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(path.join(opsDir, file), 'utf8')); }
    catch { continue; }
    const rel = `modules/ops/ops/${file}`;
    for (const section of ['reads', 'writes']) {
      const table = byId(shared[section]);
      for (const [i, entry] of (Array.isArray(doc?.[section]) ? doc[section] : []).entries()) {
        if (!isObj(entry) || entry.id == null) continue;
        const frag = table.get(String(entry.id));
        if (!frag) continue;
        const where = `${rel} ${section}[${i}] ${entry.id}`;
        if (restates(frag, entry)) {
          findings.push({ code: 'RT_OP_FIELD_NOT_COMMON', path: rel,
            message: `${where} restates the shared ${section} fragment '${entry.id}' verbatim — mark it (path: shared) so _common.yaml stays the one copy` });
          continue;
        }
        // A text leaf identical to the fragment's, in an entry that carries every fragment key,
        // could be marked `<leaf>: shared` without changing the merged manifest. It counts once
        // it repeats in MIN_FILES manifests, the same bar the schema half applies.
        if (!Object.keys(frag).every((k) => k in entry)) continue;
        for (const field of ['purpose', 'content']) {
          for (const lang of ['en', 'vi']) {
            const leaf = entry[field]?.[lang];
            if (leaf == null || leaf === 'shared' || !eq(leaf, frag[field]?.[lang])) continue;
            const key = `${section}.${entry.id}.${field}.${lang}`;
            if (!leafRestated.has(key)) leafRestated.set(key, new Set());
            leafRestated.get(key).add(rel);
          }
        }
      }
    }
    for (const [k, v] of Object.entries(doc?.placeholders ?? {})) {
      if (v !== 'shared' && k in (shared.placeholders ?? {}) && eq(v, shared.placeholders[k]))
        findings.push({ code: 'RT_OP_FIELD_NOT_COMMON', path: rel,
          message: `${rel} placeholders.${k} restates the shared placeholder verbatim — write ${k}: shared` });
    }
    const loc = doc?.graphPolicy?.location;
    if (loc != null && loc !== 'shared' && shared.graphPolicy?.location != null && eq(loc, shared.graphPolicy.location))
      findings.push({ code: 'RT_OP_FIELD_NOT_COMMON', path: rel,
        message: `${rel} graphPolicy.location restates the shared location verbatim — write location: shared` });
  }
  for (const [key, files] of leafRestated) {
    if (files.size < MIN_FILES) continue;
    findings.push({ code: 'RT_OP_FIELD_NOT_COMMON', path: [...files].sort(byCodeUnit).join(', '),
      message: `${key} is restated literally in ${files.size} op manifests — mark it shared so _common.yaml stays the one copy` });
  }
}

export function checkSchemaShared({ root = skillRoot } = {}) {
  const findings = [];
  checkWorkSchemas(root, findings);
  checkOpManifests(root, findings);
  return { ok: findings.length === 0, findings };
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: check-schema-shared [--json]\n\nRefuses a work-schema block of 5+ lines repeated in 3+ schemas (it belongs in work-common.schema.yaml behind a $ref) and an op field that restates a _common.yaml shared fragment the `shared` markers would render identically. Exit 0 is clean, 1 reports findings.');
    process.exit(0);
  }
  const result = checkSchemaShared();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ schema: 'starci/schema-shared-check@1', ...result }, null, 2));
  else {
    for (const f of result.findings) console.error(`${f.code} ${f.message}`);
    if (result.ok) console.log('OK: no duplicated block survives the work-schema $ref or op shared-marker mechanisms.');
  }
  process.exit(result.ok ? 0 : 1);
}
