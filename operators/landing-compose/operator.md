# landing.compose

## Job

Compose one landing-page contract from the business promise, Grammar family and visual identity:
decide Grammar adoption, section storytelling, asset medium, motion and audit evidence without
writing source or generating assets.

## Done when

Done when the `landing-composition` binds one credible promise and one canonical identity, assigns
Grammar or custom ownership to every planned element, orders a visual event for every section,
chooses ImageGen, SVG, code-native or existing media for every asset slot, gives every motion a
static reduced-motion state and performance budget, and hands source ownership only to
`interface.generate` and evidence ownership only to `interface.audit`.

## One contract before one source writer

A landing page is a sequence, not a decorated screen. Its sections must make one promise credible
in reading order, and every visual must either advance that argument or leave. This operator sees
the sequence whole and writes the contract once. It never writes application source, generates a
final bitmap, assembles an SVG or starts a preview. `interface.generate` remains the only operator
that implements and commits the frontend tree.

The split is deliberate. Composition decides what a section must communicate, which parts the
Grammar owns, what medium an asset needs and what motion means. Generation decides files, component
structure and concrete implementation under that contract. Audit observes the rendered result and
judges the evidence; it does not redesign the page while measuring it.

## Identity is evidence, not a style adjective

The visual identity names a canonical asset, a versioned brand system or an explicit description
precise enough to reject a lookalike. A request that says only “premium”, “AI-native” or another
style adjective stops with `VISUAL_IDENTITY_MISSING`. An ImageGen decision preserves the named
identity and changes only the scene or rendering medium that the brief authorizes. A code-native or
SVG decision is used for responsive diagrams, paths and semantic labels that must remain inspectable.

## Grammar adoption is explicit

The adoption matrix records each landing element as `grammar` or `custom`. Text, actions, status,
icons and semantic values bind the published family wherever it owns them. A custom row must state
the narrative reason the element lies outside that ownership; “more visual” is not a reason. Custom
composition may arrange Grammar primitives, but it never reconstructs a published composite.

## Motion has a static truth

Every choreography row names its trigger, ordered visual change, reduced-motion state and budget.
Reduced motion shows the complete final meaning immediately and removes non-essential drift,
parallax and stagger. Performance budgets constrain asset weight, layout stability, observers and
animated properties before implementation. The audit contract makes visual storytelling, motion,
reduced motion and performance observable rather than leaving them as taste claims.

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: the composition,
knowledge binding artifacts when emitted and `response.json`. It writes no routed source, makes no
commit, generates no final image, renders no candidate, starts no server and publishes no Grammar.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@grammar/core` | the published Grammar catalog and owned relationships the adoption matrix may bind | yes |
| `@knowledge/grammars/<family>` | the exact family identity, idioms and playbook the landing must preserve | yes |
| `@knowledge/ui/composition` | composition rules that govern hierarchy, sequence and responsive structure | yes |
| `@knowledge/ui/presentation` | semantic presentation tokens and ownership boundaries | yes |
| `@knowledge/ui/proof` | proof rules used to make the audit contract observable | yes |
| `@workspaces/fe` | the routed frontend at the frozen head, read as current evidence only | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; the promise the landing must make credible | no |
| `surface-map` | `interface.plan`; the planned landing unit and shared shell when present | no |
| `knowledge-repair-receipt` | `knowledge.repair`, when this is a retry with a rebound manifest | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `surface` | id | — | The landing route or unit this contract composes |
| `promise` | text | null | The concrete promise when no business-promise-authority input is bound |
| `visualIdentity` | list | — | Canonical assets, brand system refs or explicit identity constraints |
| `references` | list | [] | Visual or product references and exactly what may be borrowed from each |
| `motionLevel` | choice | restrained | none, restrained or theatrical; all retain a static reduced-motion truth |
| `resume` | token | null | The blocked branch token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, resume and frozen evidence | `resume` | `request/request.json`, @workspaces/fe when bound, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the business promise, using authority before request prose | `promise` | input `business-promise-authority`, `request/request.json` | — | `LANDING_PROMISE_MISSING` |
| 3 | Bind the canonical identity and the exact family knowledge | `visualIdentity` | @knowledge/grammars/<family>, the identity refs | `knowledge-coverage`, `family-understanding`, or `knowledge-question` | `VISUAL_IDENTITY_MISSING`, `EVIDENCE_MISSING`, `KNOWLEDGE_QUESTION` |
| 4 | Assign Grammar or custom ownership to every planned element | — | @grammar/core, @knowledge/ui/composition, @knowledge/ui/presentation, input `surface-map` when present | — | `COMPOSITION_INCOMPLETE` |
| 5 | Order the section storyboard so every section advances the promise | `references` | the promise, identity, current source and bounded references | — | `COMPOSITION_INCOMPLETE` |
| 6 | Choose each asset medium and write its identity-preserving brief | — | storyboard, identity evidence, @tools/websearch only for a named referent | — | `COMPOSITION_INCOMPLETE` |
| 7 | Specify motion, static reduced-motion truth, performance budgets and audit evidence | `motionLevel` | storyboard, @knowledge/ui/proof | — | `COMPOSITION_INCOMPLETE` |
| 8 | Emit the read-only handoff for the named surface | `surface` | everything above | `landing-composition`, `response/response.json` | — |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `landing-composition` | `response/response.md` | md | yes |
| `knowledge-coverage` | `response/data/knowledge-coverage.json` | data | no |
| `family-understanding` | `response/data/family-understanding.json` | data | no |
| `knowledge-question` | `response/data/knowledge-question.json` | data | no |

## Operator Result

For a successful composition, `outcome.primary` points to the declared `landing-composition` so the
person can inspect the full sequence and ownership handoff before any source is written.

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `LANDING_PROMISE_MISSING` | terminate |
| `VISUAL_IDENTITY_MISSING` | terminate |
| `COMPOSITION_INCOMPLETE` | terminate |
| `NO_PROGRESS` | terminate |
| `KNOWLEDGE_QUESTION` | terminate |

## Next

| When | Operator |
| --- | --- |
| the composition contract is complete and source must be implemented | `interface.draw` |
| bound knowledge conflicts with validated identity or reference evidence | `knowledge.repair` |
| no owned business promise exists for the landing | `business.decide` |
