---
title: StarCi deterministic frontend grammar · English
---

# StarCi frontend grammar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@grammar` | `grammars/starci/grammar.json` | file | closed fact-to-outcome rules |
| `@facts` | `grammars/starci/facts.json` | file | closed observable fact catalog |
| `@capsules` | `grammars/starci/capsules.json` | file | durable behavior, rulings and case/template bindings |
| `@rulings` | `grammars/starci/rulings.json` | file | normalized owner statements, scope and negative boundaries |
| `@master-system` | `grammars/starci/design-system.json` | file | one compact visual system shared before page-level deviations |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | select one deterministic winner per slot and emit a compact context pack |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove package identity, cases, hashes, templates and forbidden provenance |

## Record

This authority package defines the closed product-family UI facts, deterministic semantic outcomes,
behavior obligations, project owners and principle concerns consumed by the resolver. It is loaded only when the workspace
route explicitly declares grammar `starci` and a concrete profile such as `starci-academy`.

The package is self-contained: founder rulings, durable capsules, golden and counterexample cases,
and hashed `.template.tsx` files remain useful even if every repository that inspired them disappears.
Source repositories may be inspected while discovering a rule, but repository origin is forbidden in
the promoted package.

## Law

1. `GRAMMAR-1` — Resolve only the grammar and profile declared by the verified workspace route.
2. `GRAMMAR-2` — A rule consumes closed fact ids and emits closed outcomes and obligations.
3. `GRAMMAR-3` — Every promoted behavior has a family-scoped invariant/correction ruling with negative scope, a durable capsule, both case kinds and a hashed TSX template. Examples never promote themselves.
4. `GRAMMAR-4` — One winner per slot is selected by priority, specificity and lexical rule id.
5. `GRAMMAR-5` — A missing route, owner or fact stops; it never authorizes hand-built fallback JSX.
6. `GRAMMAR-6` — Repository remotes, revisions, paths, symbols, blobs and source-origin records are forbidden.
7. `GRAMMAR-7` — Resolution returns only selected facts, capsules, templates and principle concerns.
8. `GRAMMAR-8` — A profile visual contract locks direction axes, semantic role tokens and exact token values; those roles reach every supported theme mode and renderer-owned portal, and design and execution refuse substitutions or vendor fallbacks.
9. `GRAMMAR-9` — MASTER fixes visual language once; a profile may override only declared roles and a page records deviations only.
10. `GRAMMAR-10` — When an observable fact excludes a neighboring outcome, encode that negative boundary in the rule and a counterexample; absence of a positive fact is not durable refusal evidence.
11. `GRAMMAR-11` — Decompose every labelled feature section into one grammar scope before composition. A single body, peer list, disclosure hierarchy and bounded form resolve to their semantic surface owners; the section label remains outside that surface.

## Routing

Layout and block design classify evidenced situations into fact ids, run `@resolve-grammar`, and bind
the resulting receipt plus MASTER into the current session baseline. Outcomes constrain which semantic owner is
reused, extended or reported as `new-required`; they do not choose visual classes. A selected owner may
also carry a visual contract, which fixes semantic theme tokens and values before direction comparison and
keeps that role mapping at the common document theme owner shared by routed content and renderer-owned portals.

Each render region records closed child targets as grammar scopes. Every scope carries its own facts and
the exact slot/outcome/component owners recomputed by the resolver. A region-level block name never licenses
generic cards around children whose peer, disclosure or form facts resolve to a more specific surface owner.

The same skill invocation recomputes the receipt before source writes. A hash drift, missing capsule,
changed template or absent owner returns to candidate work. It resolves only emitted `principleConcerns`
that remain as deltas after MASTER, legacy and current source have answered the visual decision.
A visual contract additionally requires every preview state to mount its boundary, declare and use every
locked token exactly, and carry no raw palette value outside that contract.

## Rules

1. Product/project names never infer grammar identity.
2. Grammar facts are observable situations, not component names or desired outcomes.
3. A golden case must resolve every expected outcome and no rejected outcome regardless of fact order.
4. A counterexample must prove the nearby rule does not fire.
5. Templates preserve owner boundaries and state transitions; they are references, not source to paste blindly.
6. Optional immutable refs are provenance only and may never change durable authority.
7. Design skills record grammar/profile ids, MASTER system id and receipt hashes so same-session source execution can detect drift.
8. Grammar-locked visual contracts are invariant across candidate composition, viewport and interaction state.
9. A visual-contract receipt is incomplete without its matching `preview.html` proof.

## Stops

- The workspace route omits grammar/profile, or names an authority package/profile that does not exist.
- A required situation cannot be expressed by the closed fact catalog.
- Two rules tie outside the deterministic ordering or an emitted owner is absent.
- Capsule/case/template validation or any receipt hash fails.

## Output

Return sorted facts, one decision per matched slot, the compact selected context pack and a receipt
hashing grammar, profile, facts, decisions and context. Do not load or return unrelated grammar law.
