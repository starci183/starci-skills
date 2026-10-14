// app db restamp: an explicit version map previews file renames and history repairs.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { invocationDir } from '../lib/roots.mjs';
import { migrationStamp } from './rules/database-migrations.mjs';
import { MIGRATIONS_DIR, MIGRATIONS_ARCHIVE_DIR } from './rules/database-constants.mjs';
import { DbVerbError, dbOptions, dbAppRoot, dbSqlFiles, runDbSupabase, repairArgs, dbFailure } from './db-baseline-verb.mjs';

/** YAML maps use quoted UTC stamps as keys and values (or a versions: mapping). */
export function restampPlan(root, mapFile) {
  if (!mapFile) throw new DbVerbError('restamp requires --map <restamp.yaml>');
  let document;
  try { document = parseYaml(fs.readFileSync(path.resolve(root, mapFile), 'utf8')); }
  catch { throw new DbVerbError('restamp map must be readable YAML with unique version keys'); }
  const mapping = document?.versions ?? document;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || !Object.keys(mapping).length) throw new DbVerbError('restamp map must contain old-to-new version pairs');
  const active = dbSqlFiles(root);
  const archived = dbSqlFiles(root, MIGRATIONS_ARCHIVE_DIR);
  const occupied = new Set([...active, ...archived].map((entry) => entry.stamp));
  const targets = new Set();
  const steps = Object.entries(mapping).map(([old, raw]) => {
    const next = String(raw);
    if (![old, next].every((stamp) => /^\d{14}$/.test(stamp) && migrationStamp(stamp) !== null) || old === next) throw new DbVerbError('restamp pairs require distinct valid UTC versions');
    const sources = active.filter((entry) => entry.stamp === old);
    if (sources.length !== 1) throw new DbVerbError('each restamp source must identify exactly one active migration; archives never change');
    if (occupied.has(next) || targets.has(next)) throw new DbVerbError('restamp targets must be unique unoccupied versions');
    targets.add(next);
    const source = sources[0];
    const name = source.name.replace(old, next);
    return { old, next, source: source.file, target: `${MIGRATIONS_DIR}/${name}` };
  });
  const replacements = new Map(steps.map((step) => [step.old, step.next]));
  const resulting = active.map((entry) => replacements.get(entry.stamp) ?? entry.stamp);
  if (resulting.some((stamp, index) => index > 0 && stamp <= resulting[index - 1])) throw new DbVerbError('the map must cover every version needed to preserve migration order');
  return steps.sort((left, right) => left.old < right.old ? -1 : 1);
}

/** The complete map is validated before any repair or file mutation. */
export function dbRestampMain(argv, { cwd = invocationDir(), stdout = (text) => process.stdout.write(text), stderr = (text) => process.stderr.write(text), ...ports } = {}) {
  try {
    const opts = dbOptions(argv, ['cwd', 'map', 'apply', 'local']);
    const root = dbAppRoot(cwd, opts);
    const steps = restampPlan(root, opts.map);
    const repairs = steps.flatMap((step) => [repairArgs(step.old, 'reverted', opts.local), repairArgs(step.next, 'applied', opts.local)]);
    stdout(`${opts.apply ? 'apply' : 'preview'} restamp ${steps.length} migrations\n`);
    for (const step of steps) stdout(`${step.source} -> ${step.target}\n`);
    for (const args of repairs) stdout(`supabase ${args.join(' ')}\n`);
    if (!opts.apply) return 0;
    // CLI failures never echo credentials and leave the local files intact for an explicit retry.
    for (const args of repairs) runDbSupabase(root, args, ports);
    for (const step of steps) {
      const source = path.join(root, step.source);
      const text = fs.readFileSync(source, 'utf8').replace(/^\s*--\s*starci:restamp\s+\d{14}\s+\d{14}\s*\r?\n/, '');
      fs.writeFileSync(path.join(root, step.target), `-- starci:restamp ${step.old} ${step.next}\n${text}`, { flag: 'wx' });
      fs.unlinkSync(source);
    }
    return 0;
  } catch (error) { return dbFailure('restamp', error, stderr); }
}
