# Remote application API boundaries

An application hosted in Kubernetes or K3s remains an application API to its callers.
Do not confuse an application's name, such as `agentos-controlplane`, with the
Kubernetes control plane that runs the cluster.

## Separate three responsibilities

1. **API consumption:** the caller implements the accepted application protocol,
   authentication, authorization, error/result mapping, timeouts and recovery.
2. **Application deployment:** its owner builds and rolls out the API workload,
   dependencies, migrations and version-compatible jobs in its declared target.
3. **Cluster administration:** its owner operates nodes, scheduling, network,
   storage and cluster access. Calling an application API grants none of these effects.

A provisioning feature may separately own authorized deployment actions. That does
not make ordinary application requests calls to the Kubernetes API. Preserve the
distinct adapters, permission boundaries and verification of these responsibilities.

## Declare the actual caller and API placement

A development environment may combine an npm process on the developer machine,
local Docker dependencies and an application API on an existing remote cluster.
These components are not necessarily alternative copies of one local Compose stack.
Keep a single selected placement for each component; do not start a local duplicate
of the remote API merely to satisfy an application inventory check.

The caller's `.starcistacks` declaration must identify the remote API's actual owner,
failure domain, separately maintained deployment declaration, accepted API contract,
endpoint binding, credential reference, timeout and readiness verification. Keep
credential values in their declared custody. A remote API is external to the
caller runtime, not ownerless or outside the application's delivery obligations.

Endpoint configuration must be meaningful from the caller's network. A developer
machine cannot assume a cluster-internal Service address is reachable. A local
forward is a separately declared, managed development connection; it is not proof
that the API runs locally. Remote callbacks to a local caller also need an explicit,
reachable connection contract. Preserve accepted port assignments for host processes
without treating a host port as a Kubernetes Service or ingress port automatically.

## Check declarations and live behavior separately

- Static checks validate selected placement, references, endpoint shape, contract
  coverage and required verification declarations. Unknown coverage fails the gate.
- API verification runs from the real caller boundary against the intended API
  identity/version and checks readiness, authentication, required operations and
  failure handling. An open port or running Pod does not establish this contract.
- Deployment verification binds the actual workload revision, rollout, migration
  and data recovery evidence. API tests do not prove that a rollout is reproducible.
- Local Compose/native checks cannot certify a remote API or the whole environment.
  An unavailable target is reported explicitly; never replace it with a local mock
  and call the remote integration verified.

Do not rewrite source, accepted SRS/SDS or completion evidence merely to make static
metadata agree. A conflicting placement is a concrete finding for the owning
deployment/design repair. Preserve stopped workflow checkpoints while repairing
the runtime standard; product rollout remains a separate authorized operation.

## Nivo application of the rule

The owner clarified the development topology on 2026-09-16: Nivo Core runs through
its npm script on the developer host and consumes the AgentOS Controlplane API.
The `agentos-controlplane` application runs as a workload inside the existing Tino
K3s cluster. This is a project example, not a Tino dependency for other projects.
The selected Nivo declaration must reconcile that placement with any older local
Compose controlplane entry; publishing this runtime does not perform that migration.

## Primary references

Reviewed 2026-09-16:

- [Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/):
  Service identity and reachability differ from individual Pod placement.
- [K3s cluster access](https://docs.k3s.io/cluster-access): cluster credentials grant
  Kubernetes access; they are not application API credentials.
- [Kubernetes port forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/):
  forwarding is a distinct access mechanism with its own process and authorization.
