#!/usr/bin/env node
/**
 * v11-4 — run-folder consolidation audit/fix.
 *
 * Canonical settled-run set per the lane brief: {manifest.yaml, result.md, screens/, videos/}.
 * Everything else in runs/<id>/ is a stray: *.json sidecars and *.md/*.txt notes are folded into
 * manifest.yaml under `files:` keyed by their original filename (so prose references like
 * "cleanup.json's triplet" still resolve, now to a manifest section instead of a loose file).
 * Unrecognized stray kinds are reported, not moved.
 *
 * Usage:
 *   node _v114-consolidate.mjs           # audit only
 *   node _v114-consolidate.mjs --apply   # fold strays into manifests and delete them
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml, stringifyYaml} from '../../../core/yaml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TREES = [
  'examples/todo-app-backend/.starciwork',
  'examples/ecommerce-app-be/.starciwork',
];
const CANON = new Set(['manifest.yaml', 'result.md', 'screens', 'videos']);
const apply = process.argv.includes('--apply');

const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const rel = p => slash(path.relative(root, p));
const slash = p => p.replaceAll('\\', '/');

const report = {runs: [], evidence: [], problems: []};
let moved = 0, deleted = 0;

for (const tree of TREES) {
  const workRoot = path.join(root, tree);
  if (!fs.existsSync(workRoot)) { report.problems.push(`tree missing: ${tree}`); continue; }

  // ---- runs/<id>/ layout ----
  const runDirs = walk(workRoot).filter(f => path.basename(f) === 'manifest.yaml' && slash(f).includes('/runs/'));
  for (const manifestFile of runDirs) {
    const runDir = path.dirname(manifestFile);
    const runRel = rel(runDir);
    const entries = fs.readdirSync(runDir, {withFileTypes: true});
    const names = entries.map(e => e.name);
    const missing = ['manifest.yaml', 'result.md', 'screens', 'videos']
      .filter(n => !entries.some(e => e.name === n && (n.includes('.') ? e.isFile() : e.isDirectory())));
    const strays = entries.filter(e => !CANON.has(e.name));
    const rec = {run: runRel, missing, moved: [], reported: []};

    if (strays.length) {
      let doc;
      try { doc = parseYaml(fs.readFileSync(manifestFile, 'utf8')); }
      catch (err) { report.problems.push(`${runRel}: manifest.yaml does not parse: ${err.message}`); doc = null; }
      if (doc) {
        doc.files = doc.files && typeof doc.files === 'object' ? doc.files : {};
        for (const stray of strays) {
          const fp = path.join(runDir, stray.name);
          if (stray.isDirectory()) { rec.reported.push(`${stray.name}/ (directory)`); continue; }
          if (stray.name.endsWith('.json')) {
            try { doc.files[stray.name] = JSON.parse(fs.readFileSync(fp, 'utf8')); }
            catch (err) { rec.reported.push(`${stray.name} (unparseable json: ${err.message})`); continue; }
          } else if (stray.name.endsWith('.md') || stray.name.endsWith('.txt')) {
            doc.files[stray.name] = fs.readFileSync(fp, 'utf8');
          } else {
            rec.reported.push(`${stray.name} (unrecognized kind)`); continue;
          }
          rec.moved.push(stray.name);
        }
        if (apply && rec.moved.length) {
          fs.writeFileSync(manifestFile, stringifyYaml(doc));
          moved++;
          for (const name of rec.moved) { fs.unlinkSync(path.join(runDir, name)); deleted++; }
        }
      }
    }
    report.runs.push(rec);
  }

  // ---- evidence.yaml run links ----
  for (const file of walk(workRoot).filter(f => f.endsWith('evidence.yaml'))) {
    let doc;
    try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    const runRef = doc && typeof doc.run === 'string' ? doc.run.trim() : null;
    const entry = {evidence: rel(file), record: doc?.record ?? null, run: runRef, exists: null, assetGhosts: []};
    if (runRef) {
      const runDir = path.resolve(path.dirname(file), runRef);
      entry.exists = fs.existsSync(runDir) && fs.lstatSync(runDir).isDirectory();
      if (entry.exists) {
        for (const a of Array.isArray(doc.assets) ? doc.assets : []) {
          if (a && typeof a.path === 'string' && !fs.existsSync(path.resolve(path.dirname(file), a.path)))
            entry.assetGhosts.push(a.path);
        }
      }
    }
    report.evidence.push(entry);
  }
}

// ---- print ----
const allRuns = report.runs;
const withStrays = allRuns.filter(r => r.moved.length || r.reported.length);
const missingCanon = allRuns.filter(r => r.missing.length);
console.log(`runs audited: ${allRuns.length}`);
for (const r of allRuns) {
  const bits = [];
  if (r.missing.length) bits.push(`MISSING: ${r.missing.join(',')}`);
  if (r.moved.length) bits.push(`${apply ? 'folded' : 'strays'}: ${r.moved.join(',')}`);
  if (r.reported.length) bits.push(`REPORTED: ${r.reported.join(',')}`);
  console.log(`  ${r.run}${bits.length ? '  — ' + bits.join(' | ') : '  — clean'}`);
}
console.log(`runs with strays: ${withStrays.length}; runs missing canonical entries: ${missingCanon.length}`);
if (apply) console.log(`manifests rewritten: ${moved}; stray files deleted: ${deleted}`);
console.log(`evidence.yaml files: ${report.evidence.length}`);
let bad = 0;
for (const e of report.evidence) {
  if (e.run == null) continue;
  const ok = e.exists && !e.assetGhosts.length;
  if (!ok) bad++;
  console.log(`  ${e.evidence}  run=${e.run}  ${e.exists ? 'exists' : 'MISSING'}${e.assetGhosts.length ? '  asset-ghosts: ' + e.assetGhosts.join(',') : ''}`);
}
console.log(`evidence->run links broken: ${bad}`);
if (report.problems.length) { console.log('PROBLEMS:'); for (const p of report.problems) console.log(`  ${p}`); }
