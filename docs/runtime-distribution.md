# Runtime distribution (source runtime)

Published packages ship **sources only**: the authored tree is the runtime. Install and update copy it, verify it in place, then record success.

## Install and update flow

1. Copy the declared `package.json` `files` payload into `<host>/.claude`.
2. Preserve locally changed or unowned files on update (unless `--force`).
3. Ensure installed `.claude/.gitignore` contains `/config.yaml` and `/config.json`.
4. Verify the installed source tree (doctor contract checks).
5. Only then write `.starci-skills.json` with the new version and file hashes.

A failed copy or verify does **not** record a successful install or version bump.

## Commands

| Context | Command |
| --- | --- |
| Install / update | `npx starci init\|update --dir <host>` |
| Maintainer checkout | `npm test` |
| Verification | `starci doctor --dir <host> --quick` |

See [knowledge YAML](knowledge-yaml.md) for authored knowledge sources, and [releasing](releasing.md) for packing.

## Recovery after an interrupted install

If copy finished but verification failed, `.starci-skills.json` is absent or still on the prior version, and the installed tree may be partial.

1. Inspect `<host>/.claude` and the installer error (do not treat a partial tree as healthy).
2. Re-run `starci update --dir <host>` / `starci init --dir <host>` from the same reviewed package.
3. Confirm `starci doctor --dir <host> --quick` passes.
4. Keep local modifications reported by update; use `--force` only after backup and review.
