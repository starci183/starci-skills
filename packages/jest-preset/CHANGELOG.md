# Changelog

## 2.0.0 - unreleased

- Breaking: `starciJestConfig()` takes no options. The repository `jest.config.js` is a managed file, exactly `module.exports = require("@starci/jest-preset").starciJestConfig()`, rendered by `hfs sync` and compared by `hfs check` (HFS_MANAGED_FILE_DRIFT), so `moduleNameMapper`, `roots`, `tsconfig`, `rootDir`, `unit` and `e2e` overrides are gone. `StarciJestOptions` is removed.
- Added: the three path aliases (`@features/*`, `@modules/*`, `@tests/*`) are part of the preset (`MODULE_NAME_MAPPER`), matching the aliases the managed `tsconfig.json` declares.
- Added: `coverageProvider: "v8"`, so branch coverage counts real source, not the helpers TypeScript emits.
- Breaking: four projects, one per test kind (owner test layout 2026-09-30): `unit` (colocated `*.spec.ts`, ignores `src/tests/{world,integration,e2e,contract}/`), `integration` (`src/tests/integration/**/*.integration-spec.ts`), `e2e` (`src/tests/e2e/**/*.e2e-spec.ts`) and `contract` (`src/tests/contract/**/*.contract-spec.ts`). The last three compile against `src/tests/tsconfig.json`, run one worker and share the test world's `globalSetup`/`globalTeardown` (`src/tests/world/global-setup.ts`, `global-teardown.ts`); there is no `setupFilesAfterEnv`. `src/tests/e2e/live/`, `E2E_LIVE` and `test:e2e:live` are gone: a provider sandbox is a contract spec. `typecheck:e2e` is replaced by `typecheck:tests`.
- Unchanged: ts-jest with `diagnostics: false` (`isolatedModules` comes from `@starci/tsconfig`), `mock<T>()`, `FakeClock`, the Sonar coverage denominators.
