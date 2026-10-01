/**
 * Sibling services: our own images from other repositories, pinned by the stack definition, run as containers on the shared
 * docker network. They reach the infrastructure of the run through `host.docker.internal` (the toxiproxy ports on the host).
 */
import { TestWorldErrorCode, worldError } from "../errors"
import type { SiblingServiceDeclaration } from "../config/types"
import { Docker } from "../stack/docker"
import { pause } from "../nest/poll"
import { buildWiring } from "../nest/wiring"
import type { RunContext } from "./context"

const NETWORK = "starci-test-net"
const HEALTH_DEADLINE_MS = 120_000

/** One running sibling. */
export interface StartedSibling {
    readonly name: string
    readonly container: string
    readonly port: number
    readonly url: string
}

/** Starts every declared sibling; on failure removes the ones already started. */
export const startSiblings = async (
    declared: Readonly<Record<string, SiblingServiceDeclaration>>,
    images: Readonly<Record<string, string>>,
    context: RunContext,
    docker: Docker = new Docker(),
): Promise<ReadonlyArray<StartedSibling>> => {
    const started: Array<StartedSibling> = []
    try {
        for (const [name, declaration] of Object.entries(declared)) {
            const image = images[name]
            if (image === undefined) throw worldError(TestWorldErrorCode.StackDefinition, `sibling service ${name} has no image`)
            const port = declaration.port ?? 8080
            const container = `starci-ts-sib-${context.namespace.kebab}-${name}-${context.runId}`.toLowerCase()
            const env = declaration.env?.(buildWiring(context, { host: "host.docker.internal" })) ?? {}
            await docker.ensureNetwork(NETWORK)
            await docker.run([
                "run", "-d", "--name", container, "--network", NETWORK,
                "--add-host", "host.docker.internal:host-gateway",
                "--label", "starci.test-stack=1", "--label", `starci.run=${context.runId}`,
                "-p", `127.0.0.1::${port}`,
                ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
                image,
            ])
            const hostPort = await docker.hostPort(container, port)
            if (hostPort === null) throw worldError(TestWorldErrorCode.InfrastructureFailed, `sibling ${name} publishes no port ${port}`)
            const sibling: StartedSibling = { name, container, port: hostPort, url: `http://127.0.0.1:${hostPort}` }
            started.push(sibling)
            await waitHealthy(sibling, declaration.health ?? "/health/ready")
        }
        return started
    } catch (cause) {
        await removeSiblings(started, docker)
        throw cause
    }
}

const waitHealthy = async (sibling: StartedSibling, path: string): Promise<void> => {
    const deadline = Date.now() + HEALTH_DEADLINE_MS
    for (;;) {
        try {
            const response = await fetch(`${sibling.url}${path}`, { signal: AbortSignal.timeout(3_000) })
            if (response.ok) return
        } catch {
            // not listening yet
        }
        if (Date.now() > deadline) throw worldError(TestWorldErrorCode.InfrastructureFailed, `sibling ${sibling.name} did not become healthy at ${path} within ${HEALTH_DEADLINE_MS}ms`)
        await pause(1_000)
    }
}

/** Removes the sibling containers of a run. */
export const removeSiblings = async (siblings: ReadonlyArray<StartedSibling>, docker: Docker = new Docker()): Promise<void> => {
    for (const sibling of siblings) await docker.remove(sibling.container)
}
