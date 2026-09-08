# Evidence — a credential-resolution diagnostic printed to its own command output, 2026-09-04

The occurrence behind the diagnostic-output clause of `platform.operate`'s "A credential is a name,
and it reaches a form or a body" paragraph, cited from `uat.verify`'s "The password is a name, never
a value" and `release.deploy`'s "Credentials are names, never values", lives here.

## What happened

A session ran a command to establish, as a diagnostic step, that a sealed environment credential
resolved by the name the roster carries. The command's own purpose was narrow — confirm that
resolution succeeded — but the way it was written proved that fact by resolving the value and letting
the command's normal output carry it, so the decrypted value appeared in that command's own output
before the session recognised it as plaintext and stopped. The value reached no file, no fixture, no
capture and no receipt, and it crossed no session boundary: the existing law's closed list of forbidden
destinations was not violated by name. What happened is that the law had never named the fourth
destination — a command's own output, read by the person or the transcript that ran it — because every
existing clause was written for where a value is *stored*, not for where a diagnostic *proves* a fact
about it.

## What was true at the time

- The credential law (question 1 of `UPDATE.md`) already forbade a value entering a file, a fixture, a
  recorded command, a capture or a receipt, and said the only two lawful destinations are a request
  body and a form field. A diagnostic step that neither writes a file nor submits a form sat outside
  that list entirely, so the check that would have refused this diagnostic did not exist. This is
  question 3, not question 2: the existing rule was narrower than the truth it meant to state, not
  missing a home.

## What changed

- `platform.operate`'s credential paragraph now states that a diagnostic proving resolution reports
  the outcome only — resolved or not, the name, a length or a digest — and never the value, and that a
  diagnostic that cannot be written that way is not run at all.
- `uat.verify` and `release.deploy` cite that law from their own credential paragraphs against the
  exact step each already runs (the preflight check and the resolution step), rather than restating
  it.
- `platform-operation-receipt` and `release-deployment` gained the `CREDENTIAL_VALUE_IN_OUTPUT`
  finding code; `uat-flow-verification` gained a `## Findings` section carrying the same code, because
  it previously had only a `## Fallbacks taken` section and an incident is not a fallback.
- This is not mechanically enforceable by a validator reading a receipt: the leak was in a command's
  transcript, which no receipt schema observes. The gate is the explicit shape stated in law and cited
  at the exact steps that resolve a credential, and the Findings place to record it if it recurs — not
  a script that can detect it after the fact.
