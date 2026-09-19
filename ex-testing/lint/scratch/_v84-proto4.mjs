// v8-4 scratch: measure the remaining candidate rules so tiers can be set on counts, not guesses.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';
import {loadRecords} from '../../../scripts/example-ownership.mjs';

const root = path.resolve(process.cwd());
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.resolve(root, p));
const DEMAND_SCHEMAS = new Set(['work/functional-requirement', 'work/non-functional-requirement', 'work/customer-journey', 'work/sds-component', 'work/contract', 'work/integration']);

const dig = (obj, dotted) => dotted.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
const tally = new Map();
const note = (key, line) => { if (!tally.has(key)) tally.set(key, []); tally.get(key).push(line); };

const loaded = trees.map(workRoot => ({workRoot, records: loadRecords(workRoot, walk)}));

for (const {workRoot, records} of loaded) {
  const tag = path.basename(path.dirname(workRoot));
  const proversOf = new Map(); // targetId -> [{id, schema, state}]
  for (const [id, rec] of records) {
    for (const t of Array.isArray(rec.data.proves) ? rec.data.proves : []) {
      if (!proversOf.has(t)) proversOf.set(t, []);
      proversOf.get(t).push({id, schema: rec.schema, state: rec.data.state});
    }
  }

  for (const [id, rec] of records) {
    const d = rec.data;
    // ---- proof coverage ----
    if (DEMAND_SCHEMAS.has(rec.schema) && d.state === 'done' && !d.requiresProof) note('THIN', `${tag} ${id}`);
    if (rec.schema === 'work/functional-requirement' && d.state === 'done') {
      const composes = Array.isArray(d.composes) ? d.composes : [];
      const demand = d.requiresProof ?? {};
      if (composes.length && !demand.unit) note('FR_NO_UNIT', `${tag} ${id} composes=${composes.length}`);
      if (composes.length >= 2 && demand.unit && !demand.unit.forEach) note('FR_UNIT_NO_FOREACH', `${tag} ${id} composes=${composes.length}`);
      if (!demand.e2e) note('FR_NO_E2E', `${tag} ${id} composes=${composes.length} unit=${JSON.stringify(demand.unit ?? null)}`);
      if (demand.uat?.required) {
        const provers = (proversOf.get(id) ?? []).filter(p => p.schema === 'work/uat-flow');
        if (!provers.length) note('FR_UAT_UNCLAIMED', `${tag} ${id}`);
        else if (!provers.some(p => p.state === 'done')) note('FR_UAT_CLAIMED_NOTDONE', `${tag} ${id} by ${provers.map(p => p.id + '/' + p.state).join(',')}`);
      }
    }
    if (rec.schema === 'work/sds-component' && d.state === 'done' && d.requiresProof?.implementation?.required) {
      const provers = (proversOf.get(id) ?? []).filter(p => p.schema === 'work/implementation');
      if (!provers.length) note('SDS_IMPL_UNCLAIMED', `${tag} ${id}`);
    }
    for (const [kind, spec] of Object.entries(d.requiresProof ?? {})) {
      if (!spec || typeof spec !== 'object' || !spec.forEach) continue;
      const value = dig(d, spec.forEach);
      if (value == null) note('FOREACH_DANGLING', `${tag} ${id} ${kind}.forEach=${spec.forEach}`);
      else note('FOREACH_OK', `${tag} ${id} ${kind}.forEach=${spec.forEach} ${Array.isArray(value) ? `len=${value.length}` : typeof value}`);
    }
    if (rec.schema === 'work/customer-journey' && d.state === 'done') {
      const route = Array.isArray(d.requirements) ? d.requirements : [];
      const notDone = route.filter(r => records.get(r)?.data?.state !== 'done');
      note('JOURNEY_DONE', `${tag} ${id} requirements=${route.length} notDone=[${notDone.join(',')}]`);
    }
    // ---- gap closure ----
    if (rec.schema === 'work/gap') {
      const closers = d.closedBy == null ? null : Array.isArray(d.closedBy) ? d.closedBy : [d.closedBy];
      if (d.state === 'done' && !closers?.length) note('GAP_DONE_NO_CLOSER', `${tag} ${id}`);
      if (d.state === 'todo' && closers?.length && closers.every(c => records.get(c)?.data?.state === 'done')) {
        note('GAP_TODO_CLOSERS_DONE', `${tag} ${id} closers=[${closers.join(',')}]`);
      }
    }
    // ---- proves asymmetry ----
    if (d.state === 'todo' && Array.isArray(d.proves) && d.proves.length) {
      for (const t of d.proves) {
        if (records.get(t)?.data?.state === 'done') note('PROVES_TODO_SOURCE', `${tag} ${id} proves ${t}`);
      }
    }
    // ---- state vocabulary vs the family schema's declared enum ----
    if (d.state != null) {
      const family = (rec.schema.split('/')[1] ?? '').replace(/^work-?/, '');
      const schemaFile = path.join(root, 'schemas', `work-${rec.schema.split('/')[1]}.schema.yaml`);
      const enumValues = fs.existsSync(schemaFile) ? parseYaml(fs.readFileSync(schemaFile, 'utf8'))?.$defs?.state?.enum : undefined;
      if (Array.isArray(enumValues) && !enumValues.includes(d.state)) note('STATE_OUTSIDE_ENUM', `${tag} ${id} state=${d.state} enum=[${enumValues.join(',')}] (schemas/work-${rec.schema.split('/')[1]}.schema.yaml)`);
    }
  }

  // ---- catalog ----
  const catalog = parseYaml(fs.readFileSync(path.join(workRoot, 'index.yaml'), 'utf8'));
  const norm = s => String(s ?? '').trim().replace(/[.]+$/, '').replace(/\s+/g, ' ');
  for (const entry of catalog.features ?? []) {
    const file = path.join(workRoot, entry.directory, 'index.yaml');
    const feat = fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : null;
    const a = norm(entry.description); const b = norm(feat?.title);
    if (a === b) note('CATALOG_TITLE', `${tag} ${entry.id} equal-after-norm`);
    else if (b && (a.startsWith(b) || b.startsWith(a))) note('CATALOG_TITLE_TRUNCATED', `${tag} ${entry.id}\n     catalog: ${entry.description}\n     title:   ${feat?.title}`);
    else note('CATALOG_TITLE_DIFFERS', `${tag} ${entry.id}\n     catalog: ${entry.description}\n     title:   ${feat?.title}`);
  }
}

for (const [key, lines] of [...tally.entries()].sort()) {
  console.log(`\n== ${key}: ${lines.length}`);
  for (const l of lines.slice(0, 14)) console.log('   ' + l);
  if (lines.length > 14) console.log(`   ... ${lines.length - 14} more`);
}
