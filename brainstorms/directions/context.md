# Directions

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@direction-schema` | `brainstorms/directions/schema.json` | file | Defines the only direction artifact this module may return. |
| `@visual-vocabulary-schema` | `brainstorms/directions/vocabulary.schema.json` | file | Defines the live token inventory used to judge reuse and new verdicts. |
| `@artifact-validator` | `scripts/validate-artifact.mjs` | script | Enforces batch diversity and token provenance before selection. |

You are given a product request and the frontend's live visual vocabulary, and return **3–4 visual
directions** with one evidence-backed recommendation. A direction decides the intended relationship between
semantic roles and tokens. It does not decide layout, block anatomy, or a class.

## Law

Visual taste is a product decision. The machine can refuse an invented token, a duplicated option, or
a recommendation that cannot be traced to evidence; it cannot declare one valid option beautiful. This
stage selects one exact object as a provisional recommendation so structural design can continue without
a separate owner checkpoint. The owner approves or challenges that direction only when it is embedded in
the later layout candidate under the single layout hash.

External style libraries are recommendation sources only. A recommendation becomes a candidate only
after it is expressed through this project's vocabulary or names every new token it would require.
When the routed grammar emits a visual contract, its axes, role tokens and exact values are fixed input,
not a candidate axis. Every direction carries the same `lockedTokens`; only composition may vary.

## Inputs

| # | Input | Without it |
|---|---|---|
| 1 | Request, audience, task and desired feeling | decoration replaces product intent |
| 2 | Generated inventory of CSS custom properties | a candidate names values the product cannot express |
| 3 | Approved screens and brand evidence for this project | the product's own visual history is ignored |
| 4 | Vendor design-system guidance already used by the frontend | component semantics and visual intent disagree |
| 5 | The closed direction axes | four names conceal one visual choice |
| 6 | Accepted direction precedents and their rejections | rejected taste returns under a new label |

Public catalogues, named styles, palettes and font pairings may widen the search. They never outrank
the six inputs and are never copied into the tree as canon.

## Reading the evidence

1. State the audience, task and intended feeling in one sentence each. Refuse when the request gives
   no basis for any of them.
2. Inventory the live vocabulary and record its content digest as `vocabularyAt` inside every direction.
   A `reuse` token must occur in that inventory; a `new` token must not.
3. Read accepted screens as evidence, not as a command to repeat them. Record what was accepted and
   what the new surface needs differently.
4. Choose axis sets before naming directions. Two identical sets are one direction; two different axis
   labels backed by identical role-to-token decisions are also one direction because they render alike.
5. Map every semantic role to one token decision. A new token carries the reason the current vocabulary
   cannot answer.
6. Name what each direction rejects. A direction with no boundary is an adjective, not a decision.

## Direction axes

| Axis | Values |
|---|---|
| contrast | soft / balanced / strong |
| density | compact / balanced / spacious |
| shape | square / soft / rounded |
| depth | flat / layered / floating |
| motion | still / measured / expressive |

The values are comparative, not CSS. Exact expression lives in the role-to-token mapping beside them.

## Semantic roles

Every direction resolves the same thirteen roles: `ground`, `surface`, `content`, `mutedContent`,
`accent`, `separator`, `display`, `body`, `label`, `radius`, `elevation`, `duration`, and `easing`.

A role has exactly one verdict:

| Verdict | Meaning | Evidence owed |
|---|---|---|
| `reuse` | the named custom property exists in the inventory | the inventory occurrence |
| `new` | no current property answers this role | the proposed property, exact CSS value and why it is necessary |
| `none` | an optional radius, elevation or motion role is deliberately absent | why absence is part of the direction |

A reused token name is anchored to the source state in `vocabularyAt`. A new token carries its exact
CSS value because the preview and the later layout hash must bind to the same decision. Utility classes, font downloads
and copied vendor variables remain outside this artifact; a dependency installation needs its own
approval.

## Rules

1. A direction carries no class. A raw visual value appears only inside a `new` token decision or the grammar-owned `lockedTokens` map.
2. Every direction carries the inventory digest as `vocabularyAt`; every `reuse` token exists there and every `new` token is absent.
3. Every direction maps all thirteen roles; `none` is legal only for radius, elevation, duration and easing.
4. Every direction names three to five personality words and one to five explicit rejections.
5. No two directions in a batch share their whole axis set or their whole role-to-token mapping.
6. At least one direction departs from the nearest precedent when a precedent exists.
7. Return fewer than three only when the evidence permits fewer, and state why; never pad a batch.
8. Feedback opens a new round. An accepted direction is never edited in place.
9. Every schema-2 batch recommends exactly one candidate and states the evidence-backed reason.
10. A grammar visual contract is copied byte-for-byte into `lockedTokens`; changing its axes, role token or value refuses the direction.

## Preview

Render every candidate against the **same reference surface and content**: navigation, heading, body
text, action, form control, repeated row, bounded surface, overlay, and settled failure. The preview
may resolve tokens from the inventory, but it must not introduce a value absent from the JSON decision.

Equal content is the control. Changing layout or copy between candidates makes the owner compare two
products rather than two directions. The HTML is disposable evidence; approval binds to JSON.

## Refusal

Refuse when the audience or intended feeling is absent, brand evidence conflicts without an owner
ruling, the live vocabulary cannot be inventoried, or a required visual value has no token and nobody
has authorised a new one. Return the missing decision and the roles it blocks.

## Output

The output is JSON validated by `@direction-schema`. New runs write `schema: 2`, including
`recommended.id` and its evidence-backed reason, then validate against both the schema and the generated
vocabulary before structural design:

```bash
node @artifact-validator \
  --schema @direction-schema \
  --data <batch.json> --vocabulary <visual-vocabulary.json>
```

The direction round has no approval hash and no separate owner checkpoint. The recommended direction
object is copied unchanged into every layout candidate in the same layout round, where one `OK` on the
layout hash approves visual intent and skeleton together.
The vocabulary snapshot conforms to `@visual-vocabulary-schema`.
