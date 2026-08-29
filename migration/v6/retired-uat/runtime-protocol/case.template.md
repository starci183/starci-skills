# UAT Case — <case-id>

## Intent

- Class: `happy | unhappy`
- Proves: <one business/recovery claim>
- Start state: <state>
- Terminal: <success or explicit safe terminal>
- Merge signature: `<start>|<semantic-owner>|<side-effect>|<recovery>|<terminal>|<fault-scope>`
- Covered equivalent examples: <exact examples represented by this case or none>
- Lower-level delegated permutations: <receipt refs or none>

## Isolation

- Run ID: `<run-id>`
- Account provisioning: `fresh | none`
- Account: `<new identity namespaced by case-id + run-id> | none`
- Provisioning receipt: <fresh-account receipt or not-applicable>
- Agent: <case-run executor identity>
- Browser context: <unique context>
- Browser session ref: <broker-issued session handle>
- Browser lease receipt: <case-run-bound lease>
- Browser profiles: <native/responsive/browser-zoom/text-only profile IDs>
- Origin: <unique hostname/origin>
- Mail/query namespace: <namespace>
- Fixture namespace: <namespace>
- Artifact directory: `runs/<run-id>/`
- Resource locks: <safe/partitioned/exclusive>

`fresh` is mandatory unless the case entry is anonymous. Never reuse an account from another case or an earlier run. If registration is the business outcome, begin with `none` and let the product journey create the account. Only the assigned agent may automate its leased browser session; a user-action handoff temporarily transfers that same session and returns it after the resume command.

## Fixture lifecycle

1. Prepare only the initial state using mandatory case selector `<case-id>`.
2. Execute the product journey; no fixture command may create the expected terminal outcome.
3. Verify the outcome through read-only queries.
4. Clean only `is_uat=true` records in the exact case namespace.

## Steps and assertions

| Step | Actor action / system event | Expected state | Behavior assertion | UX assertion | UI assertion | Evidence checkpoint |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | <action> | <state> | <claim> | <claim> | <claim> | entry |

## Required checkpoints

- Happy: entry, material commitment when distinct, material pending/async state, terminal, and every materially different responsive branch.
- Unhappy: valid pre-failure state, exact feedback, recovery affordance, corrected/retried state, terminal, and relevant responsive branches.
- Async/resume/destructive: before/after pairs plus refresh/resume evidence.
- Browser profiles: native 100% baseline plus only the responsive, browser-zoom, text-only, or reflow profiles that can change hierarchy, reachability, recovery, or completion. Record exact viewport, scale mode, and scale percent; do not make every agent repeat the same profile.

## Result verification

Record the immutable `result.json`, DOM/accessibility/trace evidence, and sanitized screenshots. An error screenshot alone cannot pass an unhappy case.
