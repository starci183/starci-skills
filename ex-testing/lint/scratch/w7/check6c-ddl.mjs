// check 6 corrected: schema.sql <-> LEDGER_DDL region, machine.sql <-> MACHINE_DDL region
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const schemaSql = readFileSync(root + 'sqlite/schema.sql', 'utf8');
const machineSql = readFileSync(root + 'sqlite/machine.sql', 'utf8');
const mjs = readFileSync(root + 'kernel/ledger-db.mjs', 'utf8');
// extract the two template literals + META_TABLE_DDL const
const led = /LEDGER_DDL=`([^`]*)`/.exec(mjs)[1] + /META_TABLE_DDL='([^']*)'/.exec(mjs)[1];
const mac = /MACHINE_DDL=`([^`]*)`/.exec(mjs)[1];
const norm = s => s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').replace(/IF NOT EXISTS /gi,'').replace(/[``'"]/g,'').trim().toLowerCase();
const objs = sql => ({
  tables: [...new Set([...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([\w]+)/gi)].map(m=>m[1].toLowerCase()))],
  indexes: [...new Set([...sql.matchAll(/CREATE INDEX(?: IF NOT EXISTS)?\s+([\w]+)/gi)].map(m=>m[1].toLowerCase()))],
  triggers: [...new Set([...sql.matchAll(/CREATE TRIGGER(?: IF NOT EXISTS)?\s+([\w]+)/gi)].map(m=>m[1].toLowerCase()))],
});
const bodies = sql => {
  const out = {};
  // split on CREATE TABLE, take up to ');' at paren-depth 0
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([\w]+)\s*\(/gis)) {
    const name = m[1].toLowerCase();
    let i = m.index + m[0].length, depth = 1, end = i;
    while (i < sql.length && depth > 0) { if (sql[i]==='(') depth++; else if (sql[i]===')') depth--; i++; }
    out[name] = norm(sql.slice(end, i - 1));
  }
  return out;
};
const cmp = (label, sqlText, ddlText) => {
  const s = objs(sqlText), d = objs(ddlText);
  console.log(`== ${label} ==`);
  for (const k of ['tables','indexes','triggers']) {
    const onlySql = s[k].filter(x=>!d[k].includes(x)), onlyDdl = d[k].filter(x=>!s[k].includes(x));
    console.log(`  ${k}: sql=${s[k].length} ddl=${d[k].length} onlyInSql=${JSON.stringify(onlySql)} onlyInDdl=${JSON.stringify(onlyDdl)}`);
  }
  const sb = bodies(sqlText), db = bodies(ddlText);
  for (const t of Object.keys(sb)) {
    if (!db[t]) { console.log(`  COLS ${t}: missing in ddl`); continue; }
    if (sb[t] !== db[t]) console.log(`  COLS ${t}: DIFFERS\n    sql: ${sb[t]}\n    ddl: ${db[t]}`);
  }
  for (const t of Object.keys(db)) if (!sb[t]) console.log(`  COLS ${t}: only in ddl`);
};
cmp('schema.sql vs LEDGER_DDL', schemaSql, led);
cmp('machine.sql vs MACHINE_DDL', machineSql, mac);
