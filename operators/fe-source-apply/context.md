# Context for `fe.source.apply`

## Purpose

Context is the exact material already available to write one resolved tree into product source. It
answers "what may this operator read?" before the first byte is written. Context never expands
mission scope and never turns evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Resolution receipt | The finished decisions: every node, property, owner, rule, and class. | Required. The only source of values this operator may write. |
| Resolved tree | The artifact the receipt describes, bound by its own fingerprint. | Required. The literal content being carried into source. |
| Frontend source | The routed checkout and its head. | Required evidence that the write lands on the frozen source. |
| Direction receipt | The approved direction the resolution implements. | Evidence of intent. Never a source of values. |
| Owner audit | Prior findings for the same owner. | Evidence and regression history. |

## Required context

Every invocation requires:

1. one resolution receipt with its fingerprint, resolved tree reference, contract emission mode, the
   complete class inventory it published, and the complete list of rule identifiers it applied;
2. the routed frontend source reference whose head equals `input.project.sourceHead`.

`context.directionRefs` and `context.auditRefs` are evidence and may be empty.

## The resolution is the value inventory

`context.resolution.classNames` is the complete, frozen list of class strings this operator may write,
and `context.resolution.appliedRuleIds` is the complete list of identifiers it may carry into a
contract attribute. Neither is a hint, and neither is a subset.

A class the write would produce that the resolution does not contain is `WRITE_REJECTED`. There is no
rounding, no nearby value, and no copying from a neighbouring file: this operator has no way to decide
a value, so a value it cannot find is a value that does not exist yet.

`input.resolution` repeats the receipt reference and fingerprint the caller believes it bound. It must
equal `context.resolution`. A caller that names one receipt and binds another is `RESOLUTION_STALE`
before any file is opened.

## Owner ceiling

`input.scope.mutableOwners` names each owner that may be written and the exact root path it owns.
`input.scope.observationOnlyOwnerRefs` names the owners that may be read and never written. The two
sets are disjoint and the target owner is mutable.

A path is inside the ceiling only when it lies under the root of the owner that declares it. Owner
membership alone is not enough, because a mutable owner ref attached to a path outside its own root is
exactly how a write escapes the ceiling while still looking authorised.

## Boundary

Context is read-only. This operator is the single mutation boundary of the frontend pipeline: it is
the only operator that writes product source, and it writes nothing else. It does not decide values,
choose components, restructure the tree, edit knowledge, publish Grammar, run a service, or record a
verdict on what it wrote.
