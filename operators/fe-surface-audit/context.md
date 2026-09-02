# Context for `fe.surface.audit`

## Purpose

Context is the exact material already available to judge one rendered surface. It answers "what may
this operator read?" before the first capture is taken. Context never expands mission scope and never
turns evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Knowledge index | The rule catalog and the detector shape every topic obeys. | Required. Names which topics may be bound. |
| Knowledge topic | One rule family, its prefix, and the exact identifiers it publishes. | Required reusable law. The only source of valid rule identifiers. |
| Application receipt | The applied source head, the contract emission mode, and the claim every node makes. | Required. The stated intention this audit is here to contradict. |
| Frontend source | The routed checkout and its head. | Evidence that the surface under observation is the surface that was applied. |
| Owner audit | Prior findings for the same owner. | Evidence and regression history. |

## Required context

Every invocation requires:

1. the knowledge index plus at least one topic;
2. the application receipt, whose `appliedSourceHead` equals `input.project.sourceHead`;
3. the routed frontend source reference whose head equals `input.project.sourceHead`.

`context.auditRefs` is evidence and may be empty.

## Rule inventory

`context.knowledge.topics[].ruleIds` is the complete, frozen list of identifiers this audit may cite.
It is not a hint and not a subset. Each topic declares its own `rulePrefix`, and every identifier it
publishes must carry that prefix. One identifier belongs to exactly one topic.

Listing an identifier under a topic whose prefix it does not carry, or listing one twice, is invalid
input rather than a warning. Both are how an identifier that no file publishes acquires the appearance
of authority.

A verdict may cite only an identifier inside this inventory. An identifier outside it is
`UNKNOWN_RULE`.

## Claims are the subject, not the authority

`context.applied.claims` carries the `data-contract` claims the resolution published: for each node,
the identifiers that node says it satisfies.

A claim is a stated intention, never evidence of passing. The audit exists precisely to measure the
rendered result and contradict the claim when the two disagree. A node that claims `GAP-4` while the
computed gap measures `1.5rem` is a finding, not a pass, and no amount of claiming changes that.

The claims are also the reason an unclaimed value is detectable at all. A node that renders spacing
and claims nothing has no owner, and that absence is a finding in its own right.

## Runtime is evidence, not authority

The bound runtime endpoint serves the surface. What it renders is the measurement; it is never a rule
and it never overrides published knowledge. A surface that renders consistently wrong is consistently
wrong, and the audit says so.

## Boundary

Context is read-only, and so is this operator. It repairs nothing, restyles nothing, writes no product
source, edits no knowledge, publishes no Grammar, and starts no service. It writes only its capture
evidence and its receipt under `input.project.artifactRootRef`.
