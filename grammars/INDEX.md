# Grammar profiles

## Definition

A grammar profile is the deterministic bridge from closed UI facts to surface, interaction, region
and state obligations. Its stable id is stored at `.claude/grammars/<grammar>/`; a workspace
role selects that id explicitly through `context.grammar`. Project identity and grammar identity are
different, so multiple explicitly configured StarCi products may use the `starci` foundation without
turning it into a fallback for unrelated frontends.

## Rules

1. `GRAMMAR-1` — Resolve only the exact grammar id declared by the workspace role because project
   and repository names are not grammar selectors.
2. `GRAMMAR-2` — A rule consumes closed fact ids and emits closed outcomes, obligations and an
   owner resolution because prose that still needs interpretation is not deterministic grammar.
3. `GRAMMAR-3` — Every promoted rule carries a durable behavior capsule, founder ruling,
   golden and counterexample cases, and a compiled `.template.tsx` artifact because deleted source
   must not delete the product family's reasoning.
4. `GRAMMAR-4` — One winning rule per slot is selected by priority, then specificity, then lexical
   rule id because the same facts must produce byte-identical decisions without an LLM.
5. `GRAMMAR-5` — A missing grammar route, owner or required fact stops the design gate with
   `new-required` or `returned-to-owner`; it never falls back to JSX assembled with `map()`.
6. `GRAMMAR-6` — Repository remotes, revisions, paths, symbols, blobs and active or legacy source
   anchors are forbidden in promoted grammar evidence because provenance is not durable behavior.
7. `GRAMMAR-7` — Resolution emits only facts, capsules, templates and principle concerns selected
   by winning rules because loading the complete grammar or principle library defeats selective
   context and spends model attention on unrelated behavior.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Put StarCi rules under `fe/` as shared senses | Product behavior would silently leak into every frontend | Keep them under `grammars/starci/` |
| Guess a grammar from project or repository names | Identity resemblance is not configuration | Read `context.grammar` literally |
| Let candidate prose replace a grammar receipt | Execution cannot re-run or compare prose | Store fact, grammar and decision hashes |
| Treat an absent owner as permission to hand-roll markup | The missing reusable branch is the finding | Emit `new-required` with the semantic owner id |
| Store a repository path or source snapshot as promoted evidence | The rule disappears or becomes stale when the checkout changes | Store a founder ruling, durable capsule, cases and compiled template |
| Load every capsule and principle for one matched rule | Unrelated context dilutes the decision and wastes tokens | Emit only the winning rules' context pack |

## Examples

Right: `Project=starci-academy` plus `context.grammar=starci` loads only
`grammars/starci/grammar.json`.

Wrong: the gate searches all grammar folders and chooses the closest-looking rail.

The difference is an explicit grammar route.

Right: hierarchical navigation plus local disclosure resolves to the StarCi accordion owner and
its keyboard, active-parent and collapsed-summary obligations.

Wrong: the block candidate says "list" and renders nested arrays with `map()`.

The difference is a machine-resolved interaction contract.

Right: a promoted rail rule keeps its invariant capsule, founder ruling, golden/counterexample cases
and hashed TSX template after the repository that inspired it is removed.

Wrong: the rule points at an old component path and calls that pointer its evidence.

The difference is durable behavior rather than source provenance.
