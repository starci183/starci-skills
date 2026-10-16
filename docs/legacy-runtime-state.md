Owner: knowledge/hfs/rules.yaml
# Runtime generated state and stable paths

## Generated runtime output

R121 reports `RT_GENERATED_DRIFT` when generated runtime copies differ from the canonical inputs used by their generator. Refresh the copies with `scripts/hfs/sync-runtime.mjs`. It reports `GENERATED_UNTRACKED` when a tracked file sits inside a declared generated root: generated output stays ignored and each checkout regenerates it. Both checks apply in lite and full.

## Cited runtime paths

R122 reports `RT_CITED_PATH_MISSING` when live documentation, contracts or source comments cite a runtime file or symbol that does not exist. Keep those references current when a file moves. Historical changelogs and benchmark records are outside this check. The same check runs for lite and full.

## Pinned runtime paths

R124 reports `RT_PINNED_PATH_MOVED` when a path declared in the runtime manifest's pinned list disappears from the tracked tree. External launchers, hooks and prompts may persist those paths outside Git, so preserve the declared entry or update its owning contract before moving it. This requirement applies in lite and full.

## Dependency directories

R125 reports `RT_NODE_MODULES_LINK` when runtime source creates a symbolic link or junction for a `node_modules` directory, including a local wrapper or spawned link command. Each checkout installs its own dependencies from the cache. Inspecting or removing an existing link remains valid in lite and full.
