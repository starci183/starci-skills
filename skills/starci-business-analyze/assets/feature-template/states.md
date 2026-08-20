# States · {{FEATURE_TITLE}}

```text
{{INITIAL}} --{{EVENT}}--> {{PENDING}} --{{SUCCESS}}--> {{SUCCESS_STATE}}
                               \--{{FAILURE}}--> {{ERROR_STATE}}
```

| State | Kind | Reader sees | Allowed actions | Evidence |
|---|---|---|---|---|
| `{{STATE_ID}}` | {{kind}} | {{VISIBLE_RESULT}} | {{ACTIONS}} | `{{EVIDENCE_ID}}` |
