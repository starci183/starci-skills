---
name: <kebab-name>
tier: foundations
admitted: YYYY-MM-DD
---

# <Name>

## Role

One sentence. What this scale governs, and what it does not.

## Source of truth

Where the value actually lives — the CSS variable, the file, the vendor stylesheet. If a scale is
**derived** from one root token, say so and give the multiplier. A scale where every step was
hand-set is a different thing from a scale with one root, and the difference decides whether a new
step can be invented.

## Scale

| Step | Value | Derived as | Means |
|---|---|---|---|
| | | | |

Steps that do **not** follow the derivation get their own row saying so. A step that looks like it
belongs but is set independently is exactly where a wrong assumption starts.

## How steps relate

Only if there is a rule connecting them — concentric nesting, a doubling, a fixed ratio. If steps
are independent, say that instead. "Each step is an independent decision" is a real answer and
stops the next reader inventing a pattern.

## Forbidden

What must not be done with this scale, and what catches it.

| Forbidden | Caught by |
|---|---|
| | |

A line here must be something a machine cannot catch. If a type or a gate catches it, it belongs in
`docs/API-BACKLOG.md` instead — do not restate an enforced rule.

## Read by which axes

Which decision sheets consult this scale. A foundation nobody reads is either dead or undocumented.

## Anchors

Dated incidents, reversed rulings, and the real files the values were read from.
