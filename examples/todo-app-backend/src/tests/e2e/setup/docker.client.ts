/**
 * Docker observation helpers for the resilience specs. They shell out to plain `docker` rather than `docker compose`:
 * a spec does not own the run-scoped environment the stack expanded at boot, so it cannot re-interpolate the compose
 * file. `docker start` puts back the identical container: same published ports, same volumes.
 */
import { execFileSync } from "node:child_process"
import { E2EError, E2EErrorCode } from "./e2e.error"

/** One `docker` invocation, trimmed stdout; throws when the engine errors. */
export const docker = (args: ReadonlyArray<string>): string =>
    execFileSync("docker", [...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim()

/** The same call as a list of non-empty output lines. */
export const dockerLines = (args: ReadonlyArray<string>): Array<string> =>
    docker(args)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

/** Whether a docker daemon answers at all, or the cause it did not: the skip gate of the resilience lane. */
export const dockerProbe = (): { readonly available: boolean; readonly cause?: unknown } => {
    try {
        execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "pipe", timeout: 20_000 })
        return { available: true }
    } catch (cause) {
        return { available: false, cause }
    }
}

const composeFilter = (project: string): Array<string> => ["--filter", `label=com.docker.compose.project=${project}`]

/** Container ids of the run project, or of one compose service of it. */
export const projectContainers = (project: string, service?: string): Array<string> =>
    dockerLines([
        "ps",
        "-a",
        ...composeFilter(project),
        ...(service ? ["--filter", `label=com.docker.compose.service=${service}`] : []),
        "--format",
        "{{.ID}}",
    ])

/** Names of the containers of the run project. */
export const projectContainerNames = (project: string): Array<string> =>
    dockerLines(["ps", "-a", ...composeFilter(project), "--format", "{{.Names}}"])

/** Names of the volumes of the run project. */
export const projectVolumeNames = (project: string): Array<string> =>
    dockerLines(["volume", "ls", "--filter", `name=${project}`, "--format", "{{.Name}}"])

/** Kills the container of one compose service of the run project and answers its id. */
export const killService = (project: string, service: string): string => {
    const id = projectContainers(project, service)[0]
    if (id === undefined) throw new E2EError({ code: E2EErrorCode.DockerFailed, params: { detail: `no container for ${service} in ${project}` } })
    docker(["kill", id])
    return id
}

/** Restarts a killed container: the identical container, same ports and volumes. */
export const startContainer = (id: string): void => {
    docker(["start", id])
}
