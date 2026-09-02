# Context for `fe.presentation.resolve`

## Purpose

Context is the exact material already available to resolve presentation. It answers "what may this
operator read?" before the walk begins. Context never expands mission scope and never turns evidence
into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Knowledge index | The presentation catalog and the rule shape every topic obeys. | Required. Names which topics may be bound. |
| Knowledge topic | One presentation property, its closed scale, its cases, and the exact identifiers it publishes. | Required reusable law. The only source of valid rule identifiers. |
| Published Grammar | The package, its manifest, and the relationships its components already own. | Required reusable UI authority. Decides which properties the application must not write. |
| Frontend source | The routed checkout and its head. | Evidence that the tree belongs to the frozen source. |
| Composed tree | The already-decided structure, ordering, and Grammar object selection. | The subject of the invocation, never rewritten. |
| Direction receipt | The approved frontend direction this tree implements. | Evidence of intent. Never a source of presentation values. |
| Owner audit | Prior findings for the same owner. | Evidence and regression history. |

## Required context

Every invocation requires:

1. the knowledge index plus at least one topic;
2. one published Grammar binding;
3. the routed frontend source reference whose head equals `input.project.sourceHead`;
4. the composed tree with its fingerprint and node count.

A topic must be bound for every presentation property the tree actually carries. A property present
without its topic is `KNOWLEDGE_UNBOUND`, because resolving it would mean choosing a value with no
published rule behind it.

## Refs

Every location this operator may read, by alias. `refs.json` at the root of `.claude` resolves each alias;
a location not in this table is unreadable for this operator, and `@artifacts` is the only one it writes.

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@knowledge/ui/presentation/<topic>` | <Source>/.claude/knowledge/<group>/<topic>.md | fingerprint; the rule inventory is the set of `## PREFIX-n` headings of the file | Required: The closed rule inventory; the only source of valid identifiers. |
| `@grammar` | <checkout:starci-academy/fe>/packages/grammar | fingerprint of packages/grammar/package.json (manifestRef) + the checkout head | Required: Which relationships a component already owns. |
| `@source/starci-academy/fe` | <checkout:project/role> | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required: The checkout the composed tree belongs to. |
| `@receipt/fe-direction-decision/<invocationId>` | <@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs) | fingerprint + the sourceHead the receipt binds | Optional: Intent; never a source of presentation values. |
| `@receipt/fe-surface-audit/<invocationId>` | <@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs) | fingerprint + the sourceHead the receipt binds | Optional: Regression history. |
| `@artifacts` | input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/ | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where the resolved tree and the resolution receipt are written. |

## Rule inventory

`context.knowledge.topics[].ruleIds` is the complete, frozen list of identifiers the operator may
emit. It is not a hint and not a subset.

Each identifier must carry the prefix its topic publishes: `GAP-` under gap, `PADDING-` under
padding, `MARGIN-` under margin, `FONT-` under font, `TONE-` under tone, `MEASURE-` under measure,
`FLOW-` under text flow, `OVERFLOW-` under overflow. One identifier belongs to exactly one topic.

Binding an identifier under the wrong topic, or listing one twice, is invalid input rather than a
warning. Both are how an identifier that no file publishes acquires the appearance of authority.

## Grammar ownership

`context.grammar.ownedRelationships` states which component already owns which property, and which
rule that ownership satisfies. Every relationship must name an identifier the bound knowledge
publishes, so Grammar cannot claim a rule that does not exist either.

This list is consulted before any application decision. It is what makes reimplementation impossible
rather than merely discouraged: a property with a component owner never reaches the case matching
step at all.

## Boundary

Context is read-only. The operator writes only the resolved tree and its receipt under
`input.project.artifactRootRef`. It does not edit knowledge, publish Grammar, mutate product source
outside the resolved artifact, or record a verdict on any node.

## Resources

This operator runs end to end on the `sonnet` profile (`claude-sonnet-5`, runtime `claude`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: none. It never searches the web, is bound to published Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
