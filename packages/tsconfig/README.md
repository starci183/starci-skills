# @starci/tsconfig

Five TypeScript configs, all strict, all with `noImplicitAny`. Install it from the npm registry at the exact version in [`knowledge/hfs/canon-pins.yaml`](../../knowledge/hfs/canon-pins.yaml) (see [`packages/README.md`](../README.md)).

| File | For | Adds to `base.json` |
|---|---|---|
| `base.json` | anything | `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `esModuleInterop`, `resolveJsonModule`, `skipLibCheck` |
| `be.json` | back end | `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `allowJs: false`, decorators and decorator metadata, `nodenext` module and resolution (CommonJS output, since a back end has no `"type": "module"`), ES2023, `noEmit` |
| `build.json` | back-end emit | `be.json` with `noEmit: false` |
| `next.json` | front-end app | `esnext` + `bundler`, `react-jsx`, DOM libs, `noEmit`, the `next` plugin |
| `e2e.json` | e2e typecheck overlay | `noEmit`, no incremental, no declarations |

None of them sets `outDir`, `rootDir`, `baseUrl`, `paths`, `include` or `exclude`: TypeScript resolves those against the file
that declares them, so a shared file would point inside `node_modules`. The repository owns them, and for a back end the
repository owns exactly one of them, `paths`.

A back-end `tsconfig.json` is a managed file (`hfs sync` renders it, `hfs check` compares it, HFS_TS_STRICT names any flag it
lowers): the preset and the three aliases, nothing else.

```jsonc
// tsconfig.json (back end)
{
  "extends": "@starci/tsconfig/be.json",
  "compilerOptions": { "paths": { "@features/*": ["./src/features/*"], "@modules/*": ["./src/modules/*"], "@tests/*": ["./src/tests/*"] } }
}
```

`tsconfig.build.json` and `tsconfig.e2e.json` are managed too. They put an overlay preset after the repository config (TypeScript 5
`extends` array; later wins) and carry only the path-relative options a preset cannot hold (`outDir`, `include`, `exclude`).

```jsonc
// tsconfig.e2e.json
{ "extends": ["./tsconfig.json", "@starci/tsconfig/e2e.json"], "include": ["src/tests/e2e/**/*.ts"] }
```

`test:e2e` must be `npm run typecheck:e2e && jest --selectProjects e2e`: jest runs with `diagnostics: false`, so this
config is the one place e2e types are checked.
