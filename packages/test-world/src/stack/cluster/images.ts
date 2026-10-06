import { join } from "node:path"
import type { Docker } from "../docker"
import type { OwnImageRequest } from "../contracts"
import { computeImageHash } from "./image-hash"
import type { ImageLedger } from "./ledger"
import type { RegistryClient } from "./registry"

/** How many `src-*` tags of one repository survive a garbage collection. */
export const KEEP_TAGS = 3

/** What image work needs. */
export interface ImagesDependencies {
    readonly docker: Docker
    readonly registry: RegistryClient
    readonly ledger: ImageLedger
    readonly now: () => number
}

/** What one build round asks. */
export interface EnsureImagesRequest {
    /** The repository root, the build context. */
    readonly root: string
    /** The namespace kebab: the registry repository is `<kebab>-<name>`. */
    readonly kebab: string
    readonly images: ReadonlyArray<OwnImageRequest>
    /** The registry as the host reaches it (`localhost:<port>`); part of the pushed reference. */
    readonly registryHost: string
    /** The registry as pods reach it (`k3d-starci-registry:5000`). */
    readonly registryInCluster: string
}

const BUILD_TIMEOUT_MS = 30 * 60_000

/** Removes the `src-*` tags of a repository beyond the newest {@link KEEP_TAGS} (the current tag always survives): registry manifest delete plus local `docker image rm`. */
export const collectGarbage = async (deps: ImagesDependencies, repository: string, registryHost: string, currentTag: string): Promise<ReadonlyArray<string>> => {
    const present = (await deps.registry.tags(repository)).filter((tag) => tag.startsWith("src-"))
    const seen = (await deps.ledger.read())[repository] ?? {}
    const others = present
        .filter((tag) => tag !== currentTag)
        .sort((a, b) => (seen[b] ?? 0) - (seen[a] ?? 0) || (a < b ? -1 : 1))
    const kept = [currentTag, ...others.slice(0, KEEP_TAGS - 1)]
    const doomed = others.slice(KEEP_TAGS - 1)
    if (doomed.length > 0) {
        const keptDigests = new Set<string>()
        for (const tag of kept) {
            const digest = await deps.registry.digest(repository, tag)
            if (digest !== null) keptDigests.add(digest)
        }
        for (const tag of doomed) {
            const digest = await deps.registry.digest(repository, tag)
            if (digest !== null && !keptDigests.has(digest)) await deps.registry.deleteManifest(repository, digest)
            await deps.docker.try(["image", "rm", `${registryHost}/${repository}:${tag}`])
        }
    }
    await deps.ledger.update((data) => {
        const entry = data[repository] ?? {}
        for (const tag of Object.keys(entry)) if (!present.includes(tag) || doomed.includes(tag)) delete entry[tag]
        data[repository] = entry
    })
    return doomed
}

/** Builds (only when the content-hash tag is not in the registry), pushes and garbage-collects every own image; answers logical name to the reference pods pull. */
export const ensureImages = async (deps: ImagesDependencies, request: EnsureImagesRequest): Promise<Record<string, string>> => {
    const references: Record<string, string> = {}
    for (const image of request.images) {
        const repository = `${request.kebab}-${image.name}`
        const { tag } = await computeImageHash({ root: request.root, dockerfile: image.dockerfile })
        const reference = `${request.registryHost}/${repository}:${tag}`
        const existing = await deps.registry.tags(repository)
        const reuse = existing.includes(tag)
        if (!reuse) {
            await deps.docker.run(["build", "-f", join(request.root, image.dockerfile), "-t", reference, request.root], { timeoutMs: BUILD_TIMEOUT_MS })
            await deps.docker.run(["push", reference], { timeoutMs: BUILD_TIMEOUT_MS })
        }
        await deps.ledger.update((data) => {
            const entry = data[repository] ?? {}
            entry[tag] ??= deps.now()
            data[repository] = entry
        })
        if (!reuse) await collectGarbage(deps, repository, request.registryHost, tag)
        references[image.name] = `${request.registryInCluster}/${repository}:${tag}`
    }
    return references
}
