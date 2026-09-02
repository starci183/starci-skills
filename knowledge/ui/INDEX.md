# UI knowledge

This tree holds the universal UI law shared by every published Grammar family, split into three
groups by the operator that reads each one.
It owns 118 stable X-n laws (40 in composition, 59 in presentation, 19 in proof), observable
selection conditions, ownership decisions, deterministic verdicts, and audit vectors. It is not an implementation or consumer cookbook. It does not own business facts, page copy,
routes, permissions, artwork identity, product effects, or family material choices.

## Runtime policy

- Canonical agent/runtime knowledge is the English `.md` file only.
- Same-stem `.vi.md` files are complete human-review mirrors. Never load, index, or cite them as runtime
  authority.
- Grammar operators resolve the smallest relevant canonical file and rule ID. Individual files omit
  per-topic routing metadata.
- Rule IDs are stable public knowledge addresses. Append the next sequential `PREFIX-n`; never
  renumber, reuse, or silently change the meaning of an existing ID.
- Knowledge owns invariant decisions and audit vectors, not implementation status, migration plans,
  workflows, operator DAGs, or task orchestration. Current capability/debt belongs in plans and audits.

## Grammar binding

`@starci/grammar/common` is the public authority for props, semantics, renderer anatomy, state,
accessibility, composition, and universal implementation. A family-selected application imports
exactly the selected family stylesheet; that stylesheet imports Common. Direct
`@starci/grammar/common/styles.css` consumption is reserved for intentional familyless Common usage
and isolated test harnesses. An application must not import both paths for the same rendered tree.

A visual family is a props-compatible scoped overlay declared through `defineGrammarFamily`. It may
replace a known Common renderer with the exact compatible props or add a non-colliding extension;
its stylesheet is scoped by `data-grammar-family`. It must preserve Common meaning, state behavior,
accessibility, ownership, and substitutability.

Business/application code selects one family and supplies domain content, data, permissions,
handlers, and verified state. Application CSS may own page canvas, product layout/content/media, and
placement through public extension points. It must not reach through, rebuild, or override Common-owned
anatomy, spacing, semantics, state, focus, or variants. Family documents record overlay choices and conformance
evidence; they never duplicate or redefine these universal laws. A missing reusable capability is a
Common gap, not permission for product-local anatomy or a family-specific universal rule.

## Groups

A topic lives with the operator that reads it. A topic no operator reads has no reason to exist.

| Group | Decides | Read by |
| --- | --- | --- |
| [`composition/`](composition/INDEX.md) | What the tree must contain, before it exists | `fe.direction.decide` |
| [`presentation/`](presentation/INDEX.md) | Which CSS value an app-owned boundary takes | `fe.presentation.resolve` |
| [`proof/`](proof/INDEX.md) | What only becomes true once rendered | `fe.surface.audit` |

The test that places a topic is whether reading source answers it. A spacing value is readable from a
class, so it is presentation. The number of dominant actions is settled before any tree exists, so it
is composition. Whether keyboard order matches visual order needs a running page, so it is proof.

Code conventions for the source that produces all of this live in [`patterns/`](../patterns/fe/INDEX.md).
Family realization lives in [`grammars/`](../grammars/starci/INDEX.md).

## Rule binding architecture

Knowledge defines what a rule means; it does not hard-code which current DOM instance passes it. A
Common reusable exposes stable component, slot, and relationship anchors. A co-located or generated
binding registry maps those anchors to rules with at least:

- a stable binding ID and version;
- `ruleId`;
- exact target slot or between-slot relationship;
- the `when` variant, state, or composition selector;
- the expected owner anchor.

The registry never duplicates the rule's metric or behavior. Applications do not hand-author rule
arrays, and no markup can label itself as passing. The auditor resolves bindings from stable DOM
anchors, collects rendered evidence, and records rule IDs and findings in the audit result. Unknown
rule IDs, missing slots, stale anchors, and orphan bindings fail validation. DOM outside a registered
reusable may be selected by semantic inspection, but it cannot receive `PASS` without the same owner
and runtime evidence.

A contract claim is the one exception, and it is not a self-assessment. A rule-binding operator may
emit `data-contract` on a node it resolved, as a space-separated list of the identifiers that node
claims to satisfy. The claim states an intention so the auditor can contradict it: a node claiming
`GAP-4` while the computed gap is `1.5rem` is a finding, a node carrying spacing that claims nothing
is an unowned value, and a claimed identifier absent from published knowledge fails validation. A
claim never carries a verdict, score, or `PASS`, and a hand-written one is invalid because only the
operator's receipt makes it verifiable. Grammar emits the same claim on the elements that realize a
relationship it owns, the rows of each topic's "Common already owns" table, so a Grammar-internal
value is never an unowned value and the resolver never re-claims those nodes. The receipt remains the
durable record, so the attribute may be stripped from a production build without weakening any audit.

## Canonical verdict model

Base verdicts are exactly: `PASS`, `COMMON_CAPABILITY_MISSING`, `COMMON_IMPLEMENTATION_GLITCH`,
`FAMILY_OVERRIDE_GLITCH`, `APP_REIMPLEMENTATION`, `APP_OVERRIDE`, `APP_WORKAROUND`, `PROOF_MISSING`.

Cause tags are exactly: `VALUE_DRIFT`, `VENDOR_LEAK`, `WRONG_OWNER`, `OFF_SCALE_VALUE`,
`DOUBLE_OWNER`, `PHYSICAL_SIDE_DRIFT`, `STATE_OR_VIEWPORT_DRIFT`.

Evaluate capability, isolated Common output, family delta, app delta, then owner/state evidence. One
finding contains one base verdict and zero or more cause tags. Multiple failed layers produce linked
findings; they are not collapsed into a composite base verdict or suppressed by first-match logic.
`PASS` is valid only when no failure finding exists.

