---
title: Source references
---

# Source references

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@catalog` | `compilers/patterns/source-references/references.json` | file | bind frontend and backend precedent to immutable repositories, commits and source roots |
| `@resolve` | `compilers/patterns/source-references/resolve.mjs` | script | verify a declared local checkout or materialize the exact commit under workspace cache |

## Record

This module supplies shared implementation precedent to both frontend and backend pattern compilers.
It is broader than Apollo, GraphQL or any one capability: a compiler may inspect the smallest relevant
slice for module layout, client construction, transport, authentication, storage, CQRS, testing or
another accepted source concern. A reference is evidence for shape, never product truth or source to
paste.

## Situation codes

| Code | Situation | Required result |
|---|---|---|
| `SOURCE-REF-1` | A frontend pattern is compiling a shared capability or family | Resolve the `fe` reference at its exact commit, inspect only paths relevant to the accepted shape, and cite the exact reference path behind every adopted precedent |
| `SOURCE-REF-2` | A backend pattern is compiling a shared capability or operation family | Resolve the `be` reference at its exact commit, inspect only paths relevant to the accepted shape, and cite the exact reference path behind every adopted precedent |
| `SOURCE-REF-3` | No initialized workspace reference contains the immutable commit | Stop before target-specific pattern reads and route the Source through `starci-init`; initialization owns `.workspaces/local/references/<id>` and pattern compilation never clones or fetches |
| `SOURCE-REF-4` | The target repository already has a sibling of the same kind | The target sibling remains primary; the shared reference challenges or fills missing convention only and may not overwrite live target ownership |
| `SOURCE-REF-5` | Reference behavior conflicts with routed business truth, live schema, grammar or target contracts | Routed target authority wins; record the conflict and do not import the reference behavior |

## Resolution

1. Read `@catalog`; select exactly the reference matching the compiling role.
2. Run `@resolve --role <role>`. It validates `.workspaces/local/pattern-references.json`, its portable
   `workspacePath`, the checkout under `.workspaces/local/references/<id>`, remote identity and immutable commit.
3. A `needs-init` result stops pattern compilation and returns to `starci-init`. Only initialization
   may reuse an existing checkout or install the immutable object into Source-local workspace cache.
4. Inspect the smallest source paths needed to answer the accepted pattern situation. Do not inventory
   the whole reference repository or import unrelated architecture.
5. Compare target sibling, reference precedent and accepted target authority. Preserve the target sibling
   when it already answers the situation; otherwise mirror only the evidenced family shape.
6. Emit the exact `git+https://...@<40-char-commit>:<path>` reference and every concrete source path used.

## Rules

1. References are immutable Git evidence, not mutable branch URLs or machine-local paths.
2. This module is technology-neutral; no client, framework or transport gets a private duplicate registry.
3. Pattern compilation is read-only over references; it never clones, fetches, pulls or rewrites workspace routes.
4. The local registry stores Source-relative `workspacePath` values, never absolute disk paths; durable authority never depends on machine layout.
5. Target business truth, schema, grammar, contracts and same-repository siblings outrank reference precedent.
6. Copying product logic, credentials, generated output or feature vocabulary from a reference is forbidden.
7. Every adopted precedent cites the reference id, immutable ref and exact source paths that demonstrated it.

## Output

```text
role: <fe | be>
reference: <id>
immutableRef: <git+https://...@commit:path>
checkout: <verified machine-local path>
targetSibling: <path | none>
referencePaths: <smallest exact paths inspected>
decision: <target sibling preserved | reference shape mirrored | new family required>
reason: <authority and evidence that decided it>
```
