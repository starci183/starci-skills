# `authoring/` — how a line of back-end code is spelled

Eight files. Seven are about the text of the code rather than the design behind it: where a thing
lives and what it is called, how a failure is represented on its way out, what may accept input and
how it is guarded, which types are allowed to survive, how configuration and secrets are read, and
how imports and comments are written. The eighth, `testing.md`, is how that code is checked — the
three kinds of test this backend runs. Together they cover the decisions a stranger is most likely to get
wrong in the first hour — which folder this belongs in, what to do with the error they just caught,
and how the line itself is spelled.

This is the **enforce** lane, so each rule states plainly whether a machine can settle it — a
filename case rule an eslint plugin holds, a thrown literal the compiler's own rule catches, a
boundary a folder-shape check can assert — and says so at the end of the section rather than leaving
the reader to guess. What is left over, and it is the more valuable half, is the type-valid,
lint-clean, renders-fine mistake that no gate catches.

Anchors here are **public sources, not files in this tree**: Parnas on information hiding, Evans on
the bounded context, Richardson, the RFCs for the wire shape of an error. There is nothing in these
files to re-count and no path in them to go stale. The concrete examples are written in TypeScript
against a Nest-shaped application because that is the shape the rules were drawn from; the rule above
each example is what travels.

| File | Decides |
|---|---|
| [`naming-and-structure.md`](naming-and-structure.md) | that a top-level folder is a capability rather than a layer, the split between what is reusable and what wires it to a transport, one public entry per module with a deep import from another capability treated as a bug, colocation by default with promotion on the second consumer, one operation per folder behind an entry-point method with a fixed name, the suffix that names a file's role, and the expand-and-contract rule for renaming something that has already spread |
| [`error-handling.md`](error-handling.md) | that every thrown value is a typed exception carrying a stable code, that expected and unexpected failures are different species and the thrower decides which, that a driver's error is translated at its adapter and never travels past it, one error shape built in exactly one place at the API boundary, no stack or query or internal identifier crossing that boundary, one log line per error at the boundary carrying a correlation id, and retryability declared on the error rather than guessed by the retrier |
| [`validation.md`](validation.md) | that every HTTP and GraphQL input passes through a DTO class carrying `class-validator` decorators at the field, so a malformed or out-of-range value dies before it reaches business logic, that the globally registered `ValidationPipe` is used plainly — no `whitelist` or `forbidNonWhitelisted` invented on top of it without the teacher's call — and that a `string → number` coercion is attached with `@Type(() => Number)` at the field rather than leaned on a global `transform` |
| [`type-safety.md`](type-safety.md) | that `any` is refused in favour of `unknown`-then-narrow even though `tsconfig` and eslint both allow it, that `as` casts stay rare, that the two remaining `any` sites are named old debt no new site may join, and that input of unknown type — a caught error, an external payload — is narrowed with `typeof`, `instanceof`, or duck typing before use |
| [`config-and-env.md`](config-and-env.md) | that `process.env` is read in exactly one place — the `parseEnv*` helpers in `src/modules/env/utils/parse-env.ts` — so no service or provider touches the environment directly and loses its typing and defaults, and that secrets live behind that same boundary rather than being scattered across the codebase |
| [`imports-and-format.md`](imports-and-format.md) | that a `.ts` file under `src/**` is formatted the way `eslint.config.mjs` dictates — four-space indent, double quotes, no semicolons, one array element and one argument per line — that imports go through the `@modules` / `@features` aliases in a fixed order, and that eslint, not the root `.prettierrc` (which governs only `apps/**` and `libs/**`), is the single authority `npm run lint` must pass clean |
| [`comments.md`](comments.md) | that a comment answers WHY the code must be the way it is and never restates WHAT it does, that WHY comments — business constraints, workarounds, non-obvious decisions — are written densely while WHAT comments and commented-out code stay at zero, that an inline `//` sits directly above the line it concerns, and that every comment and JSDoc is written in English |
| [`testing.md`](testing.md) | the three kinds of backend test — unit (Jest, the unit isolated with its dependencies mocked), e2e (the real app booted against real dependencies in Docker via Testcontainers), and the harness (AI features run with every paid LLM provider overridden to a Claude client on Claude Code OAuth, the non-deterministic output graded by a Claude judge) — what each proves and when to reach for which |

## Reading order

Open the one the task touches. If more than one is in play — a new capability that also has to
report failures — read `naming-and-structure.md` first, because where the module boundary falls is
what decides which layer edge the translation in `error-handling.md` §3 happens at.

The design decisions these two presuppose are on the `explore/system-design/` shelf: the module
boundary itself in `module-layering.md`, the wire contract in `api-design.md`, and what happens
around a failure rather than to it in `resilience.md` and `observability.md`.
