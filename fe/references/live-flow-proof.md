# Live flow proof

## Identity

Use a dedicated non-production test account. Never print or append passwords, tokens, cookies or
secret-bearing URLs. For every affected runtime flow,
prove the same time window across UI, Network, Console and frontend/backend Terminal. A green UI with
an unexplained failed request, exception, hydration error or stack trace is failed.

### LIVE FLOW PROOF

| Flow | Persona | Steps | UI | Network | Console | Terminal | Verdict | Evidence |
|---|---|---|---|---|---|---|---|---|

Verdict is `passed`, `failed`, `blocked` or evidence-backed `not-applicable`. Missing credentials or
runtime access belongs in `OWED`; never claim the flow passed.
Apply cannot close while an approved flow is `failed` or `blocked`.
