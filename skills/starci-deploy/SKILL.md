---
name: starci-deploy
description: Adopt, set up, deploy, monitor, recover or roll back a routed project's declared .stacks release on its declared host. An imperative deploy, deploy VPS, redeploy or release request means execute the immutable build/runtime/domain flow through trusted HTTPS and public steady state; not architecture advice, local startup or another project's host.
---

# starci-deploy

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval, persistence and output contract |
| `@initialization` | `readiness/initialization/context.md` | context | identity, bootstrap, routed workspace and worktree readiness |
| `@deployment` | `deployment/context.md` | context | manifest, `.infra`, setup, domain, deploy and monitor law |
| `@deployment-plan` | `scripts/deployment-plan.mjs` | script | validate, plan and initialize the declared deployment without duplicating manifest logic in the skill |

## NESTED SKILLS

None.

## PIPELINE

Topology: `reconciliation`.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| bind | shared | verified roles, environment and durable `.stacks` intent | freeze release, host, domain and rollback ownership | deployment contract | every target is declared and routable |
| inspect-plan | reconciliation | deployment contract and observed `.infra`/host/provider state | compute setup, release, migration and traffic deltas | execution plan and rollback point | destructive or external mutations remain approval-bound |
| execute | execution | approved plan | reconcile infrastructure and immutable release, retrying recoverable steps | release and operation receipts | only declared targets mutate and each step is idempotent or recoverable |
| steady-state | proof | fresh public, host and service observations | monitor health and compare desired with observed state | deployment proof or rollback receipt | public steady state passes, otherwise recover or roll back |

## Run

Read `@skill-shape`, `@initialization` and `@deployment` in that order. Resolve the Source language,
declared project, environment and owner role. Verify every role named by the deployment before reading
target source. Preserve existing changes and do not refresh source-context MCP.

Run `@deployment-plan` in plan mode. If `.stacks/deployment.json` is absent, scan the real stack,
workflows, credentials-by-name, runtime definitions, probes and relevant sibling precedent, then produce
one exact manifest and touch boundary. Do not substitute a generic example or infer a host/domain.

## Invocation semantics

Classify the owner's verb before choosing a path. `deploy`, `deploy VPS`, `deploy production`, `redeploy`,
`release`, `triển khai VPS` and equivalent imperatives are execution intent, not a request to explain or
compare infrastructure. Resolve project, role and environment from the explicit request, then the active
invocation envelope, then one unambiguous verified workspace route plus manifest. Stop only if those facts
still leave more than one target.

When the resolved manifest already declares the host, runtime manager, artifacts, domains and probes, the
imperative invocation is the release decision for exactly that declared boundary. Print the resolved target
and value-free execution plan as notice, then execute; do not ask the owner to choose Caddy, Docker, Swarm,
Tunnel or another platform when the manifest already chose, do not stop after planning, and do not require a
second generic `OK`. A sibling such as Nivo may prove a stack pattern or shared ingress identity, but never
becomes the deployment target, credential owner or application being released.

## Approval boundary

For adoption, a missing manifest, an ambiguous target or any new host/domain/tenant/project, display one
value-free plan under `### NEED APPROVALS`: tracked manifest/source writes, exact routed repositories, SSH
host reference, artifact targets, domain names with owner/driver, workflow/ref, provider mutations and monitor
success window. `OK` authorizes that complete new boundary once.

For an imperative execution request whose observed plan exactly matches an existing valid manifest, display
the same facts as an execution notice and continue immediately. That invocation authorizes release operations
and the smallest deployment-owned repair inside the declared repositories; it does not authorize destructive
data loss, credential rotation, product/business expansion or a different external boundary.

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

The concrete release path follows declared source rather than a fresh technology proposal: verify; build and
publish immutable container artifacts when declared; install or prove the declared VPS runtime; deploy through
the declared Compose, Swarm or other manager; run migrations/init jobs; reconcile the declared domain driver;
prove trusted TLS and application health for the full steady window. Re-enter the smallest failed stage after
repair instead of restarting the conversation at architecture selection.

A green apply, workflow or container is intermediate evidence, never the terminal condition. Pause only
when a vendor credential must be entered through hidden input, access is absent, or the next action crosses
the approved boundary. Never request a credential value in chat.

## Monitor and output

Write only value-free observations beneath ignored `.infra/<environment>/monitor`. Report progress in the
Source language without status tables: current failed gate, evidence, repair and next proof.

Completion names routed revisions, immutable artifact identities, workflow conclusions, domain changes,
SSH/runtime convergence, public steady-state probes and rollback identities. Never print credential values,
provider response bodies or unbounded remote logs.
