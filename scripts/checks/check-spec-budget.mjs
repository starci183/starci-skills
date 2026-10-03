#!/usr/bin/env node
// check-spec-budget.mjs - TEST_BUDGET (rule R226), ADVISORY for alpha.4.
// modules/kernel/spec-durations.yaml records, per spec file, the seconds the last land/pre-verify run measured and the one
// per-file limit. Every recorded spec over the limit is reported as an INFO finding ranked by its excess; it does not fail
// the check stage (the release record lists them). The budget turns blocking once the heavy specs are sped up (alpha.5).
// A row whose spec no longer exists is stale data and is an error.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';

export const CODE = 'RT_SPEC_OVER_BUDGET';
export const STALE_CODE = 'RT_SPEC_BUDGET_STALE';
export const DATA_FILE = 'modules/kernel/spec-durations.yaml';

/** Findings for one parsed duration record: over-budget rows as level info (largest excess first), stale rows as errors; `exists` receives each repository-relative spec path. */
function specBudgetFindings(record, { exists }) {
  const limit = Number(record?.limitSeconds);
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const over = [];
  const stale = [];
  for (const row of rows) {
    const spec = String(row?.spec ?? '');
    const seconds = Number(row?.seconds);
    if (!exists(spec)) {
      stale.push({ code: STALE_CODE, level: 'error', path: spec, message: `${spec} is recorded in ${DATA_FILE} but no longer exists; refresh the land duration record` });
    } else if (Number.isFinite(limit) && Number.isFinite(seconds) && seconds > limit) {
      over.push({
        code: CODE,
        level: 'info',
        path: spec,
        excess: seconds - limit,
        message: `${spec} took ${seconds}s, ${seconds - limit}s over the ${limit}s budget. Follow speed.md: use a shared per-process fixture, remove per-test install or boot, inject the clock, and never use a longer timeout`,
      });
    }
  }
  over.sort((a, b) => b.excess - a.excess || a.path.localeCompare(b.path));
  return [...over, ...stale];
}

/** Run TEST_BUDGET against a repository root. */
export function checkSpecBudget(root = skillRoot) {
  const record = readYamlFile(path.join(root, DATA_FILE), {});
  return specBudgetFindings(record, { exists: (rel) => fs.existsSync(path.join(root, ...rel.split('/'))) });
}

if (isMain(import.meta.url)) {
  const findings = checkSpecBudget();
  const errors = findings.filter((f) => f.level === 'error');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: errors.length === 0, findings }, null, 2));
  else {
    for (const f of findings) (f.level === 'error' ? console.error : console.log)(`${f.level === 'error' ? '' : 'INFO '}${f.code} ${f.message}`);
    if (!findings.length) console.log('OK: every recorded spec is current and within its land budget.');
  }
  process.exit(errors.length ? 1 : 0);
}
