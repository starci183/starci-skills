# Frontend code patterns

`knowledge/ui/` decides what the interface must be: which Grammar object renders, which gap, which
tone. `knowledge/patterns/fe/` decides how the code that produces that interface is written: where
a unit lives, what its files are called, how a component function is shaped, where a class string
sits, how a failure is represented, and where the spec goes. A pattern rule never chooses a visual;
a `ui/` rule never chooses a file name. Every rule below was extracted from
the reference application (`src/`) and its Grammar package (`packages/grammar/src/`) by opening files and counting,
and each table cites the files it was read from. Where the code is split, the file records the
dominant variant with its count instead of legislating.

## Catalog

| Knowledge | What it decides | Rules |
| --- | --- | --- |
| [Folder](folder.md) | Tier directories, the file set of one unit, what a unit folder may not hold | FE-FOLDER-1 … FE-FOLDER-6 |
| [Naming](naming.md) | Folder, export, props type, class-name export, hook, constant and spec names | FE-NAMING-1 … FE-NAMING-7 |
| [Function](function.md) | Component shape, the `props` parameter, the three-part contract, helpers, route files | FE-FUNCTION-1 … FE-FUNCTION-7 |
| [Imports](imports.md) | The `@/` alias, Grammar entry, import order, tier direction, the hooks barrel | FE-IMPORTS-1 … FE-IMPORTS-7 |
| [Comment](comment.md) | Export docblocks, field docs, decision prose, `//` sentences, banned content | FE-COMMENT-1 … FE-COMMENT-5 |
| [Typing](typing.md) | `type` over `interface`, `readonly`, literal unions, `Array<T>`, inferred returns | FE-TYPING-1 … FE-TYPING-7 |
| [Error](error.md) | Failure as a state, the GraphQL envelope, `throw new Error`, toasts | FE-ERROR-1 … FE-ERROR-5 |
| [Test](test.md) | Spec placement, connected versus pure spec, what is asserted, what is not | FE-TEST-1 … FE-TEST-6 |

## Sources

Application: the reference application's `src/` (976 non-spec TypeScript files, 497 specs).
Grammar package: its `packages/grammar/src/`. Lint canon consulted for
rule names only: `@starci/eslint-canon-fe` as installed under `node_modules`.
