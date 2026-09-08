# <Topic> composition

One or two paragraphs: which universal constraint this topic places on a direction receipt, before
any tree exists, and which operator checks it (`interface.generate`). Layout and taste are decided
in `@knowledge/grammars/<family>`; a composition topic only says what the resulting direction must
satisfy.

## PREFIX-1 — <what the rule governs>

One line naming what the rule governs.

| Case | When | Assert |
| --- | --- | --- |
| Case 1 | The concrete situation that reaches this rule. | A falsifiable predicate over the direction receipt or the composed tree, never advice. |

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
    "table": { "en": "| Case | When | Assert |", "vi": "| Case | Dùng khi | Khẳng định |" },
    "closing": { "en": "^## What this file does not decide$", "vi": "^## File này không quyết định$" },
    "required": true
  }
}
```
