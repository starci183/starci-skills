# StarCi Core — <Topic>

One or two paragraphs: which universal rules this file maps onto the live Core family, and that
every owner named below is read from `packages/grammar/src`.

## <Section, optional, repeatable>

Prose sections are allowed: family DNA, consumption, the component matrix, states. A file that
publishes rules follows the rule shape below for each of them.

## PREFIX-1 — <what the rule governs>

One line: the universal meaning of the rule.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | The situation. | The exact Common renderer, slot, or prop. | What Core does for it, or `gap` with one clause on what is missing. |

Source: `packages/grammar/src/…`

```json template-contract
{
  "kind": "grammars",
  "applies": ["knowledge/grammars/*/*.md"],
  "title": { "en": "^# .+$", "vi": "^# .+$" },
  "sections": [{ "free": true }],
  "rules": {
    "heading": "^## [A-Z][A-Z0-9-]*-\\d+ — .+$",
    "table": { "en": "| Case | Rule | Common owner | Core realization |", "vi": "| Case | Luật | Owner của Common | Core hiện thực |" },
    "closing": null,
    "required": false
  }
}
```
