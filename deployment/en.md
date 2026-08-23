---
title: Deployment
---

# Deployment

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `deployment/schema.json` | file | validate one environment's durable deployment intent |
| `@deployment-plan` | `scripts/deployment-plan.mjs` | script | resolve routed roles and materialize a value-free ignored execution root |
| `@workspaces` | `contexts/workspaces/en.md` | en | prove every repository named by the deployment |
| `@worktrees` | `contexts/worktrees/en.md` | en | keep durable intent separate from rebuildable execution state |

## Record

This module turns a routed project's `.stacks` intent into one repeatable deployment: prepare the
machine and provider boundaries, reconcile declared domains, release immutable artifacts, observe the
remote runtime and continue repair until the public boundary is steady.

The framework is shared; the manifest is product-owned. Nivo and MiAmia may both run Docker Swarm and
Cloudflare without copying one another's hosts, services, credentials or tenant ownership.

## Three roots

`.stacks` is durable intent. It contains the tracked deployment manifest, provider/runtime source,
credential rosters and encrypted twins. A reviewer can disagree with it and Git preserves that
decision.

`.infra/<environment>` is generated execution state inside the manifest owner's routed repository.
It may contain resolved machine paths, Terraform working data, SSH control state, value-free provider
plans and monitor observations. The whole root must be ignored before the planner creates one byte.
It is rebuildable and never contains a committed decision or plaintext credential.

`.claude/deployment` is the Source-wide law and schema. It knows the allowed shapes and refusal
boundaries, not a product hostname, VPS address or secret name.

## Manifest

One environment is declared at `.stacks/deployment.json`, valid against `@schema`. It names:

- the project, owner role and every routed role participating in the release;
- one `.stacks/<environment>` root and one matching `.infra/<environment>` root;
- SSH host references and the declared host setup source;
- immutable artifacts and their runtime targets;
- optional Next.js frontend metadata per artifact: repository layout, surface slug, build context, Dockerfile and
  tracked VPS stack definition;
- each public hostname, its artifact mapping, primary status, ownership and exactly one domain driver;
- the deploy workflow/ref and proof commands or endpoints;
- the monitor interval, steady window, timeout and probes;
- credential references only, never values.

The manifest cannot contain an absolute path or `..`. Route files own machine paths; the deployment
manifest remains portable.

## Situation codes

| Code | Situation | Required result |
|---|---|---|
| `DEPLOYMENT-1` | A project has deployable stack intent | tracked manifest validates and every role route is fresh |
| `DEPLOYMENT-2` | Execution state is needed | `.infra/<environment>` is wholly ignored, initialized from the manifest and disposable |
| `DEPLOYMENT-3` | A host must run the stack | SSH identity, host separation, resources, ports and runtime manager are proved before apply |
| `DEPLOYMENT-4` | Runtime needs credentials/config | declared references resolve through the stack's existing custody path; no value enters manifest, chat or arguments |
| `DEPLOYMENT-5` | A public hostname is declared | its owner and driver reconcile only that route, never the whole zone |
| `DEPLOYMENT-6` | A release is requested | verification passes before immutable artifacts and infrastructure are applied |
| `DEPLOYMENT-7` | A remote failure appears | monitor evidence selects the smallest repair and the same failed proof is rerun |
| `DEPLOYMENT-8` | Apply returned success | public probes and observed runtime identities remain green for the declared steady window |
| `DEPLOYMENT-9` | A Next.js frontend is released | every single-app or monorepo surface resolves to its own immutable artifact, runtime target, explicit domain and public proof |
| `DEPLOYMENT-10` | A frontend surface is adopted onto a VPS stack | its runtime definition is tracked below `<stack.root>/frontend/<surface>` and the same invocation continues through public steady state |

## Planning and approval

Run the planner before any mutation:

```text
node .claude/scripts/deployment-plan.mjs --source <Source> --project <project> --owner-role <role> --environment <environment> --plan
```

If the manifest is absent, scan the real `.stacks`, workflows, runtime definitions, credential
manifests, probes and sibling precedent, then propose one exact manifest and write boundary. A manifest
is not inferred and immediately applied: host choice, public hostname ownership and tenant inclusion are
product decisions.

The value-free plan plus exact source, provider, host and public boundaries is the approval surface.
After approval, initialize execution state with the same command using `--init` and continue without
asking about ordinary setup, repair or retry.

## Execution intent

An imperative deploy, deploy-VPS, production-release, redeploy or rollback request is an operation, not
an architecture consultation. Resolve its target in this order: explicit project/role/environment in the
request, the active invocation envelope, then one unambiguous verified workspace route with a valid manifest.
An unresolved or multiple target stops before external mutation; a clearly resolved target never detours into
another project's stack merely because that stack supplied precedent.

When the observed plan is byte-for-boundary equivalent to an existing valid manifest, the imperative request
itself is the release authorization for that declared host, artifacts, domains, driver, workflow and steady
window. Report those facts as an execution notice and proceed through verification, immutable build/publication,
runtime deployment, migrations or initialization, domain reconciliation, trusted TLS and steady-state proof.
A second generic approval is required only when adopting missing intent or introducing a new host, hostname,
tenant, project, destructive action or credential rotation.

The declared runtime owns the mechanism. Docker Swarm stays Docker Swarm, Compose stays Compose and an existing
shared ingress stays shared unless approved source changes that intent. Sibling deployments may provide immutable
implementation precedent; they do not transfer application, host, domain, credential or state ownership.

## Frontend topology

