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
- each public hostname, its ownership and exactly one domain driver;
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

Verification gates run first. A deploy uses the workflow/ref declared by the manifest and immutable
artifact tags or digests. It does not push or merge source just to trigger a workflow.

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

## Scope

This module owns the deployment contract, generated execution boundary, setup, domain routing, release
loop and monitoring proof. It does not choose a product's VPS, domain, tenant rollout policy, secret values
or application architecture.
