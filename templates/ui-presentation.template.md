# <Topic> presentation

One or two paragraphs: which CSS property family this topic resolves on app-owned boundaries, and
that `frontend.presentation.resolve` reads it.

## Scale

For a topic with a closed value ramp. One table mapping rule to class to value, naming the classes
outside the scale. A topic without a ramp uses `## Catalog` instead.

| Rule | Class | Value | Common token |
| --- | --- | --- | --- |

## Owner

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The container belongs to the application | The class |
| A component name | Common already applies the value inside that component | Nothing. Pass the prop |
| `—` | Common exposes no public path for this relationship | The class, recorded as a workaround |

## <Frame section, optional, repeatable>

`<Topic> Common already owns`, `Axis variants`, and other topic frame sections.

## PREFIX-1 — `<class>` / `<value>`

One line naming the relationship that resolves to this value.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | The observable condition of the rendered tree. | `App`, a component name, or `—` | The exact class or the component prop that carries it. |

Not this rule: <condition> is PREFIX-n.

## What this file does not decide

Links to the sibling presentation topics and to the composition knowledge that made the decision.

```json template-contract
{
  "kind": "ui-presentation",
  "applies": ["knowledge/ui/presentation/*.md"],
  "title": { "en": "^# [A-Z][A-Za-z ]+ presentation$", "vi": "^# [A-Z][A-Za-z ]+ presentation$" },
  "sections": [
    { "en": "^## (Scale|Catalog)$", "vi": "^## (Thang giá trị|Danh mục)$" },
    { "en": "^## Owner$", "vi": "^## Owner$", "table": { "en": "| Owner | Meaning | Application writes |", "vi": "| Owner | Nghĩa | Ứng dụng viết |" } },
    { "free": true }
  ],
  "rules": {
    "heading": "^## [A-Z][A-Z0-9-]*-(\\d+|AUTO) — .+$",
    "table": { "en": "| Case | When | Owner | Render |", "vi": "| Case | Dùng khi | Owner | Render |" },
    "closing": { "en": "^## What this file does not decide$", "vi": "^## File này không quyết định$" },
    "required": true
  }
}
```
