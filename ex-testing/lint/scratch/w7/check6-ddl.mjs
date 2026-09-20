// check 6: sqlite/schema.sql + machine.sql vs DDL in kernel/ledger-db.mjs
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const schemaSql = readFileSync(root + 'sqlite/schema.sql', 'utf8');
const machineSql = readFileSync(root + 'sqlite/machine.sql', 'utf8');
const mjs = readFileSync(root + 'kernel/ledger-db.mjs', 'utf8');
const norm = s => s.replace(/\s+/g,' ').replace(/IF NOT EXISTS /gi,'').trim().toLowerCase();
const objs = sql => {
  const out = {tables: [], indexes: [], triggers: []};
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([`"'\w]+)/gi)) out.tables.push(m[1].toLowerCase());
  for (const m of sql.matchAll(/CREATE INDEX(?: IF NOT EXISTS)?\s+([`"'\w]+)/gi)) out.indexes.push(m[1].toLowerCase());
  for (const m of sql.matchAll(/CREATE TRIGGER(?: IF NOT EXISTS)?\s+([`"'\w]+)/gi)) out.triggers.push(m[1].toLowerCase());
  return out;
};
const s = objs(schemaSql), m = objs(mjs), mach = objs(machineSql);
const diff = (a, b) => ({onlyInSql: a.filter(x=>!b.includes(x)), onlyInMjs: b.filter(x=>!a.includes(x))});
console.log('== schema.sql vs ledger-db.mjs (all DDL) ==');
for (const k of ['tables','indexes','triggers']) {
  const d = diff(s[k], m[k]);
  console.log(`${k}: sql=${s[k].length} mjs=${m[k].length}`, JSON.stringify(d));
}
console.log('\n== machine.sql objs:', JSON.stringify(mach));
// column-level: compare each CREATE TABLE body between schema.sql and LEDGER_DDL region
const bodies = sql => {
  const out = {};
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([`"'\w]+)\s*\(([^;]*?)\);/gis)) out[m[1].toLowerCase()] = norm(m[2]);
  return out;
};
const sb = bodies(schemaSql), mb = bodies(mjs);
console.log('\n== column-level diffs (schema.sql vs mjs) ==');
for (const t of Object.keys(sb)) {
  if (!mb[t]) { console.log(`  ${t}: missing in mjs`); continue; }
  if (sb[t] !== mb[t]) {
    console.log(`  ${t}: DIFFERS`);
    console.log(`    sql: ${sb[t].slice(0,300)}`);
    console.log(`    mjs: ${mb[t].slice(0,300)}`);
  }
}
for (const t of Object.keys(mb)) if (!sb[t]) console.log(`  ${t}: only in mjs`);
