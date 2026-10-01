import type { Docker } from "./docker"
import { LABEL_IMAGE, LABEL_SERVICE, LABEL_STACK, STACK_NETWORK } from "./naming"

/** One shared container to run. */
export interface ContainerSpec {
    readonly name: string
    readonly image: string
    /** The service label value (`postgresql`, `toxiproxy`, ...). */
    readonly service: string
    /** `docker run -p` values. */
    readonly publish: ReadonlyArray<string>
    readonly env: Readonly<Record<string, string>>
    readonly command: ReadonlyArray<string>
}

/** The `docker run` arguments of a spec: stack network, restart `no`, the three stack labels. */
export const dockerRunArgs = (spec: ContainerSpec): ReadonlyArray<string> => [
    "run",
    "-d",
    "--name",
    spec.name,
    "--network",
    STACK_NETWORK,
    "--restart",
    "no",
    "--label",
    `${LABEL_STACK}=1`,
    "--label",
    `${LABEL_SERVICE}=${spec.service}`,
    "--label",
    `${LABEL_IMAGE}=${spec.image}`,
    ...spec.publish.flatMap((port) => ["-p", port]),
    ...Object.entries(spec.env).flatMap(([key, value]) => ["-e", `${key}=${value}`]),
    spec.image,
    ...spec.command,
]

/** What `ensureContainer` did. */
export type EnsureOutcome = "running" | "started" | "created"

/**
 * Makes the container exist and run. The name is deterministic, so a `docker run` that loses a race (a concurrent process
 * created it first) is resolved by re-inspecting: the container is then simply used.
 */
export const ensureContainer = async (docker: Docker, spec: ContainerSpec): Promise<EnsureOutcome> => {
    const state = await docker.state(spec.name)
    if (state === "running") return "running"
    if (state !== "missing") {
        await docker.run(["start", spec.name])
        return "started"
    }
    const created = await docker.try(dockerRunArgs(spec))
    if (created.code === 0) return "created"
    const after = await docker.state(spec.name)
    if (after === "missing") await docker.run(dockerRunArgs(spec))
    if (after === "exited" || after === "created") await docker.run(["start", spec.name])
    return "running"
}
