Owner: knowledge/hfs/rules.yaml
# Legacy monorepo rules

Lite and full use the same npm workspace layout. The edition-specific fixtures in
`tests/hfs/legacy-monorepo-coverage.spec.mjs` exercise the real monorepo checker
with conforming manifests and one changed fact at a time.

## R143 root workspace manifest

`HFS_MONO_WORKSPACES` identifies a root manifest whose workspace list differs
from `["fe/apps/*", "fe/packages/*"]`, whose package manager lacks an exact npm
version such as `npm@11.6.2`, or whose development dependencies omit Turbo.
Keep those two workspace patterns in that order and use the catalog's Turbo pin.
The root also owns the single lockfile and the managed `turbo.json`: its build
task depends on `^build` and caches Next and distribution outputs, alongside
the development, lint and type-check tasks.

## R144 front-end workspace manifests

`HFS_MONO_FE_WORKSPACE` reports an unreadable front-end manifest, a workspace
that is not private, an app with the wrong package name or scripts, or a package
with missing build/type-check scripts or a different lint command.
An app at `fe/apps/web` in project `demo` uses the name `@demo/web`. Its exact
scripts are `build: next build`, `dev: next dev`,
`lint: starci app lint --workspace .`, `start: next start` and
`typecheck: tsc --noEmit`. A workspace under `fe/packages/` chooses its own
nonempty build and type-check commands and uses the same workspace lint command.
Each workspace declares the runtime dependencies its sources consume.

## R145 Nest monorepo projects

`HFS_MONO_NEST_PROJECTS` reports an unreadable `be/nest-cli.json`, a missing or
false `monorepo` flag, or a project list that differs from the back-end apps in
`hfs.json`. Each project has `type: application`, `root: apps/<app>` and
`sourceRoot: apps/<app>/src`. The default `root` and `sourceRoot` select a
declared API app, including when a worker is also present. This shape applies
to a single service and to multiple services in both lite and full editions.
The scaffold writes this configuration through `nestCli(app)` in
`packages/hfs/scaffold/app.mjs`; there is no managed Nest CLI template file.
The dedicated `tests/hfs/hfs-mono-nest-projects-coverage.spec.mjs` fixtures
exercise accepted configurations and independent violations in each edition.
