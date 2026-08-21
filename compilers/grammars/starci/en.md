---
title: StarCi deterministic frontend grammar · English
---

# StarCi frontend grammar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@grammar` | `compilers/grammars/starci/grammar.json` | file | closed fact-to-outcome rules |
| `@facts` | `compilers/grammars/starci/facts.json` | file | closed observable fact catalog |
| `@capsules` | `compilers/grammars/starci/capsules.json` | file | durable behavior, rulings and case/template bindings |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | select one deterministic winner per slot and emit a compact context pack |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove package identity, cases, hashes, templates and forbidden provenance |

## Record

This compiler turns closed product-family UI facts into one deterministic set of semantic outcomes,
behavior obligations, project owners and principle concerns. It is loaded only when the workspace
route explicitly declares grammar `starci` and a concrete profile such as `starci-academy`.

The package is self-contained: founder rulings, durable capsules, golden and counterexample cases,
and hashed `.template.tsx` files remain useful even if every repository that inspired them disappears.
Source repositories may be inspected while discovering a rule, but repository origin is forbidden in
the promoted package.

## Law

1. `GRAMMAR-1` — Resolve only the grammar and profile declared by the verified workspace route.
2. `GRAMMAR-2` — A rule consumes closed fact ids and emits closed outcomes and obligations.
3. `GRAMMAR-3` — Every promoted behavior has founder rulings, a durable capsule, both case kinds and a hashed TSX template.
4. `GRAMMAR-4` — One winner per slot is selected by priority, specificity and lexical rule id.
5. `GRAMMAR-5` — A missing route, owner or fact stops; it never authorizes hand-built fallback JSX.
6. `GRAMMAR-6` — Repository remotes, revisions, paths, symbols, blobs and source-origin records are forbidden.
7. `GRAMMAR-7` — Resolution returns only selected facts, capsules, templates and principle concerns.

## Routing

Layout and block design classify evidenced situations into fact ids, run `@resolve-grammar`, and bind
the resulting receipt into their accepted design revision. Outcomes constrain which semantic owner is
reused, extended or reported as `new-required`; they do not choose visual classes.

Execute recomputes the same receipt from accepted facts and the current declared profile. A hash drift,
missing capsule, changed template or absent owner returns to design. It loads only the emitted compact
context pack, then resolves the emitted `principleConcerns` through the principle compiler.

## Rules

1. Product/project names never infer grammar identity.
2. Grammar facts are observable situations, not component names or desired outcomes.
3. A golden case must resolve every expected outcome and no rejected outcome regardless of fact order.
4. A counterexample must prove the nearby rule does not fire.
5. Templates preserve owner boundaries and state transitions; they are references, not source to paste blindly.
6. Optional immutable refs are provenance only and may never change durable authority.
7. Design skills record grammar/profile ids and receipt hashes so execution can detect drift.

## Stops

- The workspace route omits grammar/profile, or names a package/profile that does not exist.
- A required situation cannot be expressed by the closed fact catalog.
- Two rules tie outside the deterministic ordering or an emitted owner is absent.
- Capsule/case/template validation or any receipt hash fails.

## Output

Return sorted facts, one decision per matched slot, the compact selected context pack and a receipt
hashing grammar, profile, facts, decisions and context. Do not load or return unrelated grammar law.
