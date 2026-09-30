# Changelog

## 2.0.0 - unreleased

- Changed: `hfs check` runs the whole architecture machine after its slot, pin and size checks. Its violations and errors are findings under the machine's own rule ids, each with the Vietnamese why of its code, and any of them exits 1. The package carries a byte copy of the machine and every file it imports, plus the failure-code slice of every code the machine can emit. The machine loads `typescript` from the checked repository; a repository without it fails with `ARCH_TYPESCRIPT_MISSING`.
- Added: `hfs check --fast [--base <ref>]`, the flag the template pre-push hook already called. It judges the owners changed since the merge-base with `origin/main` (else `main`), skipping clones, dead exports and the file-system tree checks. With no merge-base it is a refusal (exit 2) that names the fix.
- Added: `HFS_EMPTY_DIR`, `HFS_GHOST_TREE` (an empty directory beside a sibling within two edits of its name) and `HFS_UNTRACKED_ROOT_ENTRY` (entries git neither tracks nor ignores, outside an `ignored` slot): rule R03 ships as an `hfs` enforcer.
- Changed: the machine's root-entry allowlist accepts `.prettierignore`, which the slot manifest already requires.

## 1.0.1 - 2026-09-30

- Fixed: `package.json` now has `exports` for `./runtime/*` and `./package.json`, so other published packages can resolve the runtime copy it carries (`@starci/hfs/runtime/knowledge/hfs/slots.yaml`, `@starci/hfs/runtime/engine/yaml.mjs`) with `import.meta.resolve` or `require.resolve`, wherever the package is installed. `@starci/eslint-canon-be` 1.7.1 reads the slot manifest this way.
- Changed: `CHANGELOG.md` ships in the package (`files`).
- The bin is unchanged; the runtime copy is resynced (`canon-pins.yaml` states the new pins).

## 1.0.0 - 2026-09-30

- First registry publication: the `hfs` command line with its runtime bundle, sync files and templates.
