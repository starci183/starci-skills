# Runtime distribution (source-built `.dist`)

Published packages ship **sources and compilers**, not a prebuilt `.dist`. Install and update build agent-facing contracts on the target host, then verify before recording success.

## Install and update flow

1. Copy the declared `package.json` `files` payload into `<host>/.claude`.
2. Preserve locally changed or unowned files on update (unless `--force`).
3. Ensure installed `.claude/.gitignore` contains `/.dist/` (and staging helpers `/.dist.staging/`, `/.dist.previous/`, plus `/config.json` when needed).
4. Build from that installed tree with `scripts/build-workflows.mjs` (operator and knowledge compilation are required inside this single build; publish uses staging then rename so a failed build does not leave a partial current bundle). Never generate JSON mirrors into the source tree.
5. Verify with `scripts/build-workflows.mjs --check`.
6. Only then write `.starci-skills.json` with the new version and file hashes.

A failed generate/build/check does **not** record a successful install or version bump. Do not force-add `.dist` to Git; the repository and installed runtime ignore `/.dist/` (and staging dirs).

## Commands that trigger a build

| Context | Command |
| --- | --- |
| Install / update | `npx starci init\|update --dir <host>` (builds inside the installed tree) |
| Maintainer checkout | `npm run build` / `npm run build:check` |
| Session preflight | `node scripts/ensure-build.mjs` |
| Knowledge only | `node scripts/compile-knowledge.mjs` / `--check` |

See [knowledge YAML](knowledge-yaml.md) for authored sources versus generated JSON, and [releasing](releasing.md) for packing without publishing `.dist`.

## Recovery after an interrupted install

If copy finished but build/verify failed, `.starci-skills.json` is absent or still on the prior version, and `.dist` may be partial.

1. Inspect `<host>/.claude` and the installer error (do not treat a partial tree as healthy).
2. From the installed tree, run `node scripts/ensure-build.mjs` or re-run `starci update --dir <host>` / `starci init --dir <host>` from the same reviewed package.
3. Confirm `.claude/.dist/manifest.json` exists and `starci doctor --dir <host> --quick` passes.
4. Keep local modifications reported by update; use `--force` only after backup and review.
