# best-belief source

## Definition

A best-belief source is the strongest available evidence for one specific design claim. It is not
the file nearest to the code, the newest comment or one universal source-of-truth ranking. Product
direction, business capability, interaction grammar, reusable implementation and visual parity are
different questions; each has a different authoritative source.

The belief is provisional but accountable: record the claim, the source that supports it, competing
evidence and the consequence for the design. Replace it when stronger evidence appears instead of
quietly preserving an obsolete assumption.

Use this question to select a source: **what kind of truth is this claim trying to establish?**

| Claim kind | Best-belief source | What it may decide |
|---|---|---|
| Product intent | Current user instruction and accepted product decision | User job, priority, CTA and deliberate change |
| Business truth | Backend domain/application behavior, tests, API schema and seeded data | Available capability, invariant, state transition and honest data |
| UI grammar | FE canon, contract registry and the contract's `why` | Admitted content, relationship, repetition and resting shape |
| Reuse | Existing component source, public props, tests and rendered states | Whether a component already owns the required shape and behavior |
| Migration parity | Named legacy source plus its rendered output at the target viewport | Copy, order, density, spacing, state and interaction baseline |
| Vendor mechanics | Official vendor documentation and the repository shell | Supported mechanics and the boundary that contains them |
| New possibility | Relevant external research after product inspection | A principle to test, never an imported product truth |

## Rules

**BELIEF-1 · Select authority by claim kind, not by a single global ranking.**

Backend code can prove that a weekly goal exists but cannot decide that it visually leads a page.
A contract `why` can prove why slots belong together but cannot prove that the API supplies their
values. Use each source only inside the authority it actually owns.

**BELIEF-2 · Business design begins with executable backend behavior.**

Read the domain model, application use case, authorization, API contract, tests and realistic seed
data that participate in the journey. A DTO alone shows transport shape; it does not prove the
invariant, permission, lifecycle or user outcome behind the field.

**BELIEF-3 · Read `contract.why` before proposing shape or vocabulary.**

The `why` explains the UX relationship that justified a contract. Then inspect every component that
implements or consumes it. Reuse the component only when its ownership, public inputs, states and
behavior also match; otherwise reuse the contract or reject both with a recorded reason.

**BELIEF-4 · Build a reuse inventory before inventing a component.**

For each plausible contract and component, record `candidate`, `why match`, `behavior match`,
`state match` and the verdict `reuse`, `extend` or `reject`. Similar CSS is not a match, and an
existing component is not mandatory merely because it uses the desired contract.

**BELIEF-5 · Triangulate consequential claims.**

A region that affects navigation, payment, identity, progress, permissions or irreversible action
needs at least executable business evidence and one product-facing source such as accepted copy,
an existing journey or a user decision. When those disagree, stop the design decision and record
the conflict instead of averaging them.

**BELIEF-6 · Absence of evidence is an unknown, not permission to invent.**

If no backend behavior supports a populated state, use an honest empty state or a clearly labelled
design fixture. If no contract explains a relationship, propose a contract with evidence; do not
hide the relationship in page markup.

**BELIEF-7 · Every chosen belief remains traceable through implementation.**

The design record names the claim, source path or rendered reference, confidence, conflict and
decision. Tests verify executable truths; browser comparison verifies visual truths. A prose claim
without the matching form of proof is not settled.

**BELIEF-8 · UI-enabling backend changes expose existing truth; they do not create new truth.**

A design may propose a small additive query, projection, mutation or subscription when executable
backend behavior, authorization and data/events already establish the capability. The proposal must
be backward-compatible and bounded to named UI states or actions. New invariants, permissions,
aggregate transitions, durable state, event production, transport lifecycle, delivery guarantees,
payment/identity behavior or irreversible actions require separate backend design and approval.
“Realtime” does not prove WebSocket is necessary, and “quick access” does not weaken safeguards.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Treat frontend mock data as a backend capability | Convincing pixels become a false product promise | Verify the use case/API or label the data as a fixture |
| Let an API schema dictate page hierarchy | Transport shape does not express the user's next valuable action | Combine business truth with the brief and CTA hierarchy |
| Reuse a component because its classes look similar | Visual coincidence ignores ownership, behavior and states | Compare contract `why`, props, states and actions |
| Treat `contract.why` as proof that data exists | The contract owns presentation grammar, not business reality | Verify backend behavior and seed data separately |
| Let current implementation overrule a named migration reference | Existing drift would reproduce itself as intended design | Measure the legacy render and record the discrepancy |
| Resolve conflicting sources silently | Reviewers cannot tell which truth was discarded | Record both sources, scope the conflict and obtain or derive stronger evidence |
| Cite external inspiration as product evidence | Another product cannot establish StarCi behavior | Extract a principle and test it against StarCi evidence |
| Treat a desired UI as permission to invent backend behavior | A convincing interaction can silently change domain truth or authorization | Reuse existing behavior, propose a bounded additive enabler, or route to separate backend design |

## Examples

### Reusing an existing contract and component

```
claim: daily quests are repeated peers inside one joined surface
business source: quest query and application tests return an ordered collection
grammar source: daily-quest-list.why says rows are peers of one joined list
reuse source: SurfaceListCard accepts the contract, inert row data and loading state required here
verdict: reuse SurfaceListCard and the existing contract
```

```
claim: release notes should use daily-quest-list because both screens show divided rows
business source: none inspected
grammar source: class names look similar
verdict: reuse SurfaceListCard
```

They differ in one thing: whether reuse follows matching business, grammar and component evidence
or only visual resemblance.

### Resolving different authorities

```
backend proves: six weekly goal categories and their progress values exist
contract why proves: the six peers form a bordered two-column grid
legacy render proves: the grid follows the weekly summary inside one surface
design consequence: preserve all three truths; none of the sources replaces another
```

```
backend returns six fields, therefore render six unrelated cards in response order
```

They differ in one thing: whether each source decides only the question it owns.
