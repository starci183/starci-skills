/**
 * Lane v7-10: run captures/verify-render.mjs for every ecommerce ui-screen record in every mode and print
 * the raw exit code of each run. cmd.exe hides a child's exit code behind the wrapper's own, so each exit
 * is taken from the spawn result here rather than from the shell.
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const host = path.resolve(import.meta.dirname, '../../..');
const script = path.join(host, 'examples', 'ecommerce-app-fe', 'captures', 'verify-render.mjs');
const records = [
  'ui.checkout.landing-home',
  'ui.checkout.shop-browse',
  'ui.checkout.cart',
  'ui.checkout.stock-refused',
  'ui.identity.sign-in',
];
const modes = ['custody', 'captures', 'render'];

const table = [];
for (const record of records) {
  for (const mode of modes) {
    const run = spawnSync(process.execPath, [script, '--record', record, mode], {cwd: host, encoding: 'utf8'});
    table.push({record, mode, exit: run.status, out: (run.stdout ?? '') + (run.stderr ?? '')});
  }
}
for (const row of table) {
  console.log(`\n########## ${row.record} :: ${row.mode} :: exit ${row.exit}`);
  console.log(row.out.trimEnd());
}
console.log('\n===== exit-code matrix =====');
for (const row of table) console.log(`${row.record.padEnd(28)} ${row.mode.padEnd(9)} exit=${row.exit}`);
