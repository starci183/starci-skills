# <Concern>

One or two paragraphs: which source this catalog was counted from, and the sentence that every
rule cites two real paths.

## PREFIX-1 — <what the rule governs>

One line naming what the rule governs; where the convention is not universal, the count.

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The situation in the source. | The exact form to write, with its real path. |

## Open question <optional>

A convention the source has not settled, left open on purpose.

```json template-contract
{
  "kind": "patterns",
  "applies": ["knowledge/patterns/*/*.md"],
  "title": { "en": "^# .+$", "vi": "^# .+$" },
  "sections": [{ "free": true }],
  "rules": {
    "heading": "^## [A-Z][A-Z0-9-]*-\\d+ — .+$",
    "table": { "en": "| Case | When | Write |", "vi": "| Case | Dùng khi | Viết |" },
    "closing": null,
    "required": true
  }
}
```
