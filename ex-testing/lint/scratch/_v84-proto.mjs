// v8-4 scratch: prototype each cross-record rule against the live trees, to count candidates before tiers.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';

const root = path.resolve(process.cwd());
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.resolve(root, p));
const rel = f => path.relative(root, f).replaceAll('\\', '/');
const load = workRoot => {
  const records = new Map();
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const r = path.relative(workRoot, file).replaceAll('\\', '/');
    if (r === '_derived' || r.startsWith('_derived/') || r.endsWith('/evidence.yaml') || r.includes('/assets/')
      || r.includes('/runs/') || r.endsWith('/accounts.yaml')) continue;
    let d; try { d = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!d || typeof d !== 'object' || !d.id) continue;
    records.set(d.id, {id: d.id, schema: d.schema, data: d, dir: path.dirname(file), rel: r, workRoot});
  }
  return records;
};
const bucket = new Map();
const add = (code, rec, msg) => {
  const key = rec.workRoot ? path.basename(path.dirname(rec.workRoot)) + '/' + code : code;
  if (!bucket.has(key)) bucket.set(key, []);
  bucket.get(key).push(`${rec.rel}: ${msg}`);
};

const PROOF_KINDS = new Set(['unit', 'e2e', 'uat', 'perf', 'implementation', 'measurement', 'requirements']);
const inventories = new Map();

