import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const schemaSql = readFileSync(root + 'sqlite/schema.sql', 'utf8');
const mjs = readFileSync(root + 'kernel/ledger-db.mjs', 'utf8');
const norm = s => s.replace(/\s+/g,' ').replace(/IF NOT EXISTS /gi,'').trim().toLowerCase();
const bodies = (sql, firstOnly) => {
  const out = {};
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([`"'\w]+)\s*\(([^;]*?)\)(?:;|'|`|\s)/gis)) {
    const k = m[1].toLowerCase();
    if (!(k in out) || !firstOnly) out[k] = norm(m[2]);
    if (firstOnly && k in out) continue;
  }
  return out;
};
const sb = bodies(schemaSql, true), mb = bodies(mjs, true);
for (const t of Object.keys(sb)) {
  if (!mb[t]) { console.log(`${t}: MISSING in mjs`); continue; }
  if (sb[t] !== mb[t]) {
    console.log(`${t}: DIFFERS\n  sql: ${sb[t]}\n  mjs: ${mb[t]}`);
  }
}
console.log('done — tables compared:', Object.keys(sb).length);
