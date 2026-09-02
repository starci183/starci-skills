# Templates

One template per document kind. A template is the skeleton a human copies and, inside it, one fenced
`json template-contract` block that `scripts/validate-templates.mjs` enforces on every file the
template applies to and on that file's `.vi.md` mirror. The contract is the authority; the skeleton
is how a person reads it.

| Template | Applies to | Enforces |
| --- | --- | --- |
| `context.template.md` | `operators/*/context.md` | title; Purpose, Context classes, Required context, free law sections, Boundary, Resources |
| `input.template.md` | `operators/*/input.md` | title; Envelope, Context bindings, free sections, Resume input |
| `execute.template.md` | `operators/*/execute.md` | title; Single job, free law sections, Sequence with the step table, free, Resume execution, Mandatory attacks |
| `output.template.md` | `operators/*/output.md` | title; one `<State> receipt` section, free, Blocked receipt, Failure codes, Cross-field invariants, Practical outcomes |
| `ui-composition.template.md` | `knowledge/ui/composition/*.md` | title; only rule sections `PREFIX-n — …`, each with one `Case \| When \| Decide` table; closing section |
| `ui-presentation.template.md` | `knowledge/ui/presentation/*.md` | title; Scale or Catalog, Owner with its table, free frame sections, rules with one `Case \| When \| Owner \| Render` table; closing section |
| `ui-proof.template.md` | `knowledge/ui/proof/*.md` | title; only rule sections, each with one `Case \| When \| Observe` table; closing section |
| `grammars.template.md` | `knowledge/grammars/*/*.md` | title; any sections; every rule section carries one `Case \| Rule \| Common owner \| Core realization` table |
| `patterns.template.md` | `knowledge/patterns/*/*.md` | title; any sections; every rule section carries one `Case \| When \| Write` table |

## Contract vocabulary

- `applies`: globs relative to `.claude`; `*` stays inside one path segment. `INDEX.md` files are never
  claimed: they are reading indexes, not documents of a kind.
- `title`: a regular expression the first line must match, one per language.
- `sections`: the ordered `##` headings a document must carry. `{ "free": true }` marks a zone where a
  document may add its own sections; outside a free zone an extra section is an error. A section may
  carry `table`, the exact header row that must open it.
- `rules`: `heading` is the regular expression of a rule section, `table` the one header row each rule
  must carry (exactly one table per rule), `closing` the section that must come last, `required`
  whether the document must publish at least one rule. Rule and closing headings are excluded from
  the `sections` walk.
- Every `.md` a template claims must have a same-stem `.vi.md`, checked against the `vi` form of the
  same contract. The mirror is a human reading copy, never runtime authority.

## Changing a template

Change the contract, run `node scripts/validate-templates.mjs`, and bring every document it names
into conformance in the same commit. A template that the tree does not satisfy is not published.
`scripts/validate-templates.spec.mjs` proves the validator itself on a synthetic tree: conforming
documents pass, and a missing section, a wrong order, a wrong table header, an extra table under a
rule, and a missing mirror each fail with the line that names them.
