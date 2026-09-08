# Backend code patterns

`knowledge/ui/` decides what the interface must be. `knowledge/patterns/be/` decides how the
NestJS code behind it is written: which root a file lives under, what a GraphQL unit's files are
called, how a handler is shaped, which alias an import uses, where a docblock sits relative to a
decorator, how an exception is declared and where it is mapped to HTTP and GraphQL, and where the
spec goes. Every rule below was extracted from the bound project's backend checkout (`@workspaces/be/src/`)
by opening files and counting; each table cites its sources. Where the code is split, the file
records the dominant variant with its count instead of legislating. Lint rule names from the bound
project's own ESLint config are quoted only where the code already follows them.

## Catalog

| Knowledge | What it decides | Rules |
| --- | --- | --- |
| [Folder](folder.md) | `features/` versus `modules/`, the file set of one GraphQL unit, where exceptions, entities and tests live | BE-FOLDER-1 … BE-FOLDER-7 |
| [Naming](naming.md) | Kebab file suffixes, class role suffixes, exception identity, enums, constants, methods | BE-NAMING-1 … BE-NAMING-8 |
| [Function](function.md) | Handler `process`, message envelope, service and resolver `execute`, constructor injection, helpers | BE-FUNCTION-1 … BE-FUNCTION-8 |
| [Imports](imports.md) | `@modules`/`@features`/`@tests` aliases, brace style, order, layering direction, banned imports | BE-IMPORTS-1 … BE-IMPORTS-7 |
| [Comment](comment.md) | Docblock after decorators, responsibility over name, enum member docs, `//` prose, ASCII and `vn-ok` | BE-COMMENT-1 … BE-COMMENT-7 |
| [Typing](typing.md) | `interface` over `type`, named params, `readonly`, enums, no `any`, GraphQL classes | BE-TYPING-1 … BE-TYPING-7 |
| [Error](error.md) | `AbstractException` shape, metadata, wrapping, the HTTP filter, the GraphQL interceptor and `formatError` | BE-ERROR-1 … BE-ERROR-7 |
| [Test](test.md) | Colocated `.spec.ts`, lanes by suffix, direct construction with `as never`, what an assertion proves | BE-TEST-1 … BE-TEST-7 |

## Sources

The bound project's backend checkout (`@workspaces/be/src/`), `apps/core/src/app.module.ts` for
filter registration, `tsconfig.json`, `jest.config.ts`, `eslint.config.mjs`.
