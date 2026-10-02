#!/usr/bin/env node
// check-spec-budget.mjs - TEST_BUDGET (rule R226).
// modules/kernel/spec-durations.yaml records, per spec file, the seconds the last land/pre-verify run measured and the one
// per-file limit. A recorded spec over the limit is a finding, unless modules/kernel/allowlist.yaml heavy-specs declares it
// with the reason its real cost cannot be shared (a real install, a real Postgres). That section only shrinks: an entry
// whose spec is within the limit, or no longer exists, is stale. A row whose spec disappeared is stale data too.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { isMain } from '../lib/is-main.mjs';
import { printFindings } from '../lib/check-scan.mjs';
import { readYamlFile } from '../lib/read-yaml.mjs';
import { readAllowlistFile } from '../lib/allowlist.mjs';

export const CODE = 'RT_SPEC_OVER_BUDGET';
export const STALE_CODE = 'RT_SPEC_BUDGET_STALE';
export const DATA_FILE = 'modules/kernel/spec-durations.yaml';
const ALLOWLIST = 'modules/kernel/allowlist.yaml';

/** Findings for one parsed duration record and the heavy-specs entries; `exists` receives each repository-relative spec path. */
function specBudgetFindings(record, heavy, { exists }) {
  const limit = Number(record?.limitSeconds);
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const declared = new Map(heavy.map((entry) => [String(entry?.path ?? ''), entry]));
  const findings = [];
  for (const row of rows) {
    const spec = String(row?.spec ?? '');
    const seconds = Number(row?.seconds);
    const over = Number.isFinite(limit) && Number.isFinite(seconds) && seconds > limit;
    if (!exists(spec)) {
      findings.push({ code: STALE_CODE, path: spec, message: `${spec} is recorded in ${DATA_FILE} but no longer exists; refresh the land duration record` });
    } else if (over && !declared.has(spec)) {
      findings.push({
        code: CODE,
        path: spec,
        message: `${spec} took ${seconds}s, over the ${limit}s budget. Follow speed.md: use a shared per-process fixture, remove per-test install or boot, inject the clock, and never use a longer timeout; a spec whose real install or database cannot be shared is declared with its reason in the heavy-specs section of ${ALLOWLIST}`,
      });
    } else if (!over && declared.has(spec)) {
      findings.push({ code: STALE_CODE, path: spec, message: `${spec} is within the ${limit}s budget (${seconds}s) but ${ALLOWLIST} still declares it heavy: delete the heavy-specs entry` });
    }
  }
  const recorded = new Set(rows.map((row) => String(row?.spec ?? '')));
  for (const spec of declared.keys()) {
    if (!recorded.has(spec)) findings.push({ code: STALE_CODE, path: spec, message: `${ALLOWLIST} declares ${spec} heavy but ${DATA_FILE} has no row for it: delete the heavy-specs entry` });
  }
  return findings;
}

/** Run TEST_BUDGET against a repository root. */
export function checkSpecBudget(root = skillRoot) {
  const record = readYamlFile(path.join(root, DATA_FILE), {});
  const heavy = fs.existsSync(path.join(root, ALLOWLIST)) ? readAllowlistFile('heavy-specs', path.join(root, ALLOWLIST)) : [];
  return specBudgetFindings(record, heavy, { exists: (rel) => fs.existsSync(path.join(root, ...rel.split('/'))) });
}

if (isMain(import.meta.url)) process.exit(printFindings(checkSpecBudget(), 'OK: every recorded spec is current and within its land budget or declared heavy.'));
