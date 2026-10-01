import { createHash } from "node:crypto"
import { homedir } from "node:os"
import { join } from "node:path"

/** The k3s image of the shared cluster unless `STARCI_TEST_K3S_IMAGE` overrides it. */
export const DEFAULT_K3S_IMAGE = "rancher/k3s:v1.31.5-k3s1"
/** The container name of the local registry (also its DNS name inside the cluster network). */
export const REGISTRY_CONTAINER = "k3d-starci-registry"
/** The registry image used for the local registry and the pull-through mirrors. */
export const REGISTRY_IMAGE = "registry:2"
/** The port a registry container listens on. */
export const REGISTRY_PORT = 5000
/** The label every namespace of a repository carries (value: the namespace kebab). */
export const NAMESPACE_LABEL = "starci.test-world/namespace"

/** One vendor registry mirrored through a pull-through registry container. */
export interface MirrorSpec {
    /** Short name; the container is `k3d-starci-mirror-<name>`. */
    readonly name: string
    /** The registry host containerd asks for. */
    readonly host: string
    /** The upstream the mirror proxies. */
    readonly remoteUrl: string
}

/** The vendor registries mirrored so repeated runs and repositories never re-pull vendor images. */
export const MIRRORS: ReadonlyArray<MirrorSpec> = [
    { name: "docker", host: "docker.io", remoteUrl: "https://registry-1.docker.io" },
    { name: "ghcr", host: "ghcr.io", remoteUrl: "https://ghcr.io" },
    { name: "quay", host: "quay.io", remoteUrl: "https://quay.io" },
    { name: "k8s", host: "registry.k8s.io", remoteUrl: "https://registry.k8s.io" },
]

/** The container name of one mirror. */
export const mirrorContainer = (mirror: MirrorSpec): string => `k3d-starci-mirror-${mirror.name}`

/** The names derived from the k3s image. */
export interface ClusterNames {
    readonly k3sImage: string
    /** `starci-<8 hex of sha256(k3sImage)>`. */
    readonly cluster: string
    /** `k3d-<cluster>-server-0`. */
    readonly server: string
    /** `k3d-<cluster>`: the docker network of the cluster, shared with the registries. */
    readonly network: string
}

/** Derives the cluster names from the k3s image. */
export const clusterNames = (k3sImage: string): ClusterNames => {
    const cluster = `starci-${createHash("sha256").update(k3sImage).digest("hex").slice(0, 8)}`
    return { k3sImage, cluster, server: `k3d-${cluster}-server-0`, network: `k3d-${cluster}` }
}

/** The k3s image in force: the env override or the default. */
export const resolveK3sImage = (env: Readonly<Record<string, string | undefined>> = process.env): string => {
    const override = env.STARCI_TEST_K3S_IMAGE
    return override !== undefined && override.trim() !== "" ? override.trim() : DEFAULT_K3S_IMAGE
}

/** The machine home of the stack: the given directory, `STARCI_TEST_STACK_HOME` or `~/.starci/test-stack`. */
export const resolveHome = (home?: string): string => home ?? process.env.STARCI_TEST_STACK_HOME ?? join(homedir(), ".starci", "test-stack")

/** Renders the k3d registries config (k3s `registries.yaml`): every vendor registry goes through its mirror. */
export const renderRegistryConfig = (): string => {
    const lines = ["mirrors:"]
    for (const mirror of MIRRORS) {
        lines.push(`  "${mirror.host}":`, "    endpoint:", `      - "http://${mirrorContainer(mirror)}:${REGISTRY_PORT}"`)
    }
    return `${lines.join("\n")}\n`
}
