// proves: HFS_REPO_LOCAL_CHECK@lite
// proves: HFS_REPO_LOCAL_CHECK@full
// proves: HFS_LINT_SUPPRESSION_FILE@lite
// proves: HFS_LINT_SUPPRESSION_FILE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoLocalCheckFindings } from '../runtime/scripts/hfs/rules/repo-local-checks.mjs';
import { lintSuppressionFindings } from '../runtime/scripts/hfs/rules/lint-suppression.mjs';

function repository(t, edition, entries) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-repository-hygiene-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(entries)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return { repoRoot, files: Object.keys(entries), repo: { edition } };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} invalid repository-local checks and lint plugins are refused`, (t) => {
    const context = repository(t, edition, {
      'scripts/check-schema.mjs': 'export {};\n',
      'tools/check-flow.cjs': 'module.exports = {};\n',
      'be/eslint-plugin-private/index.mjs': 'export default {};\n',
      'fe/lint-rules/readonly.mjs': 'export default {};\n',
      'eslint-local-plugin/index.mjs': 'export default {};\n',
      'eslint-local-rules.mjs': 'export default {};\n',
      'package.json': JSON.stringify({ scripts: { check: 'node scripts/check-schema.mjs' } }),
    });
    const findings = repoLocalCheckFindings(context);
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [
      ['HFS_REPO_LOCAL_CHECK', 'scripts/check-schema.mjs'],
      ['HFS_REPO_LOCAL_CHECK', 'tools/check-flow.cjs'],
      ['HFS_REPO_LOCAL_CHECK', 'be/eslint-plugin-private/index.mjs'],
      ['HFS_REPO_LOCAL_CHECK', 'fe/lint-rules/readonly.mjs'],
      ['HFS_REPO_LOCAL_CHECK', 'eslint-local-plugin/index.mjs'],
      ['HFS_REPO_LOCAL_CHECK', 'eslint-local-rules.mjs'],
      ['HFS_REPO_LOCAL_CHECK', 'package.json'],
    ]);
  });

  test(`${edition} valid operational scripts delegate checks to the runtime`, (t) => {
    const context = repository(t, edition, {
      'scripts/rotate-logs.mjs': 'export {};\n',
      'tools/seed.mjs': 'export {};\n',
      'package.json': JSON.stringify({ scripts: { check: 'starci app check', 'logs:rotate': 'node scripts/rotate-logs.mjs' } }),
      'node_modules/eslint-plugin-third-party/index.mjs': 'export default {};\n',
    });
    assert.deepEqual(repoLocalCheckFindings(context).filter((finding) => finding.code === 'HFS_REPO_LOCAL_CHECK'), []);
    assert.deepEqual(repoLocalCheckFindings(context), []);
  });

  test(`${edition} invalid lint suppression files, scripts, flags and config are refused`, (t) => {
    const context = repository(t, edition, {
      'eslint.suppressions.json': '{}\n',
      'be/eslint-suppressions.json': '{}\n',
      'fe/eslint.suppressions.config.mjs': 'export default {};\n',
      'eslint.config.mjs': "export default [{ linterOptions: { suppressions: './eslint.suppressions.json' } }];\n",
      'package.json': JSON.stringify({ scripts: {
        'lint:suppressions': 'eslint .',
        'lint:all': 'eslint --suppress-all .',
        'lint:rule': 'eslint --suppress-rule example .',
        'lint:location': 'eslint --suppressions-location cache.json .',
        'lint:prune': 'eslint --prune-suppressions .',
      } }),
    });
    const findings = lintSuppressionFindings(context);
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [
      ['HFS_LINT_SUPPRESSION_FILE', 'eslint.suppressions.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'be/eslint-suppressions.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'fe/eslint.suppressions.config.mjs'],
      ['HFS_LINT_SUPPRESSION_FILE', 'eslint.config.mjs'],
      ['HFS_LINT_SUPPRESSION_FILE', 'package.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'package.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'package.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'package.json'],
      ['HFS_LINT_SUPPRESSION_FILE', 'package.json'],
    ]);
  });

  test(`${edition} valid lint config and scripts keep every finding visible`, (t) => {
    const context = repository(t, edition, {
      'eslint.config.mjs': "export default [{ linterOptions: { reportUnusedDisableDirectives: 'error' } }];\n",
      'package.json': JSON.stringify({ scripts: { lint: 'eslint --max-warnings=0 .', 'lint:fix': 'starci app lint --fix' } }),
      'node_modules/eslint.suppressions.json': '{}\n',
    });
    assert.deepEqual(lintSuppressionFindings(context).filter((finding) => finding.code === 'HFS_LINT_SUPPRESSION_FILE'), []);
    assert.deepEqual(lintSuppressionFindings(context), []);
  });
}
