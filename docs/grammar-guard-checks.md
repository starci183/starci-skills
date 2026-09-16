# Grammar guard behavior check

`checks/code-patterns/grammar-guards.mjs` executes a bounded behavior probe against
the Grammar package that a frontend actually selects. It does not infer behavior
from an export name or from the architecture package-boundary check.

## Target declaration

The frontend root declares `package.json#starci.codePatterns.next.grammarGuards`:

```json
{
  "schema": "starci/grammar-guard-contract@1",
  "package": "@starci/grammar",
  "entry": "./common",
  "source": { "kind": "repository", "root": "packages/grammar" },
  "vectorProfile": "starci/grammar-guards-v1"
}
```

Use `{ "kind": "installed" }` when the consumer uses an installed package.
Repository mode accepts an initial workspace or `file:` package link after
resolving it to its canonical root. A monorepo consumer must resolve its public
package import to that same provider and build. A standalone Grammar repository
uses `root: "."` and its own public export map, without requiring a self
dependency.

The adapter binds the target package manifest and lock, the exact public entry,
the package's explicit published-file inventory, and repository `src` and
`scripts` inputs where present. It rejects interior links and package escapes.
The same byte identity must remain before and after the probe.

## Finite behavior proof

Profile `starci/grammar-guards-v1` imports the actual public Common entry with
Node's ESM import conditions and checks these finite vectors:

- a definition inheriting every exported `COMMON_UI_RULE_IDS` member succeeds;
- omitting each exported rule in turn throws `TypeError` from a top-level module
  evaluation;
- adding one guaranteed-unknown rule throws `TypeError` at module evaluation;
- every exported `PRESENTATION_STATES` member passes
  `assertPresentationState`;
- a guaranteed-unknown string, empty string, `null`, number, object and array
  each throw `TypeError`.

The subprocess has a fixed timeout, no shell, a minimal non-secret environment,
Node's permission model with filesystem writes, network, child processes and
workers denied, bounded output and bounded package inventory. Missing packages,
exports, static package identity, input stability,
or a completed probe are unavailable coverage. A completed vector with the wrong
result or error class is a code-pattern finding.

## Limits

This check proves only the listed public guard vectors for the exact package
bytes. It does not prove every JavaScript value, every future catalog mutation,
presentation copy, error redaction, React rendering, npm behavior, package
publication, browser behavior or product UAT. The `compiler` field records the
target TypeScript tool identity required by the common script-result protocol;
the behavior evidence is separately recorded as a Node ESM execution probe.