A frontend artifact may declare `framework: nextjs`, a `single-app` or `monorepo` layout, a product-owned surface
slug, and exact build context and Dockerfile. `single-app` permits one deployed surface per routed repository role.
`monorepo` permits multiple surface artifacts from one role, but each surface owns a separate source root,
immutable image, runtime target and public probe. The build uses the declared context—commonly the repository root
for a workspace—so shared packages remain available. Runtime packaging should use Next.js standalone output when
the product supports it; the manifest records source and target ownership, not framework guesswork.

Surface and hostname are independent. Names such as `landing`, `app`, `crm` and `admin` are examples, not a closed
business vocabulary or DNS convention. Every frontend artifact maps to at least one explicitly declared domain;
aliases name exactly one primary domain. During adoption or when a surface lacks a domain, ask the owner for all
missing surface hostnames together. Never infer a root hostname, a subdomain prefix or shared routing from the
repository layout. An already valid manifest owns those decisions and a redeploy reuses them without asking.

Every frontend artifact names one `stackDefinition` below `<stack.root>/frontend/<surface>/...`; with
`stack.root: .stacks/vps`, that places FE runtime ownership under `.stacks/vps/frontend`. The definition lives in
the manifest owner's routed repository even when build source lives in another FE role. Adoption writes or
reconciles the manifest and runtime definition as one approved boundary, validates it, then continues the same
invocation through immutable build, VPS rollout, domain/TLS reconciliation and public steady state. A tracked
stack scaffold alone is never completion.

## Setup

Setup proves all prerequisites instead of trusting presence:

1. validate every route, source path and workflow named by the manifest;
2. prove `.infra/<environment>` is ignored;
3. prove required tools and authenticated provider/registry access;
4. resolve credential names through the project's existing hidden/encrypted custody mechanism;
5. use an SSH connector when available, otherwise verified OpenSSH, to inspect the declared host;
6. prove the host is distinct from every forbidden host reference, ports are available, resources are
   sufficient and the runtime manager is healthy;
7. apply only the declared setup script or template and prove it from a fresh SSH connection;
8. run repository-local verification before an external release.

Missing vendor-issued credentials are requested only through a hidden terminal or authorized provider.
The agent never asks for a value in conversation. Existing credentials are not rotated merely because a
setup run found them.

## Domain drivers

Every hostname has one owner (`platform`, `tenant` or `shared`) and one driver:

- `terraform` — the manifest points to product stack source that owns the record and origin together;
- `cloudflare-tunnel` — the Source helper reconciles one remotely managed HTTP(S) tunnel ingress and
  proxied CNAME from the resolved `.infra` plan.

The deployment skill calls the existing driver. It does not implement a second Cloudflare client, edit a
dashboard by hand, or replace a conflicting record. Wildcards require explicit tenant/shared ownership;
a platform record never captures tenant space by convenience.

## Deploy loop

Verification gates run first. A deploy uses the workflow/ref declared by the manifest and immutable artifact
tags or digests. The declared workflow may verify, build and publish those artifacts before deploying them. It
does not push or merge source merely to trigger a workflow when the release mechanism supports explicit dispatch.

Observe the workflow and remote runtime. On failure, classify it as source, credential/config presence,
provider access, domain, SSH/host, runtime manager, rollout or application health. Gather bounded evidence,
repair the smallest owned boundary, rerun the narrow proof, and retry only after the cause changed.

One failed apply does not end the run. Unchanged external state is not busy-retried. Destructive data loss,
credential rotation, a new public/tenant boundary or another project returns to approval.

## Monitoring

Monitoring combines provider/workflow state, SSH runtime state and public probes declared by the manifest.
It checks observed artifact identity, service convergence, restart loops, bounded logs, resources, listening
ports, TLS/DNS and application-level readiness.

The monitor writes only value-free observations under `.infra/<environment>/monitor`. A deployment is
complete only after every required probe stays green for `steadySeconds`, within `timeoutSeconds`. A green
Terraform apply or a running container alone is not success.

## Proof

`@deployment-plan --self-test` validates parser and security refusals without filesystem or external
mutation. A real run additionally proves:

- all routed heads and deployment sources;
- ignored `.infra` ownership;
- credential names and custody, never values;
- SSH host/runtime readiness;
- exact domain driver results;
- verification and workflow conclusions;
- immutable artifact identities;
- public and remote monitor steady state;
- absence of plaintext/temp remnants.

## Rules

1. `.stacks` declares; `.infra` executes; `.claude/deployment` governs.
2. No deployment path, hostname, address or credential value is inferred from a sibling checkout.
3. `.infra` is fully ignored before creation and is always rebuildable.
4. Credential values never appear in manifests, plans, chat, logs or command arguments.
5. One domain has one declared owner and driver; reconciliation never widens to a zone.
6. Verification precedes deployment and immutable identity survives rollout and rollback.
7. SSH/runtime evidence and public probes both participate in completion.
8. Repair and retry continue until steady success or a genuine approval/input boundary.
9. An imperative deploy request against one valid resolved manifest executes that release; planning is an
   intermediate control and never the terminal result.
10. Sibling precedent can supply a pattern but never changes the resolved deployment target or ownership.
11. Frontend repository layout controls build resolution only; each surface hostname is explicit owner input and
    never derived from `single-app`, `monorepo` or the surface slug.
12. Frontend adoption records its VPS runtime below `<stack.root>/frontend/<surface>` and continues to deployment;
    creating `.stacks` source without a proved release is incomplete.

## Scope

This module owns the deployment contract, generated execution boundary, setup, domain routing, release
loop and monitoring proof. It does not choose a product's VPS, domain, tenant rollout policy, secret values
or application architecture.
