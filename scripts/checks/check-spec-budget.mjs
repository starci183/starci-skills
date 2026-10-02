#!/usr/bin/env node
// check-spec-budget.mjs - TEST_BUDGET (rule R226).
// The recorded land durations name only specs that need work. A live row over the declared budget is a
// finding; a row whose spec disappeared is stale data. The land workflow owns refreshing the record.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';

export const CODE = 'RT_SPEC_OVER_BUDGET';
export const STALE_CODE = 'RT_SPEC_BUDGET_STALE';
export const DATA_FILE = 'modules/kernel/spec-durations.yaml';

/** Findings for one parsed duration record; `exists` receives each repository-relative spec path. */
export function specBudgetFindings(record, { exists }) {
  const limit = Number(record?.limitSeconds);
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const findings = [];
  for (const row of rows) {
    const spec = String(row?.spec ?? '');
    const seconds = Number(row?.seconds);
    if (!exists(spec)) {
      findings.push({ code: STALE_CODE, path: spec, message: `${spec} is recorded in ${DATA_FILE} but no longer exists; refresh the land duration record` });
    } else if (Number.isFinite(limit) && Number.isFinite(seconds) && seconds > limit) {
      findings.push({
        code: CODE,
        path: spec,
        message: `${spec} took ${seconds}s, over the ${limit}s budget. Follow speed.md: use a shared per-process fixture, remove per-test install or boot, inject the clock, and never use a longer timeout`,
      });
    }
  }
  return findings;
}

/** Run TEST_BUDGET against a repository root. */
export function checkSpecBudget(root = skillRoot) {
  const record = readYamlFile(path.join(root, DATA_FILE), {});
  return specBudgetFindings(record, { exists: (rel) => fs.existsSync(path.join(root, ...rel.split('/'))) });
}

if (isMain(import.meta.url)) process.exit(printFindings(checkSpecBudget(), 'OK: every recorded spec is current and within its land budget.'));
