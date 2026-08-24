# `business/staleness-check` output

Return exactly one state: `fresh`, `initialize-required`, or `blocked`.

## JSON architecture

| Section | Meaning |
| --- | --- |
| `payload.decision` | The only machine routing value. |
| `payload.state` | Typed state code, retryability, and exact emitted route. |
| `payload.produced` | Freshness receipt or initialization reason plus compared identities. |
| `payload.context.used` | Exactly the business-metadata and source-metadata bindings used. |
| `payload.cleanup` | Session scratch is retained only until skill-terminal, then purged. |

Only `fresh` produces a non-null freshness receipt. No business content is copied into output.
