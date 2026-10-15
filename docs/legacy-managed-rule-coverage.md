Owner: knowledge/hfs/rules.yaml
# Managed configuration rule coverage

These managed configuration rules apply to both lite and full applications. The declaration selects the edition before StarCi renders and checks the configuration.

## R04

HFS_GITIGNORE_BLOCK_DRIFT reports a managed block in the root `.gitignore` that differs from its edition's render. Keep the managed block intact; application ignore lines may surround it. Run `npx starci app sync --write` to restore the block. The proof removes a managed ignore entry, checks the finding, and verifies that the rendered block with application lines around it passes in each edition.

## R05

HFS_MANAGED_FILE_DRIFT reports an existing managed file or the root package scripts block that differs from its render. Managed hooks, formatting configuration and workflows are rendered from the application declaration; restore them with `npx starci app sync --write`. The proof changes the managed pre-push hook, checks the finding, and restores the passing render in each edition. Missing files remain the required-slot rule's responsibility.

## R11

HFS_SONAR_CONFIG reports a changed managed `sonar-project.properties` setting or a Sonar stack declaration that names a different quality gate. The rendered properties state no host URL, keep sources separate from tests, import the back end lcov and lint report, and derive the logic coverage scope from the slot manifest. Every application names the canonical quality gate for its edition. Restore the generated configuration with `npx starci app sync --write`. The proof changes a noncoverage encoding setting, checks the finding, and restores the passing render in each edition; coverage-scope edits have their own finding.
