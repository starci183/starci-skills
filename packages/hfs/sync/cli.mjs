// Entry for the sync-side commands behind `starci app sync` and `starci app hygiene`.
import { runSync } from './index.mjs';
import { runWorkHygiene } from './hygiene.mjs';

export async function main(argv, { cwd = process.cwd(), stdout = (text) => process.stdout.write(text) } = {}) {
  const out = line => stdout(`${line}\n`);
  const [command, ...rest] = argv;
  if (command === 'sync') return runSync(rest, { cwd, out });
  if (command === 'hygiene') return runWorkHygiene({ cwd, out });
  out('usage: starci app sync (--check | --write) [--cwd <dir>] | starci app hygiene [--cwd <dir>]');
  return 2;
}
