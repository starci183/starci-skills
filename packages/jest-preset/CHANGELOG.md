# Changelog

## 2.0.0 - unreleased

- Breaking: `starciJestConfig()` takes no options. The repository `jest.config.js` is a managed file, exactly `module.exports = require("@starci/jest-preset").starciJestConfig()`, rendered by `hfs sync` and compared by `hfs check` (HFS_MANAGED_FILE_DRIFT), so `moduleNameMapper`, `roots`, `tsconfig`, `rootDir`, `unit` and `e2e` overrides are gone. `StarciJestOptions` is removed.
- Added: the three path aliases (`@features/*`, `@modules/*`, `@tests/*`) are part of the preset (`MODULE_NAME_MAPPER`), matching the aliases the managed `tsconfig.json` declares.
- Added: `coverageProvider: "v8"`, so branch coverage counts real source, not the helpers TypeScript emits.
- Changed: the e2e project never runs `src/tests/e2e/live/`; `E2E_LIVE` is not read any more. `test:e2e:live` selects the live specs on the jest command line.
- Unchanged: projects `unit` and `e2e`, ts-jest with `diagnostics: false` (`isolatedModules` comes from `@starci/tsconfig`), `mock<T>()`, `FakeClock`, the Sonar coverage denominators.
