/**
 * v7-14: for record files named on the command line (or every record with a sibling evidence.yaml when
 * none are given), report whether that evidence is currently FRESH by the gate's own definition —
 * recordDigest matches the record's bytes and codeDigest matches the code under its owners — plus whether
 * it carries the stale: true escape valve. A mechanical path fix on a record whose evidence is FRESH would
 * stale a proof another lane just made, so those are reported instead of applied.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';
import {readWorkspace, resolveOwnedDirs, hashOwnedDirs, loadRecords} from '../../../../scripts/example-ownership.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(here, '../../../..');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const TREES = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'];

const cache = new Map();
for (const rel of TREES) {
  const workRoot = path.join(HOST, rel);
  const workspaceDoc = readWorkspace(workRoot);
  const records = loadRecords(workRoot, dir => {
    const out = [];
    const walk = d => fs.readdirSync(d, {withFileTypes: true}).forEach(e => {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '_local') walk(abs); }
      else out.push(abs);
    });
    try { walk(dir); } catch { /* missing */ }
    return out;
  });
  cache.set(rel, {workRoot, workspaceDoc, records});
}

const args = process.argv.slice(2);
const targets = args.length ? args : null;

for (const [, tree] of cache) {
  const {workRoot, workspaceDoc, records} = tree;
  const walkAll = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => {
    const abs = path.join(d, e.name);
    return e.isDirectory() ? (e.name === '_local' ? [] : walkAll(abs)) : [abs];
  });
  for (const file of walkAll(workRoot).filter(f => f.endsWith(path.join('index.yaml')))) {
    const rel = path.relative(HOST, file).replaceAll('\\', '/');
    if (targets && !targets.some(t => rel.endsWith(t.replaceAll('\\', '/')))) continue;
    const ev = path.join(path.dirname(file), 'evidence.yaml');
    if (!fs.existsSync(ev)) continue;
    const rec = parseYaml(fs.readFileSync(file, 'utf8'));
    const evDoc = parseYaml(fs.readFileSync(ev, 'utf8'));
    if (!rec?.id) continue;
    const recordFresh = !!evDoc?.recordDigest && evDoc.recordDigest === sha(file);
    let codeFresh = null;
    if (evDoc?.codeDigest?.digest) {
      const dirs = resolveOwnedDirs(rec.id, {schema: rec.schema, data: rec}, records, workspaceDoc, workRoot);
      codeFresh = (hashOwnedDirs(dirs)?.digest ?? null) === evDoc.codeDigest.digest;
    }
    const verdict = evDoc.stale === true ? 'MARKED_STALE'
      : recordFresh && codeFresh !== false ? 'FRESH'
      : `STALE${!recordFresh ? '(record)' : ''}${codeFresh === false ? '(code)' : ''}`;
    console.log(`${verdict.padEnd(22)}\t${rel}`);
  }
}
