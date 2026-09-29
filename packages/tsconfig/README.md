# @starci/tsconfig

Four TypeScript configs, all strict, all with `noImplicitAny`. Install with `starci link` (see [`packages/README.md`](../README.md)); there is no registry publish.

| File | For | Adds to `base.json` |
|---|---|---|
| `base.json` | anything | `strict`, `noImplicitAny`, `strictNullChecks`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `esModuleInterop`, `resolveJsonModule`, `skipLibCheck` |
| `nest.json` | back end | `nodenext` module and resolution, ES2023, decorators and decorator metadata, declarations, source maps, incremental |
| `next.json` | front-end app | `esnext` + `bundler`, `react-jsx`, DOM libs, `noEmit`, the `next` plugin |
| `e2e.json` | e2e typecheck overlay | `noEmit`, no incremental, no declarations |

None of them sets `outDir`, `rootDir`, `baseUrl`, `paths`, `include` or `exclude`: TypeScript resolves those against the file
that declares them, so a shared file would point inside `node_modules`. The repository owns them.

```jsonc
// tsconfig.json (back end)
{
  "extends": "@starci/tsconfig/nest.json",
  "compilerOptions": { "outDir": "./dist", "baseUrl": "./", "paths": { "@features/*": ["./src/features/*"] } },
  "include": ["apps/**/*", "src/**/*"]
}
```

```jsonc
// tsconfig.e2e.json: the repository config first, the overlay second (TypeScript 5 `extends` array; later wins)
{
  "extends": ["./tsconfig.json", "@starci/tsconfig/e2e.json"],
  "include": ["src/tests/e2e/**/*.ts"]
}
```

`test:e2e` must be `npm run typecheck:e2e && jest --selectProjects e2e`: jest runs with `diagnostics: false`, so this
config is the one place e2e types are checked.
