# `conventions/` — how the text of a file is spelled

Four files about the surface of the code rather than its structure, so that a diff reads like the
lines around it. [`imports-and-format.md`](imports-and-format.md) is the machine-checked layer:
inside `src/**` eslint rules four-space indent, double quotes and no semicolons — not the root
Prettier settings — and it fixes the import shape, from the named import that always breaks across
lines, through `import type` and the `@modules/*` and `@features/*` barrel aliases, to the
`export * from "./x"` barrel. [`type-safety.md`](type-safety.md) covers what neither eslint nor
`tsc` will stop you doing but the codebase does not do anyway: no new `any`, `unknown` narrowed step
by step, enums for state and kind, explicit return types declared in `types/`, `??` and `?.` in place
of a loose `!`, `satisfies` and type guards in place of `as`, and `as unknown as` kept out of
production. [`config-and-env.md`](config-and-env.md) says who may read `process.env` — one file, plus
three named boundary exceptions — how consumers reach `envConfig().x.y` instead, how a config leaf is
declared with a default and shaped in place, and why a secret is read from a mounted file rather than
from the environment. [`comments.md`](comments.md) is the judgement call the others cannot automate:
when a comment earns its place (WHY, never WHAT), what JSDoc belongs on a constant or a field whose
meaning is implicit, the `TODO(tag)` shape that a stranger can act on, and the rule that changing
code without changing the comment above it leaves the diff unfinished.
