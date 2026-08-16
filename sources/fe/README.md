# @starci/eslint-canon-fe

**58 ESLint rules, from 16 laws, that hold a React front end to one way of being written.**

Not a style pack. These rules enforce *architecture*: which tier a component belongs to, whether
structure may be typed as a raw class string, where a vendor primitive may be imported, which file
is allowed to fetch. Prettier decides how code looks; this decides what it is allowed to be.

```bash
npm i -D @starci/eslint-canon-fe
```

## Use it

One block in `eslint.config.mjs`. It attaches every rule at the severity the canon asks for, and
makes inline disable comments ineffective rather than merely discouraged.

```js
import starciFe, {
    recommended,
    linterOptions,
    starciFeConfig,
} from "@starci/eslint-canon-fe"

export default [
    // …your own ignores, language options and other plugins…
    starciFeConfig({
        layout: "single-app",       // or "monorepo"
        plugin: starciFe,
        recommended,
        linterOptions,
    }),
]
```

`layout` is the one thing a repository owns. `single-app` governs `src/**`; `monorepo` governs
`packages/ui/src/**` and `apps/*/src/**`. **Which globs the law applies to is your fact. What the
law says is not** — so there is no option to switch a rule off or lower it to a warning.

Prefer to wire it by hand? Every piece is exported: `rules`, `recommended`, `linterOptions`,
`ruleOwners`, `audits`, `auditOwners`, `lawOwners`.

## What it actually catches

A sample, not the list:

| Rule | What it stops |
|---|---|
| `no-literal-structural-class` | Layout classes typed straight onto an element instead of named in the contract registry |
| `no-unknown-contract-key` | A structure key that no registry entry declares |
| `presentational-purity` | A drawing component that fetches, so it can never be rendered from a test |
| `connected-block-has-presentational-twin` | A block wired to data with no pure half to render |
| `no-vendor-icon-outside-icon-leaf` | A vendor glyph imported anywhere but the one leaf that wraps it |
| `no-arbitrary-value` · `no-fractional-step` | Values off the spacing scale, invented per call site |
| `no-resting-twin-component` | A hand-kept skeleton tree that drifts from the thing it stands in for |
| `no-inline-lint-config` | A disable comment switching the architecture off for one line |
| `require-export-jsdoc` | An exported symbol with no stated reason to exist |
| `no-second-language-in-source` | Copy hardcoded where the translation layer should own it |

Every rule names the law that declares it — `ruleOwners` maps rule name to law, so a failing build
line leads straight to the document that explains why.

## Why the rules are all errors

Existing debt gets fixed before adoption. Lowering architecture to `warn` teaches every later author
that the boundary is optional, and a boundary everyone learns is optional is not a boundary. There
is no staged rollout mode, on purpose.

## Companion

- **[@starci/eslint-canon-be](https://www.npmjs.com/package/@starci/eslint-canon-be)** — the
  back-end half: 37 rules from 15 laws covering CQRS, exceptions, transport, observability and
  end-to-end flows.

## Where the laws live

Each rule is the enforceable half of a written law. The prose — why the rule exists, what it
refuses, which cases sit just outside it — is published openly at
[starci183/starci-claude-skills](https://github.com/starci183/starci-claude-skills).

A rule that cannot be pointed at in real code is a proposal, not a law. Everything here is
pointed at.

## Requirements

ESLint 9+ (flat config), Node 20.9+.
