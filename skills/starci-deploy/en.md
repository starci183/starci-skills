---
title: starci-deploy · English
---

# starci-deploy

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval, persistence and output contract |
| `@initialization` | `readiness/initialization/en.md` | en | identity, bootstrap, routed workspace and worktree readiness |
| `@deployment` | `deployment/en.md` | en | manifest, `.infra`, setup, domain, deploy and monitor law |

## NESTED SKILLS

None.

## Run

Read `@skill-shape`, `@initialization` and `@deployment` in that order. Resolve the Source language,
declared project, environment and owner role. Verify every role named by the deployment before reading
target source. Preserve existing changes and do not refresh source-context MCP.

Run `@deployment-plan` in plan mode. If `.stacks/deployment.json` is absent, scan the real stack,
workflows, credentials-by-name, runtime definitions, probes and relevant sibling precedent, then produce
one exact manifest and touch boundary. Do not substitute a generic example or infer a host/domain.

## Approval boundary

Display one value-free plan under `### NEED APPROVALS`: tracked manifest/source writes, exact routed
repositories, SSH host reference, artifact targets, domain names with owner/driver, workflow/ref, provider
mutations and monitor success window. `OK` authorizes that complete declared boundary once.

After `OK`, take baselines and continue setup, source wiring, `.infra` initialization, provider changes,
workflow dispatch, SSH repair, retry and monitoring without asking about ordinary in-scope decisions.
Return to approval only for destructive data loss, credential rotation, a new hostname/tenant/project, or
another boundary not shown in the plan.

## Execute to outcome

Initialize `.infra` with `@deployment-plan --init`. Use repository-owned scripts and workflows rather than
reimplementing them. Use an available SSH connector for remote inspection and repair; otherwise use a
verified OpenSSH path that keeps credentials off arguments and output.

For each domain, run only its declared driver. A `terraform` route changes through the product apply. A
`cloudflare-tunnel` route uses `.claude/scripts/cloudflare-tunnel-set.mjs`; skills are not nested, but the
shared value-safe helper is callable directly. Always plan provider changes first and refuse conflicts.

Run verification before release. Dispatch the declared immutable release workflow, wait for completion,
inspect bounded remote evidence and public probes, repair the smallest owned failure and retry only after
the cause changes. Continue until every required probe stays green for the manifest's steady window.

A green apply, workflow or container is intermediate evidence, never the terminal condition. Pause only
when a vendor credential must be entered through hidden input, access is absent, or the next action crosses
the approved boundary. Never request a credential value in chat.

## Monitor and output

Write only value-free observations beneath ignored `.infra/<environment>/monitor`. Report progress in the
Source language without status tables: current failed gate, evidence, repair and next proof.

Completion names routed revisions, immutable artifact identities, workflow conclusions, domain changes,
SSH/runtime convergence, public steady-state probes and rollback identities. Never print credential values,
provider response bodies or unbounded remote logs.
