# Temporary quality debts

## LOADS

None.

## Authority

Temporary quality debt is Source execution state, not repository policy. Its sole durable home is
`.worktrees/<project>/debts/<role>.md`, with machine fields in YAML front matter and unrestricted Markdown
sections for the reason, baseline, exit criteria and progress. `scripts/check-source-quality.mjs` validates it. A package manifest,
workspace route, CI workflow or chat message cannot grant debt.

## Law

A valid debt changes a blocking finding to verdict `debt`; it never changes the measured fact to `pass`.
Delivery may continue while every blocking finding is either green or covered by an active debt. Readiness,
quality badges and provider status remain truthful: `debt` is not green.

Debt may describe any unresolved finding through stable namespaced scopes shaped as `<category>:<finding>`:
for example `source:project-coverage`, `assurance:sonar`, `route:head` or `structure:legacy-tier`. The machine
that owns a finding decides whether that scope can temporarily allow delivery or is record-only. Recording a
route debt never authorizes work through an unverified route; recording lint, test, secret or suppression debt
never weakens those gates unless their owning law explicitly says so. Every record names the owner, approval
date, expiry, reason, exact scopes, measured baseline and exit criteria. Expiry is at most 90 days; expired,
malformed, scope-less or baseline-less records fail closed.

## List evidence

Read the exact project/role record while inventorying the Source. Report its scopes, baseline, expiry and exit
criteria beside the current measurements. Missing debt means normal blocking law. Never infer debt from a
low metric, an unavailable provider or an earlier conversation.

## Apply

Write or replace only the exact `.worktrees/<project>/debts/<role>.md` approved by the owner. Preserve the
strict thresholds in manifests, CI and providers. Do not lower a threshold, remove a required check or alter
source evidence to match the debt. A later measurement appends no history here: replace the current record
only through a new owner decision, while Git retains the prior revision.

## Proof

Validate the front matter, namespaced scopes, required sections and dates. Route each scope to its owning
machine and re-run every non-accepted gate. A machine may expose `deliveryAllowed` only for scopes its law
recognizes; unknown scopes are recorded, never silently accepted. `pass` remains false until every debt scope
is actually green. Remove the record as soon as all exit criteria are satisfied.
