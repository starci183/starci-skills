# design critique

## Definition

Design critique is an adversarial attempt to disprove a direction before implementation makes it
expensive. It tests product logic, hierarchy, semantics, states and contract honesty against
evidence, then gives a concrete repair or rejects the direction.

The deciding question: **what observable user or system failure would this decision cause, and what
evidence supports that prediction?**

## Rules

**CRITIQUE-1 · Attack the decision, never the author.**

Name the claim, evidence, likely failure and alternative. “It feels wrong” cannot be acted on;
“this secondary action occupies the sole heading anchor and competes with the primary” can.

**CRITIQUE-2 · Run the product challenge first.**

Ask whether the primary CTA serves the core loop, whether every region earns its place, whether copy
names outcomes, whether the page has a path onward and whether any fixture implies unsupported
product behavior.

**CRITIQUE-3 · Run the architecture challenge second.**

Ask whether every structural node has one owner, contracts tell the truth about children, repeated
content is typed honestly, shells own vendor mechanics, blocks own product behavior, handlers remain
in `on`, and data carries no component or function.

**CRITIQUE-4 · Run the rendered challenge third.**

Ask whether hierarchy survives real copy, loading preserves geometry, empty and failed states are
honest, keyboard semantics match appearance, responsive order keeps meaning, and surfaces or icons
have been added without a grouping or recognition job.

**CRITIQUE-5 · Every criticism ends in a verdict.**

Use keep, revise or reject, followed by the smallest change that resolves the evidence. Endless
commentary without a decision only delays implementation.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Reject because a direction is unfamiliar | Novelty is not evidence of failure | Test it against the brief and states |
| Approve because it looks polished | Polish can hide a weak CTA or false grouping | Challenge product and architecture first |
| Criticize without an alternative | The team cannot distinguish a defect from preference | State the smallest viable repair |
| Add a new surface or icon as the default repair | Decoration often masks hierarchy problems | Repair order, copy, grouping or disclosure first |
| Let passing types end the critique | Types do not inspect rendered hierarchy | Test the browser and state matrix |

## Examples

### Evidence-bearing critique

```
revise: the retry control sits in the title anchor and outranks the next lesson; move retry to a tertiary path and keep the core-loop action alone
```

```
reject: the header feels busy
```

They differ in one thing: whether the critique identifies a failure and repair.

