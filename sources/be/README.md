# @starci/eslint-canon-be

**37 ESLint rules, from 15 laws, that hold a NestJS-shaped back end to one way of being written.**

Not a style pack. These rules enforce *architecture*: which layer may import which, whether a
failure carries its own identity, where a query is allowed to be built, what an end-to-end test is
permitted to assume. Prettier decides how code looks; this decides what it is allowed to be.

```bash
npm i -D @starci/eslint-canon-be
```

## Use it

```js
import starciBe, { recommended } from "@starci/eslint-canon-be"

export default [
    // …your own ignores, language options and other plugins…
    {
        files: ["src/**/*.ts"],
        plugins: { "starci-be": starciBe },
        rules: recommended,
    },
]
```

Which globs the law applies to is your repository's fact. What the law says is not — so there is no
option to switch a rule off or lower it to a warning.

Also exported: `rules`, `ruleOwners`, `lawOwners`.

## What it actually catches

A sample, not the list:

| Area | What the rules hold |
|---|---|
| **Exceptions** | Every failure throws a domain exception carrying its own identity and metadata — never a bare `Error`, never a framework built-in, never an exception declared outside the exceptions folder |
| **CQRS** | A handler does not assemble an aggregate inline; reads and writes do not share one path |
| **Module layering** | An import that climbs a layer it was not given is a build failure, not a review comment |
| **Data access** | Queries stay where the layer says they may be built |
| **Transport** | The wire shape is declared, not inferred from whatever a handler happened to return |
| **Observability** | A failure is logged as a typed exception, so a log line can be traced to the law that names it |
| **End-to-end flows** | One file, one flow, named steps, and **never sleep** — poll until the state settles, with a deadline |
| **CDC · event delivery** | Projections and events follow the declared delivery contract |
| **Comments · naming · type safety** | Comments say why; no double cast through `unknown` |

Every rule names the law that declares it — `ruleOwners` maps rule name to law, so a failing build
line leads straight to the document that explains why.

## Companion

- **[@starci/eslint-canon-fe](https://www.npmjs.com/package/@starci/eslint-canon-fe)** — the
  front-end half: 58 rules from 16 laws covering component tiers, structure contracts, the
  fetch/draw split, vendor boundaries and the design-token scale.

## Where the laws live

Each rule is the enforceable half of a written law. The prose — why the rule exists, what it
refuses, which cases sit just outside it — is published openly at
[starci183/starci-claude-skills](https://github.com/starci183/starci-claude-skills).

A rule that cannot be pointed at in real code is a proposal, not a law. Everything here is
pointed at.

## Requirements

ESLint 9+ (flat config), Node 20.9+.
