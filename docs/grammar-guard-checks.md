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
uses `root: "."`; Node resolves its package self-reference and export conditions
without requiring a self dependency.

The adapter binds the target package manifest and lock, exact public entry, the
existing files under the package's explicit published roots, and repository
`src` and `scripts` inputs where present. It follows static relative, package
imports and bare-package imports from the public entry, including literal
`import()` and CommonJS `require()` edges. A bare dependency must resolve to a
canonical package manifest whose exact name and version have a unique npm
`package-lock.json` record. The checker hashes that dependency's installed
package inventory as well as the manifest and lock. The lock record therefore
does not stand in for the installed bytes. Node built-ins are recorded
separately. Absolute/file/data imports, non-literal module names, ambiguous lock
bindings, interior links and package escapes make coverage unavailable.

This is a bounded identity, not a claim that every file in the repository
belongs to the published package. The same byte inventory and public selection
must remain before and after the probe. External static dependencies currently
require npm lock package records; another lock format with external runtime
dependencies is unavailable rather than treated as equivalent evidence.

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
bounded output and bounded package inventory. Node's permission model allows
filesystem reads only within the fully hashed Grammar inventory roots and the
fully hashed canonical roots of resolved external packages. An imported module
cannot obtain behavior data from an unbound file through `node:fs`. Filesystem
writes, child processes and workers are denied.
Network access is denied only on Node versions whose permission model exposes
that capability; Node 22 does not. The report states the actual capability.
This executes the selected trusted package and is a seat belt against accidental
effects, not a sandbox for malicious code. Missing packages, exports, static
package identity, input stability,
or a completed probe are unavailable coverage. A completed vector with the wrong
result or error class is a code-pattern finding.

## Limits

This check proves only the listed public guard vectors for the exact package
bytes. It does not prove every JavaScript value, every future catalog mutation,
presentation copy, error redaction, React rendering, npm behavior, package
publication, browser behavior or product UAT. The `compiler` field records the
target TypeScript tool identity required by the common script-result protocol;
the behavior evidence is separately recorded as a Node ESM execution probe.
The exact static import closure is reported separately from the broader bound
package inventories that Node is permitted to read. The check does not claim
that a package lock alone identifies installed bytes or that the permission
model is a security sandbox for adversarial package code.
