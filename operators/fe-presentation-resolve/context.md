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
