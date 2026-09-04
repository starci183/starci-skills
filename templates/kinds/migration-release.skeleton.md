# migration-release — release:migration-1

The pinned migrations reached the declared non-production target under the bound release approval.
The runner applied the declared pending set, preserved the prior journal, and applied nothing when
invoked again against the resulting journal.

## Binding

| Field | Value |
| --- | --- |
| Operator | `release.deploy` |
| Step | `step-1/parallel-1` |
| Project | `project` |
| Environment | non-production |
| Target | `non-production/database` |
| Release | `release:migration-1` |
| Source head | `1111111111111111111111111111111111111111` |
| Plan digest | `sha256:1111111111111111111111111111111111111111111111111111111111111111` |
| Contract fingerprint | `sha256:2222222222222222222222222222222222222222222222222222222222222222` |
| Approval | `release-approval` |
| Connection fingerprint | `sha256:3333333333333333333333333333333333333333333333333333333333333333` |

## Outcome

| Field | Value |
| --- | --- |
| Outcome | migrated |
| Journal before | `sha256:4444444444444444444444444444444444444444444444444444444444444444` |
| Journal after | `sha256:5555555555555555555555555555555555555555555555555555555555555555` |
| Replay | no-op |

## Executions

| Invocation | Applied migrations | Exit code | Log | Digest |
| --- | --- | --- | --- | --- |
| 1 | `Migration1700000000000` | 0 | `response/artifacts/migration-1.log` | `sha256:6666666666666666666666666666666666666666666666666666666666666666` |
| 2 | — | 0 | `response/artifacts/migration-2.log` | `sha256:7777777777777777777777777777777777777777777777777777777777777777` |
