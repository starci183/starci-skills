# Live flow proof

Use this proof for every approved frontend flow that depends on authentication, runtime data or a
running backend. A screenshot or successful click alone does not prove the flow works.

## Identity and safety

- Resolve the app-specific test account and persona from the declared Project, approved test
  configuration, secret store or the user. Never infer an account from `Source` or another app.
- Use a dedicated non-production test identity. Never use a personal or production account.
- Never print or append passwords, access tokens, refresh tokens, cookies, authorization headers or
  secret-bearing URLs. Record only a redacted account label and persona.
- If no authorized test identity exists, record the authenticated proof in `OWED`; do not claim the
  affected flow is complete.

## Run the real flow

Start or attach to the declared frontend and backend runtimes with their output observable. Use the
real login UI at least once for the test session unless the approved boundary explicitly excludes
authentication and an existing test session is recorded. Then execute every approved critical flow
with the declared route, persona, fixture or seed and expected consequence.

For every flow, inspect the same time window in all four surfaces:

1. **UI** — the expected visible state and consequence appear.
2. **Network** — expected requests have the correct method, payload shape and status; GraphQL
   responses contain no unexpected `errors`; classify every failed, cancelled, retried, 4xx or 5xx
   request instead of ignoring it.
3. **Console** — no unexplained uncaught error, hydration failure, unhandled rejection or failed
   resource remains.
4. **Terminal** — frontend and backend output contain no unexplained exception, stack trace,
   unhandled rejection or failed request for the flow.

Correlate failures by route, action, timestamp and request or trace id when available. A green UI
with a red Network, Console or Terminal cell is failed until the error is explained and approved as
unrelated.

## Workflow evidence

Append the exact table under `### LIVE FLOW PROOF`:

| Flow | Persona | Steps | UI | Network | Console | Terminal | Verdict | Evidence |
|---|---|---|---|---|---|---|---|---|

Use `passed`, `failed`, `blocked` or `not-applicable` for `Verdict`. `not-applicable` requires source
or product evidence that the changed boundary has no authenticated/runtime flow. Evidence names
redacted account label, route, state, request/status summary, log time window and artifact paths; it
contains no secret.

Apply cannot close while an approved flow is `failed` or `blocked`. Put missing account, unavailable
runtime or inaccessible log surface in `OWED` with the exact action that clears it.
