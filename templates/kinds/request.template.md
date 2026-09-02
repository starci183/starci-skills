# request — <operator.id> step-<N>-<M>

## Context

| Alias | Head |
| --- | --- |
| `@workspaces/be` | `sha` of the frozen checkout, or `—` when the alias has no head |

## Requirements

| Field | Value |
| --- | --- |
| `field` | the value the person supplied, or the default the orchestrator filled in |

## Inputs

| Kind | From |
| --- | --- |
| `kind-name` | `../step-N-M/response.md` or `—` when an optional input is absent |

```json template-contract
{
  "kind": "request",
  "applies": [],
  "title": { "en": "^# request — [a-z]+(?:\\.[a-z]+)+ step-\\d+-\\d+$" },
  "sections": [
    { "en": "^## Context$", "table": { "en": "| Alias | Head |" }, "minRows": 1 },
    { "en": "^## Requirements$", "table": { "en": "| Field | Value |" } },
    { "en": "^## Inputs$", "table": { "en": "| Kind | From |" } }
  ],
  "rules": null
}
```
