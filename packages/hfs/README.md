# @starci/hfs

The HFS v2 command line of a StarCi product repository. It is installed by `starci link` (see [`packages/README.md`](../README.md)),
never from a registry, and it is self-contained: `runtime/` carries the slot manifest, the canon pins, the Vietnamese why
catalog slice and the loader, so it runs where there is no runtime checkout.

```sh
npx hfs check   [--repo <dir>] [--json]       # exit 1 on any error-level finding
npx hfs init    [--repo <dir>] [--stdout]     # write a starter hfs.json (never overwrites); --stdout only prints
npx hfs explain <path> [--repo <dir>] [--json]
npx hfs sync (--check | --write) [--root <dir>]   # generated files: husky, CI, .gitignore block, sonar, codecov (sync/, templates/)
npx hfs work-hygiene                              # pre-commit guard for staged .starciwork / .starcistacks paths
```

`hfs check` reads the repository's `hfs.json` and the tracked paths (`git ls-files`), and reports, each with a why code and its
Vietnamese text (`modules/kernel/failure-codes.yaml`):

| Code | Level | Meaning |
|---|---|---|
| `HFS_PATH_NO_SLOT` | error | a tracked path no slot owns (the nearest slot is named) |
| `HFS_SLOT_NOT_ENABLED` | error | a path in an opt-in slot `hfs.json` did not declare |
| `HFS_SLOT_AMBIGUOUS` | error | two slots own the path equally (a manifest gap) |
| `HFS_TRACKED_MUST_BE_IGNORED` | error | a tracked path in an `ignored` slot (build output, generated) |
| `HFS_FORBIDDEN_PRESENT` | error | a tracked path in a forbidden / `external` slot |
| `HFS_REQUIRED_MISSING` | error | a file or directory a required slot, app or instance must contain |
| `HFS_MIN_INSTANCES` | error | fewer instances of a slot than `minInstances` |
| `HFS_CANON_PIN_DRIFT` | error | a dependency not at the exact version of `knowledge/hfs/canon-pins.yaml` |
| `HFS_SIZE_SOFT_BACKLOG` | info | a source file over `ruleParams.fileLines.soft`; report only, never fails |

Exit codes: 0 clean, 1 an error finding, 2 a refusal (not a Git work tree, bad flag). The command never writes to the repository
except `hfs init`, which writes `hfs.json` only when none exists.

## Maintaining the bundle

`runtime/` is a byte copy of the runtime files listed in `scripts/sync-runtime.mjs` (plus the catalog slice of the codes the
check can emit). After changing `scripts/lib/hfs-check.mjs`, `scripts/lib/hfs-slots.mjs`, `knowledge/hfs/slots.yaml`,
`knowledge/hfs/canon-pins.yaml` or the catalog entries of those codes, run `node packages/hfs/scripts/sync-runtime.mjs`;
`tests/hfs-cli.spec.mjs` fails on a stale copy. Bump `version` here and in the pin when the behaviour changes.
