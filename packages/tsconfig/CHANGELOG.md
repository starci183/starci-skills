# Changelog

## 2.0.1 - 2026-10-01

- Changed: pins typescript for its own tests and carries a lockfile (lane PKGT clean proof); no config change. The published package.json differs from 2.0.0, so the version moves.

## 2.0.0 - 2026-09-30

- Breaking: `nest.json` is replaced by `be.json`. `be.json` is the whole back-end compiler contract: `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowJs: false`, `isolatedModules`, `experimentalDecorators`, `emitDecoratorMetadata`, and the module settings a Nest 11 + ts-jest project runs on (`nodenext` over a CommonJS package, ES2023). It is `noEmit` by default; nothing in a repository turns a flag off (HFS_TS_STRICT).
- Added: `build.json`, the emit overlay `tsconfig.build.json` extends (`noEmit: false`).
- The repository `tsconfig.json` is a managed file: `extends` this preset and `paths` for the three aliases, nothing else (`hfs sync` renders it, `hfs check` compares it).
