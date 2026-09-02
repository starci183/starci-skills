# independent-critique — <decisionId>

## Execution

| Field | Value |
| --- | --- |
| Reviewer execution | the fresh execution's own reference, never the author's |
| Inherited turns | none |
| Given | `data/stack-model.json`, `response.md` sections and their claims; no rationale |

## Attacks

| Adverse path | Attack | Resolution | Verdict |
| --- | --- | --- | --- |
| partial-failure | what breaks when one side completes | how the selected design survives it | holds |
| retry-idempotency | | | holds |
| concurrency | | | holds |
| stale-state | | | holds |
| deletion | | | holds |
| recovery | | | holds |
| dependency-outage | | | holds |
| rollback | | | holds |

## Verdict

| Field | Value |
| --- | --- |
| Selection | keep, or return |

```json template-contract
{
  "kind": "independent-critique",
  "applies": [],
  "title": { "en": "^# independent-critique — [a-z0-9][a-z0-9-]*$" },
  "sections": [
    { "en": "^## Execution$", "table": { "en": "| Field | Value |" }, "rows": ["Reviewer execution", "Inherited turns", "Given"] },
    { "en": "^## Attacks$", "table": { "en": "| Adverse path | Attack | Resolution | Verdict |" }, "exactRows": 8, "rows": ["partial-failure", "retry-idempotency", "concurrency", "stale-state", "deletion", "recovery", "dependency-outage", "rollback"], "cell": { "Attack": "\\S", "Resolution": "\\S", "Verdict": "^(holds|fails)$" } },
    { "en": "^## Verdict$", "table": { "en": "| Field | Value |" }, "rows": ["Selection"], "cell": { "Value": "^(keep|return)$" } }
  ],
  "rules": null
}
```
