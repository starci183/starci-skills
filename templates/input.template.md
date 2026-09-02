# Input for `<operator.id>`

## Envelope

`schemaVersion`, `operatorId`, and the two top-level objects `context` and `input`, with the rule
that nothing outside `input.schema.json` is accepted.

## Context bindings

What `context.*` must bind: each ref with its fingerprint and, where it is source, its head. State
which bindings may be empty and which never may.

## <Input section, optional, repeatable>

One `input.*` group per section: what it declares, and the semantic rule `validate-input.mjs`
enforces on it.

## Resume input

What `input.resume` must add for a resume to be accepted, and that a resume adding nothing is
`NO_PROGRESS`.

```json template-contract
{
  "kind": "input",
  "applies": ["operators/*/input.md"],
  "title": { "en": "^# Input for `[a-z.]+`$", "vi": "^# Input cho `[a-z.]+`$" },
  "sections": [
    { "en": "^## Envelope$", "vi": "^## Vỏ ngoài$" },
    { "en": "^## Context bindings$", "vi": "^## Các binding context$" },
    { "free": true },
    { "en": "^## Resume input$", "vi": "^## Input khi resume$" }
  ],
  "rules": null
}
```
