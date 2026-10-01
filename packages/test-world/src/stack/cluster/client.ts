import { TestWorldErrorCode, worldError } from "../../errors"
import { execCommand } from "../exec"
import type { Exec } from "../exec"
import type { ClusterClient, ClusterPod, RunCluster } from "../contracts"
import { createKubectl } from "./kubectl"
import { deleteNamespaces, listNamespaces, namespaceManifest } from "./namespaces"
import { realClock } from "./poll"
import type { Clock } from "./poll"

/** A pod with the waiting reasons of its containers (for failure messages). */
export interface PodDetail extends ClusterPod {
    /** `container: Reason` for every container that waits. */
    readonly waiting: ReadonlyArray<string>
}

interface RawPod {
    metadata?: { name?: string; namespace?: string }
    status?: {
        phase?: string
        containerStatuses?: ReadonlyArray<{ name?: string; ready?: boolean; state?: { waiting?: { reason?: string } } }>
    }
}

/** Parses `kubectl get pods -o json`; `ready` is true when there are container statuses and all are ready. */
export const parsePods = (json: string): ReadonlyArray<PodDetail> => {
    const parsed = JSON.parse(json) as { items?: ReadonlyArray<RawPod> }
    return (parsed.items ?? []).map((item) => {
        const statuses = item.status?.containerStatuses ?? []
        return {
            name: item.metadata?.name ?? "",
            namespace: item.metadata?.namespace ?? "",
            phase: item.status?.phase ?? "Unknown",
            ready: statuses.length > 0 && statuses.every((status) => status.ready === true),
            waiting: statuses.flatMap((status) => (status.state?.waiting?.reason === undefined ? [] : [`${status.name ?? "?"}: ${status.state.waiting.reason}`])),
        }
    })
}

/** What the client may be given besides the run facts. */
export interface ClusterClientDependencies {
    readonly exec?: Exec
    readonly clock?: Clock
}

const CLUSTER_SCOPED = /^\s*kind:\s*(Namespace|ClusterRole|ClusterRoleBinding|CustomResourceDefinition|PersistentVolume|StorageClass|Node|PriorityClass|ValidatingWebhookConfiguration|MutatingWebhookConfiguration)\s*$/m

/** The worker side of the cluster: every read and write is confined to the repository namespaces (`run.namespacePrefix`). */
export const createClusterClient = (run: RunCluster, deps: ClusterClientDependencies = {}): ClusterClient => {
    const kubectl = createKubectl(deps.exec ?? execCommand, run.serverContainer)
    const clock = deps.clock ?? realClock
    const prefix = run.namespacePrefix

    const resolve = (name: string): string => {
        const stored = name.startsWith(prefix) ? name : `${prefix}${name}`
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(stored) || stored.length > 63 || stored.length === prefix.length) {
            throw worldError(TestWorldErrorCode.ConfigInvalid, `"${name}" is not a valid namespace name; a namespace of this repository is named ${prefix}<name> (lowercase letters, digits, "-", at most 63 characters)`)
        }
        return stored
    }

    const podsOf = async (namespace: string): Promise<ReadonlyArray<PodDetail>> => parsePods(await kubectl(["get", "pods", "-n", namespace, "-o", "json"]))

    const describe = (pods: ReadonlyArray<PodDetail>): string =>
        pods.length === 0 ? "no pods" : pods.map((pod) => `${pod.name} phase=${pod.phase} ready=${pod.ready}${pod.waiting.length > 0 ? ` waiting[${pod.waiting.join("; ")}]` : ""}`).join(", ")

    return {
        async pods(namespace) {
            if (namespace !== undefined) return podsOf(resolve(namespace))
            const all: Array<PodDetail> = []
            for (const stored of await listNamespaces(kubectl, prefix)) all.push(...(await podsOf(stored)))
            return all
        },
        namespaces: () => listNamespaces(kubectl, prefix),
        async createNamespace(name) {
            const stored = resolve(name)
            await kubectl(["apply", "-f", "-"], { input: namespaceManifest(stored, prefix) })
            return stored
        },
        async deleteNamespace(name) {
            await deleteNamespaces(kubectl, prefix, [resolve(name)], { clock })
        },
        async apply(manifest, namespace) {
            const stored = resolve(namespace)
            if (CLUSTER_SCOPED.test(manifest)) {
                throw worldError(TestWorldErrorCode.ConfigInvalid, `the manifest declares a cluster-scoped resource; a spec may only apply namespaced resources into ${stored}`)
            }
            for (const match of manifest.matchAll(/^\s*namespace:\s*["']?([^\s"'#]+)/gm)) {
                const declared = match[1]
                if (declared !== undefined && !declared.startsWith(prefix)) {
                    throw worldError(TestWorldErrorCode.ConfigInvalid, `the manifest names the namespace "${declared}" which is outside the repository prefix ${prefix}`)
                }
            }
            await kubectl(["apply", "-n", stored, "-f", "-"], { input: manifest })
        },
        async waitForPods(namespace, options = {}) {
            const stored = resolve(namespace)
            const timeoutMs = options.timeoutMs ?? 120_000
            let last: ReadonlyArray<PodDetail> = []
            const deadline = clock.now() + timeoutMs
            for (;;) {
                last = await podsOf(stored)
                if (last.length > 0 && last.every((pod) => pod.ready || pod.phase === "Succeeded")) return
                if (clock.now() >= deadline) break
                await clock.pause(1000)
            }
            throw worldError(TestWorldErrorCode.TimedOut, `pods of ${stored} were not ready after ${timeoutMs} ms: ${describe(last)}`)
        },
    }
}
