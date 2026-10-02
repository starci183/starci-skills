// lint-suppression.mjs - HFS_LINT_SUPPRESSION_FILE (R104): a repository keeps no lint-suppression file, script or option. A finding is
// fixed in the code (or the rule is changed in the canon); it is never recorded away in a file that lets it stay.
//   - a file named `eslint.suppressions*` or `eslint-suppressions*`;
//   - a package.json script named `lint:suppressions` (or any `<x>:suppressions`), or one that passes `--suppressions-location`,
//     `--suppress-all`, `--suppress-rule` or `--prune-suppressions` to eslint;
//   - an `eslint.config.*` that names a suppressions configuration.
// Comment-level suppression (`eslint-disable`) is the lint rule `no-inline-suppression`'s (R18).
import { found, readJson, readText } from './read.mjs';

const LINT_SUPPRESSION_FILE = 'HFS_LINT_SUPPRESSION_FILE';
const SUPPRESSION_FILE = /(?:^|\/)eslint[.-]suppressions[^/]*$/;
const SUPPRESSION_SCRIPT_NAME = /(?:^|:)suppressions$/;
const SUPPRESSION_FLAG = /--(?:suppressions-location|suppress-all|suppress-rule|prune-suppressions)\b/;
const ESLINT_CONFIG = /(?:^|\/)eslint\.config\.[cm]?[jt]s$/;
const CONFIG_SUPPRESSION = /suppressions/i;

/** The findings of R104 over the tracked paths `files` of the repository at `repoRoot`. */
export function lintSuppressionFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    if (file.includes('node_modules/')) continue;
    if (SUPPRESSION_FILE.test(file)) findings.push(found(LINT_SUPPRESSION_FILE, file, `${file} is a lint-suppression file; a finding is fixed in the code, never recorded in a file that lets it stay`));
    else if (ESLINT_CONFIG.test(file)) {
      const text = readText(repoRoot, file);
      if (text !== null && CONFIG_SUPPRESSION.test(text)) findings.push(found(LINT_SUPPRESSION_FILE, file, `${file} passes a suppressions configuration to eslint; a repository suppresses nothing`));
    } else if (file === 'package.json' || file.endsWith('/package.json')) {
      const pkg = readJson(repoRoot, file);
      for (const [name, command] of Object.entries(pkg?.scripts ?? {})) {
        if (SUPPRESSION_SCRIPT_NAME.test(name) || SUPPRESSION_FLAG.test(String(command))) findings.push(found(LINT_SUPPRESSION_FILE, file, `${file} script ${name} manages lint suppressions (${String(command).slice(0, 80)}); delete the script and fix the findings in the code`));
      }
    }
  }
  return findings;
}
