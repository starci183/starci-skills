import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { TestWorldErrorCode, worldError } from "../../errors"
import { Docker } from "../docker"
import { execCommand } from "../exec"
import type { Exec } from "../exec"
import type { ClusterApi, StackContainerStatus } from "../contracts"
import { clusterNames, MIRRORS, mirrorContainer, REGISTRY_CONTAINER, REGISTRY_IMAGE, REGISTRY_PORT, renderRegistryConfig, resolveHome, resolveK3sImage } from "./config"
import { createKubectl } from "./kubectl"
import { ensureImages } from "./images"
import { createLedger } from "./ledger"
import { withLock } from "./lock"
import { deleteNamespaces, listNamespaces } from "./namespaces"
import { realClock } from "./poll"
import type { Clock } from "./poll"
import { createRegistryClient } from "./registry"
import type { FetchFn } from "./registry"

export { createClusterClient, parsePods } from "./client"
export { computeImageHash, parseCopySources } from "./image-hash"

/** What {@link createCluster} may be given; every field defaults to the real thing. */
export interface ClusterDependencies {
    readonly docker?: Docker
    readonly exec?: Exec
    /** The machine home (`<home>/cluster/` holds locks, the registries config and the image ledger). */
    readonly home?: string
    /** Sleeps between polls. */
    readonly pause?: (ms: number) => Promise<void>
    /** The k3s image (default: `STARCI_TEST_K3S_IMAGE` or the built-in one). */
    readonly k3sImage?: string
    /** Whether a live lease still uses the cluster (owned by the stack registry); `down` refuses while true unless `force`. */
    readonly isBusy?: () => Promise<boolean>
    readonly fetch?: FetchFn
    readonly now?: () => number
}

const containerState = (state: string): StackContainerStatus["state"] => (state === "running" ? "running" : state === "missing" ? "missing" : "exited")

