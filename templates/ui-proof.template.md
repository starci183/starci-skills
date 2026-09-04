# <Topic> proof

One or two paragraphs: what only becomes true once the page has rendered, and that
`interface.audit` reads it.

## PREFIX-1 — <what the rule governs>

One line naming what the rule governs.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | The concrete rendered situation that reaches this rule. | The exact runtime evidence, and what seeing it would falsify. |

Not this rule: <condition> is PREFIX-n.

## What this file does not decide

Links to the sibling proof topics and to the composition knowledge that made the decision being
tested.

```json template-contract
{
  "kind": "ui-proof",
  "applies": ["knowledge/ui/proof/*.md"],
  "title": { "en": "^# [A-Z][A-Za-z ]+ proof$", "vi": "^# [A-Z][A-Za-z ]+ proof$" },
  "sections": [],
  "rules": {
    "heading": "^## [A-Z][A-Z0-9-]*-\\d+ — .+$",
    "table": { "en": "| Case | When | Observe |", "vi": "| Case | Dùng khi | Quan sát |" },
    "closing": { "en": "^## What this file does not decide$", "vi": "^## File này không quyết định$" },
    "required": true
  }
}
```
