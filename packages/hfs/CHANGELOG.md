# Changelog

## 1.0.1 - 2026-09-30

- Fixed: `package.json` now has `exports` for `./runtime/*` and `./package.json`, so other published packages can resolve the runtime copy it carries (`@starci/hfs/runtime/knowledge/hfs/slots.yaml`, `@starci/hfs/runtime/engine/yaml.mjs`) with `import.meta.resolve` or `require.resolve`, wherever the package is installed. `@starci/eslint-canon-be` 1.7.1 reads the slot manifest this way.
- Changed: `CHANGELOG.md` ships in the package (`files`).
- The bin is unchanged; the runtime copy is resynced (`canon-pins.yaml` states the new pins).

## 1.0.0 - 2026-09-30

- First registry publication: the `hfs` command line with its runtime bundle, sync files and templates.
