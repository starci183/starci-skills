# Architecture check

`starci architecture check <repo-root>` is a read-only, machine-oriented check for TypeScript backend and frontend source boundaries. It parses the repository's real `tsconfig.json`, resolves imports with that configuration, and loads the TypeScript compiler through the target repository's `package.json`.

```text
starci architecture check .
starci architecture check . --config architecture.json
```

The command writes one `starci/architecture-check@1` JSON object. Exit code `0` means `ok: true`; exit code `1` means the record contains one or more `violations` or `errors`. Each source violation includes a repository-relative path, one-based line and column, a stable rule id, and an actionable message. Resolved dependency violations also identify the resolved path and dependency chain.

## Default layouts

The checker recognizes these conventional roots:

- Backend: `src/modules`, `src/features`, and `apps`.
- Frontend: `src/app`, `src/components`, `src/hooks`, and `src/modules/api`.

Backend modules cannot depend on features or apps. Features cannot depend on apps. Files under `apps/<name>/src` are limited to `main.ts`, `app.module.ts`, and narrowly named bootstrap configuration under `bootstrap`, `config`, or `env`; business, provider, resolver, and controller roles belong below `src/features` or `src/modules`.

Frontend routes mount one page without an additional drawing tree. Component tiers point down from pages to layouts, blocks, composites, branches, and leaves. Connected components may use the hooks barrel. Pure `component.tsx` files stay server-safe and cannot reach hooks or API transport through a re-export barrel. Raw `fetch` belongs in the configured API transport root.

Type-only imports do not create runtime-direction findings. Relative imports, tsconfig aliases, re-export barrels, dynamic `import()` calls, and string-literal `require()` calls are resolved. An unresolved relative or configured alias import is an error, so a broken target configuration cannot produce a green result.

## Optional layout config

Repositories with equivalent layouts at different paths may add a small JSON config. The config changes roots; it cannot contain baselines, ignores, or waivers.

```json
{
  "schema": "starci/architecture-config@1",
  "kinds": ["backend", "frontend"],
  "tsconfig": "tsconfig.json",
  "backend": {
    "modules": "server/modules",
    "features": "server/features",
    "apps": ["server/apps"]
  },
  "frontend": {
    "routes": "web/app",
    "components": "web/components",
    "hooks": "web/hooks",
    "transport": "web/modules/api"
  }
}
```

All paths are repository-relative. The config itself must be a regular file inside the checked repository.

## Failure classes

`errors` report missing target TypeScript, missing or malformed tsconfig, source syntax problems, unresolved internal imports, and invalid checker configuration. `violations` report resolved source dependencies or source shapes that cross a boundary.

This check does not prove dependency-injection bindings, provider scope, runtime routes, or business behavior. Imports whose module name is built dynamically also need review. Those limitations are included in every JSON result.
