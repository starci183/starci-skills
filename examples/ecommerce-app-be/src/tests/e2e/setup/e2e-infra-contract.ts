/**
 * Docker observation helpers for the resilience specs.
 *
 * These helpers deliberately shell out to plain `docker` rather than `docker compose`: the spec
 * does not own the run-scoped env (ports, credentials) the stack service expanded at boot time,
 * so re-interpolating the compose file is impossible anyway. `docker start` puts back the
 * identical container - same published ports, same volumes. The stack itself (its project name,
 * its endpoints, its cleanup report) is read straight off the typed E2EStackService the world
 * helper returns.
 */
import {
    execFileSync 
} from "node:child_process"

/** One `docker` invocation, trimmed stdout; throws when the engine errors. */
export function docker(args: Array<string>): string {
    return execFileSync("docker",
        args,
        {
            encoding: "utf8", maxBuffer: 16 * 1024 * 1024 
        }).trim()
}

/** The same call as a list of non-empty output lines. */
export function dockerLines(args: Array<string>): Array<string> {
    const out = docker(args)
    return out ? out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []
}

/** Whether a docker daemon answers at all - the skip gate for the resilience lane. */
export function dockerAvailable(): boolean {
    try {
        execFileSync("docker",
            ["version",
                "--format",
                "{{.Server.Version}}"],
            {
                stdio: "pipe", timeout: 20_000 
            })
        return true
    } catch {
        return false
    }
}

/** A loopback URL's HTTP status within `timeoutMs`, or null when nothing answers. */
export async function httpStatus(url: string, timeoutMs = 5_000): Promise<number | null> {
    try {
        const response = await fetch(url,
            {
                signal: AbortSignal.timeout(timeoutMs) 
            })
        await response.arrayBuffer().catch(() => undefined)
        return response.status
    } catch {
        return null
    }
}

/** Compose service names this run actually has containers for -- from docker labels, so the spec
 * never hardcodes the stack's spelling or needs the compose file's run-scoped env vars. */
export function projectServices(project: string): Array<string> {
    const labels = dockerLines([
        "ps",
        "-a",
        "--filter",
        `label=com.docker.compose.project=${project}`,
        "--format",
        "{{.Label \"com.docker.compose.service\"}}",
    ])
    return [...new Set(labels)]
}

/** Container id of one compose service inside the run's project. */
export function projectContainer(project: string, service: string): string | null {
    return (
        dockerLines([
            "ps",
            "-a",
            "--filter",
            `label=com.docker.compose.project=${project}`,
            "--filter",
            `label=com.docker.compose.service=${service}`,
            "--format",
            "{{.ID}}",
        ])[0] ?? null
    )
}

/** Kills one service container by name pattern and returns which service and id it was. */
export function killService(project: string, servicePattern: RegExp): { service: string; id: string } {
    const service = projectServices(project).find((name) => servicePattern.test(name))
    if (!service) throw new Error(`no service matching ${servicePattern} in project ${project}`)
    const id = projectContainer(project,
        service)
    if (!id) throw new Error(`no container for service ${service} in project ${project}`)
    docker(["kill",
        id])
    return {
        service, id 
    }
}

/** Restarts a killed container - the identical container, same ports and volumes. */
export function startContainer(id: string): void {
    docker(["start",
        id])
}

/** Polls `probe` until it answers true or `timeoutMs` elapses; the last error names the timeout. */
export async function retryUntil(
    label: string,
    timeoutMs: number,
    probe: () => Promise<boolean>,
    intervalMs = 1_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs
    let last: unknown
    while (Date.now() < deadline) {
        try {
            if (await probe()) return
        } catch (e) {
            last = e
        }
        await new Promise((resolve) => setTimeout(resolve,
            intervalMs))
    }
    throw new Error(`timed out waiting for ${label}${last ? ` (last error: ${last})` : ""}`)
}
