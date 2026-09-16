# Application runtime configuration and health

Configuration and health belong to the application boundary that consumes them. A portable runtime contract connects one declared source package to its configuration schema, startup behavior, health semantics, deployment placement, and verification evidence. Folder names differ across repositories; responsibility and resolved references are the stable contract.

## Source and configuration ownership

Each runnable component identifies its repository role, immutable revision, package root, entry command or image, and the repository files that define configuration and startup. A monorepo path and a split-repository root use the same model. References resolve from an authorized source binding rather than from an adjacent clone or a machine-specific path.

The runnable package owns one typed configuration boundary. It maps environment keys and file-backed secrets into application values, rejects unknown or malformed critical values, and finishes validation before listeners, migrations, consumers, schedulers, or outbound clients begin effects. Defaults are limited to values that are safe in the declared environment. Required credentials, tenant identity, public origins, datastore authority, and remote endpoints do not receive production-looking placeholders.

Environment templates list names, purpose, format, source and environment applicability without containing values. Secret values remain in the declared custody path. Startup errors identify the field and rule while redacting the supplied value. Tests exercise missing, malformed, conflicting and mode-inapplicable configuration as well as the valid minimum.

## Startup and health roles

Startup follows one observable sequence:

`load source identity -> materialize custody -> parse configuration -> validate mode and dependencies -> migrate/bootstrap under authority -> start listeners/workers -> expose readiness -> verify behavior`

Health signals have different jobs:

| Signal | Meaning | Dependency scope |
| --- | --- | --- |
| Startup | Initialization is still progressing or has failed | Configuration, bounded initialization and required bootstrap |
| Liveness | This process can continue making progress | Process-local invariants; avoid turning a provider outage into restart churn |
| Readiness | This instance may receive its declared work | Required dependencies and compatibility needed for that component's operations |
| Functional verification | A named caller journey works with the intended identity and contract | Real caller boundary, authorization, persistence and result semantics |

A component classifies dependencies by behavior rather than by vendor name:

- **required:** loss prevents the component's declared operation, so readiness closes;
- **degraded:** the component remains ready for a documented subset and reports the unavailable capability;
- **optional:** absence does not affect the advertised contract and is not probed on every health request.

Health handlers use bounded timeouts and do not mutate business data. Readiness does not replace migration evidence, authenticated API verification, queue progress, data recovery, or rollout observation.

## Placement changes addresses, not responsibility

| Placement | Configuration and health binding |
| --- | --- |
| Host process | Exact package script, private generated env file, loopback host ports and host-reachable dependency endpoints |
| Docker service | Exact source/build inputs or immutable image, service-DNS container connections, published readiness or enabled container healthcheck |
| Remote application API | External owner/failure domain, endpoint configuration reference, caller auth and timeout, owner contract, separate deployment record and caller-bound verification |

One selected placement exists for each component. A remote application workload hosted on Kubernetes or K3s is still an application API to its caller; it is not the Kubernetes control plane and does not grant cluster operations. See [Remote application API boundaries](remote-application-api.md).

## Provenance and verification

Static conformance binds source revisions, package/config files, images, endpoint names, custody names and verification entry points. It reports missing or drifting inputs before effects. It does not authenticate Git history, inspect secret values, call dependencies, or prove a rollout.

Live evidence records the selected profile, source and image identities, rendered configuration digest with secret values excluded, migration/bootstrap result, health observations, remote contract identity, and named functional checks. A source/config change invalidates the affected component's proof. A provider or remote workload change invalidates its connectivity and behavior proof without pretending unrelated local components were rebuilt.

These rules guide project inquiry rather than require identical folders or frameworks. A project maps its actual config module, schema, entry point, health adapters, dependency policy and verification files into the contract and records any semantic behavior that static analysis cannot establish.
