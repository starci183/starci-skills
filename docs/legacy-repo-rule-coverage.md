Owner: knowledge/hfs/rules.yaml

# Repository hygiene and test placement

## R102

`BE_SPEC_PLACEMENT` keeps back-end tests in their owning layers in both lite and full. Unit tests sit beside a unit-tested role as `<name>.service.spec.ts` or `<name>.cli.spec.ts`;
Integration, e2e and contract tests belong below `be/src/tests/{integration,e2e,contract}`.
A spec or test placed under an application folder or any other directory outside those layers produces this finding.
Move the test into its layer; operational scripts carry no specs. Lite permits contract tests while its separate edition rules still restrict e2e execution.

## R103

`HFS_REPO_LOCAL_CHECK` rejects repository-owned check scripts and lint plugins in either edition. This includes `scripts/check-*`, `tools/check-*`, local ESLint rule/plugin names, `eslint-rules/` and `lint-rules/`, and package scripts that invoke those check files. Submit a reusable check to the runtime or canon package and call `starci app check`; an operational script that is not a check may remain in the application.

## R104

`HFS_LINT_SUPPRESSION_FILE` reports stored lint suppressions in lite and full: `eslint.suppressions*` or `eslint-suppressions*` files, suppression configuration in `eslint.config.*`, package scripts ending in `:suppressions`, and the ESLint flags `--suppressions-location`, `--suppress-all`, `--suppress-rule` and `--prune-suppressions`. Remove the suppression mechanism and repair the code that caused the finding. Ordinary lint commands and fixes preserve the checks.

## R105

`HFS_PROOF_COMMAND_FILE_MISSING` reports a `requiresProof.<kind>.command` that names a repository-relative file neither tracked nor present. Proof commands run from the app root: create the named script, spec or configuration, or point the command at an existing file. The check applies to admitted lite brand records and full Work records. Records for another repository, globs, variables and ignored build outputs fall outside this presence check.
