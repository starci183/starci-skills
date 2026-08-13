# design mode

## Definition

Design mode decides what authority a reference has. In migration mode the reference is the product
contract to preserve. In creative mode references are evidence and prior art, while the current
product goal, data and canon decide the result.

The deciding question: **did the user ask to preserve an existing experience, or to discover a new
one?**

## Rules

**MODE-1 · Words of preservation select migration mode.**

“Fork”, “port”, “migrate”, “same as”, “keep it unchanged” and a named legacy screen make its real
source, assets, behavior and computed render authoritative. Screenshots help locate evidence but do
not replace reading the source.

**MODE-2 · Words of invention select creative mode.**

“Create”, “explore”, “redesign”, “new page” and “propose” permit new hierarchy and composition, but
only inside canon and only from product evidence.

**MODE-3 · Mixed requests produce two consecutive deliverables.**

First establish a parity baseline that can be compared with the reference. Then produce a separately
named redesign proposal. Never interleave the two in one patch because every difference becomes
ambiguous.

**MODE-4 · Ambiguity defaults to preservation where a reference exists.**

A reversible proposal can follow; an invented implementation can destroy the baseline needed to
judge it. When no reference exists, default to creative mode and make assumptions visible in the
brief.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Use a screenshot as the only migration source when code exists | It hides semantics, responsive branches and state tokens | Inspect source, behavior and computed output |
| Treat legacy as binding in creative mode | Old structure can prevent solving the newly stated job | Preserve product facts; challenge composition |
| Improve a migration silently | The change cannot be reviewed as parity or redesign | Mark and separate the proposal |
| Ask the user to classify an obvious request | The request already supplies the mode | Infer it and state the classification briefly |

## Examples

### The same reference, different authority

```
migration: the legacy double navbar fixes its primitive roles, layers and tokens
```

```
creative: the legacy double navbar is one candidate for preserving global and local navigation
```

They differ in one thing: whether the reference is the answer or evidence toward an answer.

