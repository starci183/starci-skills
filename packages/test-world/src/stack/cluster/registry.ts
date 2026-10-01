import { TestWorldErrorCode, worldError } from "../../errors"

/** The slice of a fetch response the registry client reads (the global `fetch` satisfies it). */
export interface FetchResponse {
    readonly status: number
    readonly ok: boolean
    readonly headers: { get(name: string): string | null }
    json(): Promise<unknown>
}

/** The slice of `fetch` the registry client uses; injected in tests. */
export type FetchFn = (url: string, init?: { readonly method?: string; readonly headers?: Readonly<Record<string, string>> }) => Promise<FetchResponse>

/** The manifest media types a HEAD must accept to obtain the digest of whatever `docker push` stored. */
export const MANIFEST_ACCEPT = [
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.oci.image.index.v1+json",
].join(", ")

/** The registry HTTP API (v2) the cluster layer needs. */
export interface RegistryClient {
    /** The tags of a repository (empty when the repository does not exist). */
    tags(repository: string): Promise<ReadonlyArray<string>>
    /** The manifest digest of a tag (`Docker-Content-Digest`), or null when absent. */
    digest(repository: string, tag: string): Promise<string | null>
    /** Deletes a manifest by digest (requires `REGISTRY_STORAGE_DELETE_ENABLED=true`). */
    deleteManifest(repository: string, digest: string): Promise<void>
}

/** Builds the client for a registry base URL (`http://127.0.0.1:<port>`). */
export const createRegistryClient = (baseUrl: string, fetchFn: FetchFn = (url, init) => fetch(url, init)): RegistryClient => ({
    async tags(repository) {
        const response = await fetchFn(`${baseUrl}/v2/${repository}/tags/list`)
        if (response.status === 404) return []
        if (!response.ok) throw worldError(TestWorldErrorCode.InfrastructureFailed, `registry ${baseUrl} answered ${response.status} listing tags of ${repository}`)
        const body = (await response.json()) as { tags?: ReadonlyArray<string> | null }
        return body.tags ?? []
    },
    async digest(repository, tag) {
        const response = await fetchFn(`${baseUrl}/v2/${repository}/manifests/${tag}`, { method: "HEAD", headers: { Accept: MANIFEST_ACCEPT } })
        return response.ok ? response.headers.get("docker-content-digest") : null
    },
    async deleteManifest(repository, digest) {
        const response = await fetchFn(`${baseUrl}/v2/${repository}/manifests/${digest}`, { method: "DELETE" })
        if (!response.ok && response.status !== 404) {
            throw worldError(TestWorldErrorCode.InfrastructureFailed, `registry ${baseUrl} answered ${response.status} deleting ${repository}@${digest}`)
        }
    },
})
