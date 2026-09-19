# Nest environment, cache and export boundaries

The reusable check lives in `scripts/checks/code-patterns/nest-boundaries.mjs`. It uses
the target's TypeScript installation and canonical architecture projects. It
does not load the Academy repository's private ESLint rules or require a new
lint-package publication. The aggregate manifest owns adoption and complete
source/input coverage; invoking this adapter alone is not a full conformance
claim.

## Explicit project bindings

Declare exact paths in `package.json#starci.codePatterns.nest.boundaries`:

```json
{
  "schema": "starci/nest-boundary-contract@1",
  "envParsers": ["src/modules/platform/env/parse-env.ts"],
  "cacheOwners": [
    {
      "root": "src/modules/integrations/cache",
      "tokens": [
        {
          "path": "src/modules/integrations/cache/tokens.ts",
          "export": "CACHE_MANAGER"
        }
      ]
    }
  ],
  "jestLifecycleEntries": ["src/tests/global-setup.ts"]
}
```

These are ownership declarations, not suppression lists. Empty arrays express
that the project owns no such boundary. Paths cannot use wildcards, leave the
repository or redirect through links. Cache owners cannot overlap; their token
exports must resolve in the consuming TypeScript program. A reviewer verifies
that an env parser actually validates startup configuration and exposes only
the intended typed configuration. A parser filename is not behavioral proof.

## Executable rules

- `NEST_ENV_ACCESS`: environment reads/writes belong to declared parser files.
  Direct and bracket access, Node process imports, immutable aliases,
  destructuring and literal module acquisition preserve their source identity.
  Locally shadowed `process` parameters are not the Node process. Mutable,
  computed or escaping raw-process aliases make static coverage unavailable.
- `NEST_CACHE_TOKEN_BOUNDARY`: raw cache tokens stay inside their declared cache
  owner. Renamed imports, re-exports and constant forwarding aliases resolve to
  the same exported token. Reserved raw cache names require an owner. An ordinary
  object property with the same spelling is not a cache token.
- `NEST_NAMED_EXPORTS`: production exports are named, including export-list and
  CommonJS export-assignment forms. A declared Jest exception is accepted only
  when the actual target runner's stable normalized configuration binds that
  source as `globalSetup` or `globalTeardown`. Discovery loads Jest configuration
  but never runs test bodies or setup/teardown hooks.

The aggregate must include the architecture config, its TypeScript/config
closure, all source dependency inputs and target compiler identity in its
before/after binding. When a lifecycle exception is requested it must also run
the Nest metadata preflight and bind runner/configuration inputs. The metadata
result itself verifies its inputs and normalized configuration remained stable.

Static checking does not establish safe secret handling, parser validation,
cache key design, connection identity or behavior through reflection. Those
properties retain agent review and the relevant executable behavior evidence.
Dynamic source constructs outside the supported binding cannot certify complete
coverage. Missing project/config/owner bindings stay unavailable; an agent cannot
waive them with prose.

## Basis

This is the adopted StarCi policy, not a Node or Nest requirement. The Academy
private plugin at backend commit `1731b15ba4ed526477e3c572b9d82c31ab64f1d5`
uses name/path heuristics for cache/default exports; this script binds selected
owners and actual Jest lifecycle roles instead. Read on 2026-09-16:
[Node process API](https://nodejs.org/api/process.html#processenv),
[TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html),
and [Jest configuration](https://jestjs.io/docs/configuration).