for (const workRoot of trees) {
  const records = load(workRoot);
  const tag = path.basename(path.dirname(workRoot));
  inventories.set(tag, records);

  // ---- AC_NAMING_ASYMMETRY ----
  for (const rec of records.values()) {
    if (rec.schema !== 'work/business-rule') continue;
    const names = Array.isArray(rec.data.acceptanceCriteria) ? rec.data.acceptanceCriteria : [];
    const acRoot = path.join(rec.dir, 'ac');
    const acDirs = fs.existsSync(acRoot)
      ? fs.readdirSync(acRoot, {withFileTypes: true}).filter(e => e.isDirectory()).map(e => e.name) : [];
    if (!names.length) add(tag + '/BR_NO_CRITERIA', rec, `acceptanceCriteria is ${JSON.stringify(rec.data.acceptanceCriteria)}`);
    for (const name of names) {
      const expected = rec.id.replace(/^br\./, 'ac.') + '.' + name;
      const dirExists = acDirs.includes(name);
      const byId = records.get(expected);
      if (!dirExists) add(tag + '/AC_ENTRY_NO_DIR', rec, `entry "${name}" dirExists=${dirExists} recordByIdExists=${!!byId} acDirs=[${acDirs.join(',')}] expected=${expected}`);
      else if (!byId) add(tag + '/AC_DIR_NO_RECORD', rec, `ac/${name} exists but no record with id ${expected}`);
      else if (byId.data.rule !== rec.id) add(tag + '/AC_RULE_BACKREF', rec, `ac/${name} rule is ${byId.data.rule}, not ${rec.id}`);
    }
    for (const dirName of acDirs) {
      const expected = rec.id.replace(/^br\./, 'ac.') + '.' + dirName;
      const byId = records.get(expected);
      if (!byId) { add(tag + '/AC_DIR_ID_MISMATCH', rec, `ac/${dirName} has no record whose id is ${expected}`); continue; }
      if (!names.includes(dirName)) add(tag + '/AC_DIR_UNLISTED', rec, `ac/${dirName} (id ${byId.id}, rule ${byId.data.rule}) is not named in acceptanceCriteria [${names.join(',')}]`);
    }
  }

  // ---- PROOF_COVERAGE ----
  for (const rec of records.values()) {
    const demand = rec.data.requiresProof;
    if (!demand || typeof demand !== 'object') {
      if (rec.data.state === 'done') add(tag + '/NO_REQUIRES_PROOF', rec, `${rec.schema} done with no requiresProof`);
      continue;
    }
    for (const [kind, spec] of Object.entries(demand)) {
      if (!PROOF_KINDS.has(kind)) add(tag + '/PROOF_KIND_UNKNOWN', rec, `kind "${kind}"`);
      if (!spec || typeof spec !== 'object') { add(tag + '/PROOF_DEMAND_SHAPE', rec, `${kind}: ${JSON.stringify(spec)}`); continue; }
      if (spec.forEach) {
        const field = spec.forEach;
        const present = rec.data[field];
        add(tag + '/PROOF_FOREACH', rec, `${kind}.forEach=${field} fieldPresent=${present != null} len=${Array.isArray(present) ? present.length : 'n/a'}`);
        if (present == null) add(tag + '/PROOF_FOREACH_DANGLING', rec, `${kind}.forEach names "${field}", which the record does not carry`);
      }
    }
    if (rec.schema === 'work/functional-requirement' && rec.data.state === 'done') {
      const composes = Array.isArray(rec.data.composes) ? rec.data.composes : [];
      const unit = demand.unit;
      add(tag + '/FR_DONE_UNIT_FOREACH', rec, `composes=${composes.length} unit=${JSON.stringify(unit ?? null)} e2e=${!!demand.e2e} uat=${!!demand.uat}`);
    }
  }

  // ---- CONFLICT_WITHOUT_DECISION ----
  for (const rec of records.values()) {
    for (const edge of Array.isArray(rec.data.conflictsWith) ? rec.data.conflictsWith : []) {
      const other = records.get(edge?.record);
      const pair = [rec.id, edge?.record].sort().join(' + ');
      const resolvers = [...records.values()].filter(d => d.schema === 'work/policy-decision'
        && (Array.isArray(d.data.tension?.records) ? d.data.tension.records : []).includes(rec.id)
        && (Array.isArray(d.data.tension?.records) ? d.data.tension.records : []).includes(edge?.record));
      add(tag + '/CONFLICT_EDGE', rec, `${pair}: src=${rec.data.state} other=${other?.data?.state ?? '(missing)'} resolvers=[${resolvers.map(r => `${r.id}/${r.data.outcome}/${r.data.state}`).join(',') || 'none'}]`);
    }
  }

  // ---- PROVES_ASYMMETRY ----
  for (const rec of records.values()) {
    for (const targetId of Array.isArray(rec.data.proves) ? rec.data.proves : []) {
      const target = records.get(targetId);
      add(tag + '/PROVES_EDGE', rec, `${rec.id}(${rec.data.state}) proves ${targetId}(${target?.data?.state ?? '(missing)'}, ${target?.schema ?? '?'})`);
    }
  }

  // ---- CATALOG_DIRTY ----
  const catalogFile = path.join(workRoot, 'index.yaml');
  const catalog = parseYaml(fs.readFileSync(catalogFile, 'utf8'));
  for (const entry of catalog.features ?? []) {
    const featureFile = path.join(workRoot, entry.directory ?? '', 'index.yaml');
    const feature = fs.existsSync(featureFile) ? parseYaml(fs.readFileSync(featureFile, 'utf8')) : null;
    add(tag + '/CATALOG', {workRoot, rel: rel(catalogFile), id: catalog.id},
      `entry ${entry.id}: recordExists=${!!feature} idAgrees=${feature?.id === entry.id} titleAgreesWithDescription=${feature?.title === entry.description} descAgrees=${feature?.description === entry.description} entryKeys=[${Object.keys(entry)}]`);
  }
  for (const [id, rec] of records) if (rec.schema === 'work/feature' && !(catalog.features ?? []).some(e => e.id === id)) add(tag + '/FEATURE_NOT_IN_CATALOG', rec, 'no catalog entry');

  // ---- GAP closure ----
  for (const rec of records.values()) {
    if (rec.schema !== 'work/gap') continue;
    const closers = rec.data.closedBy == null ? null : Array.isArray(rec.data.closedBy) ? rec.data.closedBy : [rec.data.closedBy];
    add(tag + '/GAP', rec, `state=${rec.data.state} closedBy=${JSON.stringify(closers)} allDone=${closers ? closers.every(c => records.get(c)?.data.state === 'done') : 'n/a'}`);
  }

  // ---- field/schema inventory for parity ----
  const inv = new Map();
  for (const rec of records.values()) {
    for (const key of Object.keys(rec.data)) {
      const k = `${rec.schema}.${key}`;
      inv.set(k, (inv.get(k) ?? 0) + 1);
    }
    inv.set(`schema:${rec.schema}`, (inv.get(`schema:${rec.schema}`) ?? 0) + 1);
  }
  inventories.set(tag + ':inv', inv);
}

console.log('===== candidate buckets =====');
for (const [key, lines] of [...bucket.entries()].sort()) {
  console.log(`\n-- ${key}: ${lines.length}`);
  for (const l of lines.slice(0, 6)) console.log('   ' + l);
}

console.log('\n===== DUAL_TREE_PARITY vocabulary =====');
const [todoInv, ecInv] = [inventories.get('todo-app-backend:inv'), inventories.get('ecommerce-app-be:inv')];
const only = (a, b) => [...a.keys()].filter(k => !b.has(k)).sort();
console.log('todo-be only: ' + only(todoInv, ecInv).join(', '));
console.log('\nec-be only: ' + only(ecInv, todoInv).join(', '));
