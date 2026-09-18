# Application runtime configuration and health

Configuration and health belong to the application boundary that consumes them. A portable runtime contract connects one declared source package to its configuration schema, startup behavior, health semantics, deployment placement, and verification evidence. Folder names differ across repositories; responsibility and resolved references are the stable contract.

## Source and configuration ownership

Each runnable component identifies its repository role, immutable revision, package root, entry command or image, and the repository files that define configuration and startup. A monorepo path and a split-repository root use the same model. References resolve from an authorized source binding rather than from an adjacent clone or a machine-specific path.

The runnable package owns one typed configuration boundary. It maps environment keys and file-backed secrets into application values, rejects unknown or malformed critical values, and finishes validation before listeners, migrations, consumers, schedulers, or outbound clients begin effects. Defaults are limited to values that are safe in the declared environment. Required credentials, tenant identity, public origins, datastore authority, and remote endpoints do not receive production-looking placeholders.

Environment templates list names, purpose, format, source and environment applicability without containing values. Secret values remain in the declared custody path. Startup errors identify the field and rule while redacting the supplied value. Tests exercise missing, malformed, conflicting and mode-inapplicable configuration as well as the valid minimum.

## Adopted default mapping

Projects may map an established equivalent, but new Nest and Next source starts with these ownership paths. A folder is created only when its responsibility exists.

| Runtime | Default source path | Responsibility |
| --- | --- | --- |
| Nest composition | `apps/<app>/src/main.ts`, `apps/<app>/src/app.module.ts` | Validate startup inputs, compose modules, start and stop the process |
| Nest configuration | `src/modules/platform/env/schema.ts`, `config.ts`, optional `public-config.ts` | Parse the complete environment once; expose typed server config and an explicit non-secret public projection |
| Nest health policy | `src/modules/platform/health/dependency-policy.ts`, `liveness.service.ts`, `readiness.service.ts` | Classify dependencies and compute process-local liveness versus traffic readiness |
| Nest health transport | `src/features/system-health/transport/http/live.controller.ts`, `ready.controller.ts` | Thin HTTP adapters; operational GraphQL/status views remain separate from orchestrator probes |
| Next configuration | `src/config/env/schema.ts`, `server.ts`, `public.ts` | Keep server-only values out of client graphs; validate the allowlisted browser projection |
| Next startup | `src/instrumentation.ts` when server startup work exists | Validate server runtime config before requests; do not make a browser bundle depend on server secrets |
| Next health policy | `src/modules/platform/health/policy.ts`, `readiness.ts` | Server-only dependency policy and bounded readiness checks |
| Next health transport | `src/app/health/live/route.ts`, `src/app/health/ready/route.ts` | Route adapters with no product page or session behavior |
| Deployment binding | `.starcistacks/application-stacks.yaml`, `.starcistacks/dev/runtime/<component>.env`, declared source/build inputs and deployment/verification refs | Bind the selected host, container, or remote-API placement without storing credential values |

The env schema may use the project's installed validator or a small typed parser. The required behavior is one complete, tested parse with finite/range/URL/enum checks and redacted failures. Nest Terminus is an optional health adapter, not a required dependency. Next `instrumentation.register` is useful only for server initialization that must finish before requests; build-time public values and request-time server values remain different lifecycles.

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

## Source critique and adoption

Read-only inspection used Academy backend `1731b15ba4ed526477e3c572b9d82c31ab64f1d5` and frontend `44bba218685b7eed2a5d9e479689707ab6381bc8` as evidence, not universal authority.

| Observed source | Retain | Correct in the adopted default |
| --- | --- | --- |
| Backend `src/modules/platform/env/config.ts` and `utils/parse-env.ts` give keys typed call sites and make secret `_FILE` support explicit through `parseEnvSecret` | Explicit secret classification, file custody, typed access and parser tests | `parseInt`, `Number.parseFloat`, duration and boolean parsing must reject invalid, non-finite, out-of-range and unexpected values. Build one startup-validated config instead of letting an invalid field remain latent until a later `envConfig()` call. |
| Backend `src/modules/platform/health/system-health.service.ts` bounds probes, caches results and returns total component status; the GraphQL resolver maps a public status projection | Bounded probes, stable names, caching and explicit safe projection | Its broad datastore, SaaS and metrics sweep is operational status, not process liveness. Define the required readiness subset separately; keep liveness process-local so a provider outage does not cause restart churn. |
| Backend `apps/core/src/main.ts` reads the configured port only at `listen` after Nest composition and adapter setup | One composition entry and late listener start | Complete config validation must precede module/provider side effects, migrations, consumers and outbound workers, not only the final `listen`. |
| Frontend `src/modules/api/env.ts` uses statically named `NEXT_PUBLIC_*` reads and tests loopback normalization | Static public-key references match Next bundling behavior; transport values have a focused owner and tests | `NEXT_PUBLIC_API_BEARER_TOKEN` is browser-visible and cannot be secret custody. Numeric coercion needs finite/range checks. A localhost API default must not silently satisfy a deployed build where an endpoint is required. |
| Frontend `src/config/sentry.ts` builds a narrow public projection and `src/instrumentation.ts` selects server runtimes | Explicit privacy defaults, release identity and one server initialization hook | Validate the public projection and server-only config separately. Absence of an inspected health route is not a pass; add the route/policy only for a deployment that needs it. |

## Primary references

Reviewed 2026-09-16:

- [Nest configuration](https://docs.nestjs.com/techniques/configuration) describes startup schema validation and explicit unknown/error options.
- [Nest health checks](https://docs.nestjs.com/recipes/terminus) provides optional readiness/liveness adapters and indicators.
- [Next environment variables](https://nextjs.org/docs/pages/guides/environment-variables) defines server-only values, build-inlined `NEXT_PUBLIC_*` values and the static-reference constraint.
- [Next instrumentation](https://nextjs.org/docs/pages/api-reference/file-conventions/instrumentation) defines `register` as server-instance initialization that completes before requests.
- [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/probes/) distinguishes startup, liveness restart behavior and readiness traffic eligibility. The semantics apply even when the current placement is host or Compose; using them does not imply cluster administration.
