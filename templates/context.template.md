# Context for `<operator.id>`

## Purpose

One paragraph: what this operator exists to decide or produce, and what it must never do.

## Context classes

| Class | What it is | Why it is bound |
| --- | --- | --- |
| <name> | <the artifact or source, by path or ref> | <required or optional, and what it decides> |

## Required context

The exact refs, fingerprints, and heads the input must bind before the operator may start.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@<alias>/<params>` | `<location from refs.json, code-spanned so placeholders render>` | how it is fingerprinted | Required or Optional · static or dynamic: purpose |

## <Law section, optional, repeatable>

A boundary or ownership law specific to this operator, stated as an enforced rule with its reason.

## Boundary

What context is read-only, what the operator may write, and what it never touches.

## Resources

Generated from `operator.json` → `resources`: the one profile, its model and runtime, the grants
required, and the three standing answers (web search, Grammar binding, image generation).

```json template-contract
{
  "kind": "context",
  "applies": ["operators/*/context.md"],
  "title": { "en": "^# Context for `[a-z.]+`$", "vi": "^# Context cho `[a-z.]+`$" },
  "sections": [
    { "en": "^## Purpose$", "vi": "^## Mục đích$" },
    { "en": "^## Context classes$", "vi": "^## Các lớp context$" },
    { "en": "^## Required context$", "vi": "^## Context bắt buộc$" },
    { "en": "^## Refs$", "vi": "^## Ref$", "table": { "en": "| Alias | Resolves to | Bind | Required |", "vi": "| Alias | Trỏ tới | Bind | Bắt buộc |" } },
    { "free": true },
    { "en": "^## Boundary$", "vi": "^## Ranh giới$" },
    { "en": "^## Resources$", "vi": "^## Tài nguyên$" }
  ],
  "rules": null
}
```