/** Builds the cluster layer. */
export const createCluster = (dependencies: ClusterDependencies = {}): ClusterApi => {
    const exec = dependencies.exec ?? dependencies.docker?.exec ?? execCommand
    const docker = dependencies.docker ?? new Docker(exec)
    const names = clusterNames(dependencies.k3sImage ?? resolveK3sImage())
    const dir = join(resolveHome(dependencies.home), "cluster")
    const clock: Clock = { now: dependencies.now ?? realClock.now, pause: dependencies.pause ?? realClock.pause }
    const lock = <T>(name: string, action: () => Promise<T>): Promise<T> => withLock(join(dir, name), action, { clock })
    const ledger = createLedger(join(dir, "images.json"), join(dir, "images.lock"))
    const registryConfigFile = join(dir, "registries.yaml")
    const kubectl = createKubectl(exec, names.server)

    const k3d = async (args: ReadonlyArray<string>, timeoutMs = 600_000): Promise<string> => {
        let result
        try {
            result = await exec("k3d", args, { timeoutMs })
        } catch (cause) {
            throw worldError(TestWorldErrorCode.InfrastructureFailed, `k3d is not available on PATH (${String(cause)}); install k3d (https://k3d.io) and make sure "k3d version" works`, cause)
        }
        if (result.code !== 0) {
            throw worldError(TestWorldErrorCode.InfrastructureFailed, `k3d ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim().slice(0, 2000)}`)
        }
        return result.stdout.trim()
    }

    const ensureContainer = async (name: string, runArgs: ReadonlyArray<string>): Promise<void> => {
        const state = await docker.state(name)
        if (state === "running") return
        if (state === "missing") await docker.run(["run", "-d", "--name", name, "--restart", "unless-stopped", "--network", names.network, ...runArgs, REGISTRY_IMAGE])
        else await docker.run(["start", name])
    }

    const up = (): Promise<void> =>
        lock("cluster.lock", async () => {
            await k3d(["version"], 30_000)
            await mkdir(dir, { recursive: true })
            await docker.ensureNetwork(names.network)
            await ensureContainer(REGISTRY_CONTAINER, ["-p", `127.0.0.1::${REGISTRY_PORT}`, "-v", `${REGISTRY_CONTAINER}:/var/lib/registry`, "-e", "REGISTRY_STORAGE_DELETE_ENABLED=true"])
            for (const mirror of MIRRORS) {
                const name = mirrorContainer(mirror)
                await ensureContainer(name, ["-v", `${name}:/var/lib/registry`, "-e", `REGISTRY_PROXY_REMOTEURL=${mirror.remoteUrl}`])
            }
            await writeFile(registryConfigFile, renderRegistryConfig())
            const state = await docker.state(names.server)
            if (state === "running") return
            if (state === "missing") {
                await k3d([
                    "cluster", "create", names.cluster,
                    "--image", names.k3sImage,
                    "--servers", "1",
                    "--agents", "0",
                    "--network", names.network,
                    "--registry-use", `${REGISTRY_CONTAINER}:${REGISTRY_PORT}`,
                    "--registry-config", registryConfigFile,
                    "--no-lb",
                    "--k3s-arg", "--disable=traefik@server:0",
                    "--k3s-arg", "--disable=servicelb@server:0",
                    "--kubeconfig-update-default=false",
                    "--kubeconfig-switch-context=false",
                    "--wait",
                ])
            } else {
                await k3d(["cluster", "start", names.cluster, "--wait"])
            }
        })

    const clearNamespaces = async (prefix: string): Promise<void> => {
        if ((await docker.state(names.server)) !== "running") return
        await deleteNamespaces(kubectl, prefix, await listNamespaces(kubectl, prefix), { clock })
    }

    return {
        up,
        async attach(request) {
            const port = await docker.hostPort(REGISTRY_CONTAINER, REGISTRY_PORT)
            if (port === null) throw worldError(TestWorldErrorCode.InfrastructureFailed, `the local registry ${REGISTRY_CONTAINER} is not running; the cluster layer must be up before attach`)
            const registryHost = `localhost:${port}`
            const registryInCluster = `${REGISTRY_CONTAINER}:${REGISTRY_PORT}`
            const registry = createRegistryClient(`http://127.0.0.1:${port}`, dependencies.fetch)
            const images = await ensureImages(
                { docker, registry, ledger, now: dependencies.now ?? Date.now },
                { root: request.root, kebab: request.namespace.kebab, images: request.images, registryHost, registryInCluster },
            )
            return { cluster: names.cluster, serverContainer: names.server, registry: registryHost, registryInCluster, namespacePrefix: `${request.namespace.kebab}-`, images }
        },
        reset: (request) => clearNamespaces(`${request.namespace.kebab}-`),
        detach: (request) => clearNamespaces(`${request.namespace.kebab}-`),
        async status() {
            const rows: Array<StackContainerStatus> = [
                { service: "k3d", image: names.k3sImage, container: names.server, state: containerState(await docker.state(names.server)), port: null },
                {
                    service: "registry",
                    image: REGISTRY_IMAGE,
                    container: REGISTRY_CONTAINER,
                    state: containerState(await docker.state(REGISTRY_CONTAINER)),
                    port: await docker.hostPort(REGISTRY_CONTAINER, REGISTRY_PORT),
                },
            ]
            for (const mirror of MIRRORS) {
                const container = mirrorContainer(mirror)
                rows.push({ service: "registry", image: REGISTRY_IMAGE, container, state: containerState(await docker.state(container)), port: null })
            }
            return rows
        },
        async down(options = {}) {
            if (options.force !== true && dependencies.isBusy !== undefined && (await dependencies.isBusy())) return
            await lock("cluster.lock", async () => {
                if ((await docker.state(names.server)) !== "missing") await k3d(["cluster", "delete", names.cluster])
                await docker.remove(REGISTRY_CONTAINER)
                for (const mirror of MIRRORS) await docker.remove(mirrorContainer(mirror))
                await docker.try(["volume", "rm", REGISTRY_CONTAINER])
                await docker.try(["network", "rm", names.network])
                await rm(join(dir, "images.json"), { force: true })
            })
        },
    }
}

/** The real cluster layer (real docker, k3d and home). */
export const clusterApi: ClusterApi = createCluster()
