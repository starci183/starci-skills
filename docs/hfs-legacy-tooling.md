Owner: knowledge/hfs/rules.yaml

# CI and dependency tooling

## CI and hooks

In both lite and full apps, `HFS_CI_MISSING_CANON` means that the CI workflow does not run `starci app lint`, directly or through a package script that actually invokes it, or explicitly selects a CLI version different from the canon pin. Run the pinned lint entry in CI. `HFS_HOOKS_PATH_REDIRECTED` means the clone redirects `core.hooksPath` away from husky; use `.husky/_` or remove that local override.

## Dependency consistency

In both editions, `HFS_DEP_VERSION_SKEW` reports inconsistent dependency declarations, a declaration that differs from its root override, or a nested installed copy of a declared dependency in the lockfile. Align declarations and overrides and keep one installed copy. `HFS_PACKAGE_MANAGER_MIXED` reports a non-npm package manager declaration or another manager's lockfile; declare npm and keep the npm lockfile.

## Canon package pins

`HFS_CANON_PIN_DRIFT` applies to lite and full apps when a canon dependency or framework version differs from `knowledge/hfs/canon-pins.yaml`. Declare the exact pinned version in each dependency section; a range such as `^<version>` also drifts from the exact pin.
