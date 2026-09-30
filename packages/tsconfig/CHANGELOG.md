# Changelog

## 2.0.0 - unreleased

- Breaking: `nest.json` is replaced by `be.json`. `be.json` is the whole back-end compiler contract: `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowJs: false`, `isolatedModules`, `experimentalDecorators`, `emitDecoratorMetadata`, and the module settings a Nest 11 + ts-jest project runs on (`nodenext` over a CommonJS package, ES2023). It is `noEmit` by default; nothing in a repository turns a flag off (HFS_TS_STRICT).
- Added: `build.json`, the emit overlay `tsconfig.build.json` extends (`noEmit: false`).
- The repository `tsconfig.json` is a managed file: `extends` this preset and `paths` for the three aliases, nothing else (`hfs sync` renders it, `hfs check` compares it).
