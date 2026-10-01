import { TestWorldErrorCode, worldError } from "../../errors"
import type { RunQdrant } from "../contracts"
import { httpOk } from "../health"
import { baseUrl } from "./definition"
import type { ServiceDefinition, ServiceTarget } from "./definition"

const dropCollections = async (target: ServiceTarget, prefix: string): Promise<void> => {
    const listed = await target.net.fetch(`${baseUrl(target)}/collections`, { signal: AbortSignal.timeout(10_000) })
    if (!listed.ok) throw worldError(TestWorldErrorCode.InfrastructureFailed, `qdrant list collections answered ${listed.status}`)
    const body: unknown = await listed.json()
    const collections =
        typeof body === "object" && body !== null && "result" in body && typeof body.result === "object" && body.result !== null && "collections" in body.result && Array.isArray(body.result.collections) ? body.result.collections : []
    for (const collection of collections) {
        const name: unknown = typeof collection === "object" && collection !== null && "name" in collection ? collection.name : undefined
        if (typeof name !== "string" || !name.startsWith(prefix)) continue
        const removed = await target.net.fetch(`${baseUrl(target)}/collections/${encodeURIComponent(name)}`, { method: "DELETE", signal: AbortSignal.timeout(30_000) })
        await removed.arrayBuffer()
        if (!removed.ok && removed.status !== 404) throw worldError(TestWorldErrorCode.InfrastructureFailed, `qdrant delete collection ${name} answered ${removed.status}`)
    }
}

/** Qdrant: one shared server per image; a namespace owns the collections whose name starts with `<namespace.snake>_`. */
export const qdrantService: ServiceDefinition<RunQdrant> = {
    name: "qdrant",
    port: 6333,
    newSecrets: () => ({}),
    spec: () => ({ env: {}, command: [] }),
    ready: (target) => httpOk(target.net.fetch, `${baseUrl(target)}/readyz`),
    provision: async (target, input) => {
        const collectionPrefix = `${input.namespace.snake}_`
        await dropCollections(target, collectionPrefix)
        return { run: { collectionPrefix } }
    },
    reset: (target, run) => dropCollections(target, run.collectionPrefix),
    deprovision: (target, run) => dropCollections(target, run.collectionPrefix),
}
