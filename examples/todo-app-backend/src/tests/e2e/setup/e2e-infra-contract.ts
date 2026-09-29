/**
 * Resilience-lane docker observation helpers.
 *
 * These specs are written against the frozen E2E-00/E2E-06 infra contract (ex-testing/ANALYSIS.md
 * §5): the world boots once through `bootE2EWorld`, `E2EStackService` owns compose up on module
 * init and `down -v` on shutdown. What remains here is the part that contract deliberately leaves
 * to the daemon: compose-project, container and loopback-URL lookups are read off docker itself
 * (deep-scan for the live compose project name, probe discovered loopback URLs for /health) so no
 * property-name choice in the infra implementation can break these specs.
 */
import {
    execFileSync 
} from "node:child_process"

/** Runs one docker CLI invocation and returns its trimmed stdout; throws on non-zero exit. */
export function docker(args: Array<string>): string {
    return execFileSync("docker",
        args,
        {
            encoding: "utf8", maxBuffer: 16 * 1024 * 1024 
        }).trim()
}

/** Runs one docker CLI invocation and returns its output as a list of non-empty lines. */
export function dockerLines(args: Array<string>): Array<string> {
    const out = docker(args)
    return out ? out.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : []
}

/** Whether the docker daemon answered `docker version`, and the error it failed with when it did not. */
export interface DockerProbe {
  available: boolean;
  cause?: unknown;
}

/** Asks the daemon for its version; the outcome carries the failure instead of swallowing it. */
export function dockerProbe(): DockerProbe {
    try {
        execFileSync("docker",
            ["version",
                "--format",
                "{{.Server.Version}}"],
            {
                stdio: "pipe", timeout: 20_000 
            })
        return {
            available: true 
        }
    } catch (cause) {
        return {
            available: false, cause 
        }
    }
}

/** True when the docker daemon answers `docker version`; the resilience specs skip when it cannot. */
export function dockerAvailable(): boolean {
    return dockerProbe().available
}

/** Every compose project label currently present on the daemon -- the ground truth the stack's own
 * project-name field is matched against, so no accessor-name guess is needed. */
function liveComposeProjects(): Set<string> {
    const labels = dockerLines(["ps",
        "-a",
        "--format",
        "{{.Label \"com.docker.compose.project\"}}"])
    return new Set(labels.filter(Boolean))
}

/** Finds the run-scoped compose project name wherever the stack service stores it. */
export function composeProjectOf(stack: unknown): string | null {
    const live = liveComposeProjects()
    let found: string | null = null
    const scan = (value: unknown, depth: number): void => {
        if (found !== null || value === null || value === undefined || depth < 0) return
        if (typeof value === "string") {
            if (live.has(value)) found = value
            return
        }
        if (typeof value === "object") {
            for (const key of Object.keys(value)) {
                scan((value as Record<string, unknown>)[key],
                    depth - 1)
            }
        }
    }
    scan(stack,
        5)
    return found
}

/** All loopback http(s) URLs stored anywhere on the stack object (baseUrl fields, per-service urls). */
export function loopbackUrlsOf(stack: unknown): Array<string> {
    const urls = new Set<string>()
    const scan = (value: unknown, depth: number): void => {
        if (value === null || value === undefined || depth < 0) return
        if (typeof value === "string") {
            if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(value)) urls.add(value.replace(/\/+$/,
                ""))
            return
        }
        if (typeof value === "object") {
            for (const key of Object.keys(value)) {
                scan((value as Record<string, unknown>)[key],
                    depth - 1)
            }
        }
    }
    scan(stack,
        5)
    return [...urls]
}

/** What `GET url` answered: the status, or null plus the error when the door never answered inside timeoutMs. */
export interface HttpProbe {
  status: number | null;
  cause?: unknown;
}

/** GET `url` and report the outcome, carrying the failure instead of swallowing it. */
export async function httpProbe(url: string, timeoutMs = 5_000): Promise<HttpProbe> {
    try {
        const response = await fetch(url,
            {
                signal: AbortSignal.timeout(timeoutMs) 
            })
        await response.arrayBuffer().catch((cause: unknown) => cause)
        return {
            status: response.status 
        }
    } catch (cause) {
        return {
            status: null, cause 
        }
    }
}

/** The HTTP status `GET url` answers with, or null when the door never answered inside timeoutMs. */
export async function httpStatus(url: string, timeoutMs = 5_000): Promise<number | null> {
    return (await httpProbe(url,
        timeoutMs)).status
}

/** `GET base/health` answered `{status:"ok"}`; anything else (no answer, keycloak, another door) is an outcome, not an error. */
async function isApiDoor(base: string): Promise<{ api: boolean; cause?: unknown }> {
    try {
        const response = await fetch(`${base}/health`,
            {
                signal: AbortSignal.timeout(4_000) 
            })
        if (response.status !== 200) return {
            api: false 
        }
        const body = (await response.json()) as { status?: string }
        return {
            api: body?.status === "ok" 
        }
    } catch (cause) {
        return {
            api: false, cause 
        }
    }
}

/** The subset of discovered URLs answering `GET /health` with `{status:'ok'}` -- the api doors only. */
export async function apiHealthUrls(stack: unknown): Promise<Array<string>> {
    const apis: Array<string> = []
    for (const base of loopbackUrlsOf(stack)) {
        if ((await isApiDoor(base)).api) apis.push(base)
    }
    return apis
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
    return [...new Set(labels.filter(Boolean))]
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

/**
 * Kill and later restart one service container with plain docker. Deliberately not
 * `docker compose kill/up`: those re-interpolate the compose file and this spec does not own the
 * run-scoped env (ports, credentials) the stack service expanded at boot time. `docker start` puts
 * back the identical container - same published ports, same volumes.
 */
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

/** Restarts a container killService stopped - the identical container, ports and volumes intact. */
export function startContainer(id: string): void {
    docker(["start",
        id])
}

/** One probe run: whether the state arrived, and the error the probe failed with when it threw. */
async function attemptOnce(probe: () => Promise<boolean>): Promise<{ done: boolean; error?: unknown }> {
    try {
        return {
            done: await probe() 
        }
    } catch (error) {
        return {
            done: false, error 
        }
    }
}

/**
 * Polls `probe` until it answers true or the deadline passes - the one wait a resilience spec may
 * do: a state (the api answering 503, the api answering 200 again), never a guessed duration. The
 * thrown error names the state that never arrived plus the last probe failure.
 */
export async function retryUntil(
    label: string,
    timeoutMs: number,
    probe: () => Promise<boolean>,
    intervalMs = 1_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs
    let last: unknown
    while (Date.now() < deadline) {
        const attempt = await attemptOnce(probe)
        if (attempt.done) return
        last = attempt.error
        await new Promise((resolve) => setTimeout(resolve,
            intervalMs))
    }
    throw new Error(`timed out waiting for ${label}${last ? ` (last error: ${last})` : ""}`)
}
