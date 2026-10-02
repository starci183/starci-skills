// repo-local-checks.mjs - HFS_REPO_LOCAL_CHECK (R103): a repository carries no check, lint rule or lint plugin of its own. Every check
// lives in the .claude runtime or in a canon package (`@starci/eslint-canon-*`), so a repository has none to keep in step.
//   - a file or folder named `eslint-local-rules*`, `eslint-plugin*` or `eslint-local-plugin*`, or one below an `eslint-rules/` or `lint-rules/` folder;
//   - a `check-*` file in a `scripts/` or `tools/` folder (a check under another name is the reviewer's, not a name test's);
//   - a package.json script that runs a `check-*` file of `scripts/` or `tools/`.
// The check reads the tracked tree and the manifests. `scripts/` may keep operational scripts (repo.scripts); it keeps no check.
// Not judged here, because another rule already is: a file that defines an ESLint rule or a stylelint plugin by its content, and a script that
// swaps the configuration (HFS_TOOL_CONFIG_LOCAL, R16), and an eslint.config that differs from the render, a relative import of a local plugin
// included (HFS_RULE_OFF_WITHOUT_REPLACEMENT, R17). This rule adds the forbidden roles by name: what a check or a rule file is called.
import { found, readJson } from './read.mjs';

export const REPO_LOCAL_CHECK = 'HFS_REPO_LOCAL_CHECK';
const LOCAL_RULE_FILE = /(?:^|\/)(?:eslint-local-rules|eslint-plugin|eslint-local-plugin)[^/]*(?:\/|$)|(?:^|\/)(?:eslint-rules|lint-rules)\//;
const CHECK_SCRIPT = /(?:^|\/)(?:scripts|tools)\/check-[^/]+$/;
const RUNS_CHECK = /(?:^|[\s&|;(])(?:\.\/)?(?:scripts|tools)\/check-[^\s&|;)]+/;

/** The findings of R103 over the tracked paths `files` of the repository at `repoRoot`. */
export function repoLocalCheckFindings({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    if (file.includes('node_modules/')) continue;
    if (LOCAL_RULE_FILE.test(file)) findings.push(found(REPO_LOCAL_CHECK, file, `${file} is a local lint rule or plugin; a repository keeps no rule of its own: the rule is proposed to the canon (@starci/eslint-canon-*) in the .claude runtime`));
    else if (CHECK_SCRIPT.test(file)) findings.push(found(REPO_LOCAL_CHECK, file, `${file} is a check kept in the repository; every check lives in the .claude runtime (starci app check, the canons), so a repository has none to keep`));
    else if (file === 'package.json' || file.endsWith('/package.json')) {
      const pkg = readJson(repoRoot, file);
      for (const [name, command] of Object.entries(pkg?.scripts ?? {})) {
        if (RUNS_CHECK.test(String(command))) findings.push(found(REPO_LOCAL_CHECK, file, `${file} script ${name} runs a repository-local check (${String(command).slice(0, 80)}); delete the script, the check belongs to the .claude runtime`));
      }
    }
  }
  return findings;
}
