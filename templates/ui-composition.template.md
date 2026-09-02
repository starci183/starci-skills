# <Topic> composition

One or two paragraphs: what this topic decides before any tree exists, and which operator reads it
(`fe.direction.decide`).

## PREFIX-1 — <what the rule governs>

One line naming what the rule governs.

| Case | When | Decide |
| --- | --- | --- |
| Case 1 | The concrete situation that reaches this rule. | What the direction must settle, in language the product can read. |

Not this rule: <condition> is PREFIX-n.

## What this file does not decide

Links to the sibling topics and to the presentation or proof knowledge that owns the neighbouring
decisions.

```json template-contract
{
  "kind": "ui-composition",
  "applies": ["knowledge/ui/composition/*.md"],
  "title": { "en": "^# [A-Z][A-Za-z ]+ composition$", "vi": "^# [A-Z][A-Za-z ]+ composition$" },
  "sections": [{ "free": true }],
  "rules": {
    "heading": "^## [A-Z][A-Z0-9-]*-\\d+ — .+$",
    "table": { "en": "| Case | When | Decide |", "vi": "| Case | Dùng khi | Chốt |" },
    "closing": { "en": "^## What this file does not decide$", "vi": "^## File này không quyết định$" },
    "required": true
  }
}
```
