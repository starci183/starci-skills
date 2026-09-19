import fs from 'node:fs';
import path from 'node:path';

/**
 * Re-parse every saved probe log with ANSI stripping and refresh v76-probe.json.
 * vitest prints its "Tests  N passed" summary with escape codes, so the first parse saw null and the
 * writer's "selected no test" guard would have been blind to every frontend assertion. The logs hold the
 * full stdout+stderr, so this re-measures nothing — it only reads the captured output again, correctly.
 */
const root = path.resolve('.');
const LOGDIR = path.join(root, 'ex-testing/lint/scratch/v76-probelogs');
const OUT = path.join(root, 'ex-testing/lint/scratch/v76-probe.json');
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*[A-Za-z]', 'g');
const strip = text => String(text).replace(ANSI, '');

function summarise(text) {
  const lines = strip(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const tests = lines.filter(l => /^Tests:/.test(l)).join(' | ') || null;
  const suites = lines.filter(l => /^Test Suites:/.test(l)).join(' | ') || null;
  const vitest = lines.filter(l => /^Tests\s+\d/.test(l) || /^Test Files\s+/.test(l)).join(' | ') || null;
  const src = tests ?? vitest;
  const num = label => Number((String(src ?? '').match(new RegExp(`(\\d+) ${label}`)) ?? [])[1] ?? 0);
  return {tests, suites, vitest, passed: num('passed'), failed: num('failed'), skipped: num('skipped'), total: num('total'), tail: lines.slice(-14)};
}

const cache = JSON.parse(fs.readFileSync(OUT, 'utf8'));
let updated = 0, unmatched = 0;
for (const file of fs.readdirSync(LOGDIR).filter(f => f.endsWith('.log'))) {
  const raw = fs.readFileSync(path.join(LOGDIR, file), 'utf8');
  const cmd = raw.split(/\r?\n/)[0]?.replace(/^\$\s/, '') ?? '';
  const cwdLine = raw.split(/\r?\n/)[1]?.match(/^\(cwd (.*)\)$/) ?? [];
  const cwdRel = cwdLine[1] ? path.relative(root, cwdLine[1]).replaceAll('\\', '/') : null;
  const exitLine = raw.split(/\r?\n/)[2]?.match(/^exit (\d+)/) ?? [];
  const key = `${cwdRel}$$${cmd}`;
  if (!cache.runs[key]) { unmatched += 1; continue; }
  const s = summarise(raw.split(/\r?\n/).slice(3).join('\n'));
  const before = `${cache.runs[key].passed}/${cache.runs[key].tests ?? cache.runs[key].vitest}`;
  cache.runs[key] = {...cache.runs[key], ...s, exit: Number(exitLine[1] ?? cache.runs[key].exit), reparsed: true};
  if (before !== `${s.passed}/${s.tests ?? s.vitest}`) { updated += 1; console.log(`reparsed ${key.slice(0, 110)}: ${before} -> ${s.passed}/${s.tests ?? s.vitest}`); }
}
fs.writeFileSync(OUT, JSON.stringify(cache, null, 1));
console.log(`re-parsed ${Object.keys(cache.runs).length} cache entries, ${updated} changed, ${unmatched} logs unmatched`);
