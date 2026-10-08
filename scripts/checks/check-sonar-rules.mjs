#!/usr/bin/env node
// check-sonar-rules.mjs - the Sonar rules of this project, enforced locally in seconds before merge (part of `npm run check`, the
// Supervisor's land gate and the pre-commit hook). SonarCloud stays the final measurement (its scan lands ~90 minutes after a
// push); this check judges the same source scope (sonar-project.properties) with the rule table of scripts/gates/sonar-rules-table.mjs.
//
//   starci runtime check --only sonar-rules [-- --json]
//   starci runtime check --only sonar-rules -- --staged        the staged files only, read from the index (the pre-commit hook)
//   starci runtime check --only sonar-rules -- --init          write the `sonar-rules` section of modules/kernel/allowlist.yaml, once
//   starci runtime check --only sonar-rules -- --prune         delete the baseline entries whose finding is gone
//
// Output: one `S<id> <file>:<line> <message>` line per finding that is not in the committed baseline, and one
// `RT_SONAR_BASELINE_STALE` line per baseline entry whose finding no longer exists (the fix commit deletes the entry). Exit 1 on any.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { catFile } from '../api/git/cat-file.mjs';
import { diff } from '../api/git/diff.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { analysed, readSonarScope, scopeFiles } from '../gates/sonar-rules-scope.mjs';
import { BASELINE_FILE, BASELINE_SECTION, compareToBaseline, pruneBaseline, readBaseline, writeBaseline } from '../gates/sonar-rules-baseline.mjs';

export const CODE_STALE = 'RT_SONAR_BASELINE_STALE';
const FLAGS = Object.freeze(['--json', '--staged', '--init', '--prune', '--root']);
const HELP = 'usage: check-sonar-rules [--root <dir>] [--staged] [--init | --prune] [--json]';

/** The staged paths under `root` split into {present, removed}: renames count as a removal plus an addition. */
function stagedPaths(root) {
  const out = gitOutputOf(diff(['--cached', '--name-status', '--no-renames', '-z', '--diff-filter=ACMRD'], { cwd: root }), 'git diff --cached');
  const parts = out.split('\0').filter(Boolean);
  const present = [];
  const removed = [];
  for (let i = 0; i < parts.length; i += 2) (parts[i] === 'D' ? removed : present).push(parts[i + 1]);
  return { present, removed };
}

/** The sources to lint: the index blob of each staged file, or the working-tree file of a full run. */
function sourcesOf(root, files, staged) {
  return files.map((file) => ({
    file,
    source: staged ? gitOutputOf(catFile(['blob', `:${file}`], { cwd: root }), `git cat-file :${file}`) : fs.readFileSync(path.join(root, file), 'utf8'),
  }));
}

const line = (finding) => ({ code: finding.rule, message: `${finding.file}:${finding.line} ${finding.message}` });
const staleLine = (entry) => ({
  code: CODE_STALE,
  message: `${entry.file}: the baseline lists ${entry.rule} (fingerprint ${entry.fingerprint}) but the finding no longer exists; delete the entry (starci runtime check --only sonar-rules -- --prune)`,
});

/** The run's plan: which files are linted and which baseline entries it may judge. */
function planOf(root, scope, staged) {
  if (!staged) return { files: scopeFiles(root, scope), covered: () => true };
  const { present, removed } = stagedPaths(root);
  const files = present.filter((file) => analysed(file, scope));
  const touched = new Set([...files, ...removed]);
  return { files, covered: (file) => touched.has(file) };
}

/** The check at `root`: {ok, findings, listed, stale, checked, skipped?}. `staged` judges only the index. */
export async function checkSonarRules({ root = skillRoot, staged = false, init = false, prune = false } = {}) {
  const scope = readSonarScope(root);
  if (!scope) return { ok: true, skipped: 'no sonar-project.properties: not a source checkout', findings: [], listed: 0, stale: 0, checked: 0 };
  const plan = planOf(root, scope, staged);
  // ESLint and its plugins are devDependencies: a source checkout has them, an installed runtime has no sonar-project.properties and returned above.
  const { lintSources } = await import('../gates/sonar-rules-engine.mjs');
  const found = await lintSources(root, sourcesOf(root, plan.files, staged));
  const baseline = readBaseline(root);
  if (init && !baseline.exists) writeBaseline(root, found);
  const { entries } = init && !baseline.exists ? readBaseline(root) : baseline;
  const { fresh, stale, listed } = compareToBaseline(found, entries, plan.covered);
  if (prune && stale.length) pruneBaseline(root, stale);
  const findings = [...fresh.map(line), ...(prune ? [] : stale.map(staleLine))];
  return { ok: findings.length === 0, findings, listed: listed.length, stale: stale.length, checked: plan.files.length };
}

function parseArgs(argv) {
  const options = { root: skillRoot, json: false, staged: false, init: false, prune: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') return { help: true };
    if (!FLAGS.includes(flag)) return { error: `unknown argument ${flag}` };
    if (flag === '--root') { options.root = path.resolve(argv[i + 1] ?? ''); i += 1; } else options[flag.slice(2)] = true;
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { console.log(HELP); return 0; }
  if (options.error) { console.error(`check-sonar-rules: ${options.error}\n${HELP}`); return 2; }
  const result = await checkSonarRules(options);
  const ok = result.skipped ? `sonar-rules: skipped (${result.skipped})` : `sonar-rules: ${result.checked} files, no new finding (${result.listed} listed in ${BASELINE_FILE}, section ${BASELINE_SECTION})`;
  return printFindings(result.findings, ok, { json: options.json });
}

if (isMain(import.meta.url)) process.exitCode = await main();
