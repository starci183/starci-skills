import { freePorts } from "@e2e-kit/platform/free-ports"
import { retryUntil } from "@e2e-kit/platform/readiness"
import type { ReadinessResult } from "@e2e-kit/platform/readiness"
import { runToken, secret, specHash } from "@e2e-kit/platform/run-tokens"
import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import { spawn, spawnSync } from "node:child_process"
import type { ChildProcess } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { EnvSource } from "@modules/platform/config"
import { E2EError, E2EErrorCode } from "./e2e.error"

const BACKEND_ROOT = resolve(__dirname, "..", "..", "..", "..")
const COMPOSE_FILE = join(__dirname, "compose.e2e.yaml")
const SEEDS_ROOT = join(BACKEND_ROOT, ".starcistacks", "dev", "seeds")

/** The two deployables the stack spawns as host child processes. */
export type E2EServiceName = "identity" | "order"

/** Where one spawned api answers: its name, loopback base URL and run-allocated port. */
export interface E2EServiceEndpoint {
    /** The service. */
    readonly name: E2EServiceName
    /** The loopback base URL. */
    readonly baseUrl: string
    /** The port the OS allocated for this run. */
    readonly port: number
}

/** One entry of the teardown self-report: the step taken and what it observed. */
export interface E2ECleanupStep {
    /** What was done. */
    readonly step: string
    /** What it observed. */
    readonly detail?: string
}

/** The teardown self-report: whether nothing of this run survived, step by step. */
export interface E2ECleanupReport {
    /** True when no container and no volume of the run remain. */
    readonly clean: boolean
    /** The steps taken. */
    readonly steps: ReadonlyArray<E2ECleanupStep>
}

interface ShellResult {
    readonly status: number | null
    readonly stdout: string
    readonly stderr: string
}

interface SpawnedApi {
    readonly name: E2EServiceName
    readonly port: number
    readonly child: ChildProcess
}

const stackFailure = (detail: string, cause?: unknown): E2EError =>
    new E2EError({ code: E2EErrorCode.StackFailed, params: { detail }, cause })

/**
 * The run-owned ephemeral stack. ONE compose project carries postgres and redis; the identity and order apis boot as
 * host child processes of this run, configured through their environment exactly like a deployment, identity first
 * and order only after identity answers /health (order own /health is itself a live call to identity). Nothing here
 * can reach the dev stack: every host port comes from the OS on 127.0.0.1, the project and its volume are run-scoped,
 * and disposal is `docker compose down -v` against that one project, verified by observation afterwards.
 */
export class E2EStack {
    /** The compose project name of this run. */
    readonly project: string
    /** What was awaited during boot, in order. */
    readonly readiness: Array<ReadinessResult> = []
    /** The teardown self-report, set once `close` ran. */
    cleanupReport: E2ECleanupReport | null = null

    private readonly password = secret()
    private readonly apis: Array<SpawnedApi> = []
    private endpoints: Readonly<Record<E2EServiceName, E2EServiceEndpoint>> | null = null
    private booted: Promise<void> | null = null
    private closed = false
    private pgPort = 0
    private redisPort = 0

    constructor(
        specId: string,
        private readonly env: EnvSource,
    ) {
        this.project = `ec-e2e-${specHash(specId)}-${runToken(4)}`
    }

    /** Boots the stack once; a second call answers the first boot. */
    boot(): Promise<void> {
        this.booted ??= this.bootOnce()
        return this.booted
    }

    /** Where one api answers; only valid after `boot`. */
    endpoint(service: E2EServiceName): E2EServiceEndpoint {
        const found = this.endpoints?.[service]
        if (!found) throw stackFailure(`endpoint of ${service} requested before boot`)
        return found
    }

    /** The URL of one database of this run, for out-of-band verification only: never to shortcut a flow. */
    databaseUrl(service: E2EServiceName): string {
        return `postgres://e2e:${this.password}@127.0.0.1:${this.pgPort}/ecommerce_${service}`
    }

    /** Disposes exactly what this run created, then verifies by observation that it is gone. */
    close(): void {
        if (this.closed) return
        this.closed = true
        const steps: Array<E2ECleanupStep> = []
        for (const api of [...this.apis].reverse()) {
            if (api.child.exitCode !== null) continue
            steps.push({ step: `terminate ${api.name} api process`, detail: `signal sent: ${api.child.kill("SIGTERM")}` })
        }
        const down = this.compose(["down", "-v", "--remove-orphans", "--timeout", "20"])
        steps.push({ step: "docker compose down -v --remove-orphans", detail: `exit ${down.status}` })
        const containers = this.docker(["ps", "-a", "--filter", `label=com.docker.compose.project=${this.project}`, "--format", "{{.Names}}"])
        const volumes = this.docker(["volume", "ls", "--filter", `name=${this.project}`, "--format", "{{.Name}}"])
        steps.push({ step: "verify no container of this project remains", detail: containers.stdout.trim() || "(none)" })
        steps.push({ step: "verify no volume of this project remains", detail: volumes.stdout.trim() || "(none)" })
        this.cleanupReport = { steps, clean: !containers.stdout.trim() && !volumes.stdout.trim() }
    }

    private async bootOnce(): Promise<void> {
        try {
            this.ensureBuilt()
            const [pgPort, redisPort, identityPort, orderPort] = await freePorts(4)
            this.pgPort = pgPort ?? 0
            this.redisPort = redisPort ?? 0
            const up = this.compose(["up", "-d", "--wait"], 300_000)
            if (up.status !== 0) throw stackFailure(`docker compose up failed (exit ${up.status}): ${up.stderr || up.stdout}`)
            this.readiness.push(await retryUntil("postgres", 120_000, () => Promise.resolve(this.compose(["exec", "-T", "postgres", "pg_isready", "-U", "e2e"]).status === 0)))
            this.readiness.push(await retryUntil("redis", 60_000, () => Promise.resolve(this.compose(["exec", "-T", "redis", "redis-cli", "ping"]).stdout.trim() === "PONG")))
            this.createDatabases()
            this.migrate()
            this.seed()
            const identity = this.spawnApi("identity", identityPort ?? 0, orderPort ?? 0)
            this.readiness.push(await retryUntil("identity /health", 120_000, () => this.isHealthy(identity)))
            const order = this.spawnApi("order", orderPort ?? 0, identityPort ?? 0)
            this.readiness.push(await retryUntil("order /health", 120_000, () => this.isHealthy(order)))
            this.endpoints = { identity: this.endpointOf("identity", identityPort ?? 0), order: this.endpointOf("order", orderPort ?? 0) }
        } catch (error) {
            this.close()
            throw error
        }
    }

    private endpointOf(name: E2EServiceName, port: number): E2EServiceEndpoint {
        return { name, port, baseUrl: `http://127.0.0.1:${port}` }
    }

    /** The compiled entrypoints must exist before any docker work starts; build once if they do not. */
    private ensureBuilt(): void {
        const entries = ["identity", "order", "migrate"].map((app) => join(BACKEND_ROOT, "dist", "apps", app, "src", "main.js"))
        if (entries.every((entry) => existsSync(entry))) return
        const npm = process.platform === "win32" ? "npm.cmd" : "npm"
        const build = spawnSync(npm, ["run", "build"], { cwd: BACKEND_ROOT, encoding: "utf8", timeout: 120_000, env: this.childEnv({}) })
        if (build.status !== 0 || !entries.every((entry) => existsSync(entry))) {
            throw stackFailure(`npm run build failed (exit ${build.status}): ${build.stderr || build.stdout}`)
        }
    }

    /** The environment of a compiled child: the parent environment, tsconfig-paths pointed at dist, and what the app itself reads. */
    private childEnv(app: Readonly<Record<string, string>>): Record<string, string> {
        return this.env.toChildEnv({ TS_NODE_BASEURL: join(BACKEND_ROOT, "dist"), ...app })
    }

    private appEnv(name: E2EServiceName, port: number, peerPort: number): Record<string, string> {
        const shared = {
            HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:4069",
            HTTP_SECURITY_RATE_DEFAULT_LIMIT: "100000",
            HTTP_SECURITY_RATE_STRICT_LIMIT: "100000",
        }
        return name === "identity"
            ? {
                  ...shared,
                  IDENTITY_API_PORT: String(port),
                  IDENTITY_DB_URL: this.databaseUrl("identity"),
                  CACHE_REDIS_URL: `redis://127.0.0.1:${this.redisPort}/0`,
                  ORDER_API_URL: `http://127.0.0.1:${peerPort}`,
              }
            : {
                  ...shared,
                  ORDER_API_PORT: String(port),
                  ORDER_DB_URL: this.databaseUrl("order"),
                  IDENTITY_API_URL: `http://127.0.0.1:${peerPort}`,
              }
    }

    private createDatabases(): void {
        for (const database of ["ecommerce_identity", "ecommerce_order"]) {
            const created = this.psql("postgres", ["-c", `CREATE DATABASE ${database}`])
            if (created.status !== 0) throw stackFailure(`creating ${database} failed: ${created.stderr}`)
        }
    }

    /** The schema comes only from apps/migrate (an api never migrates): it applies both connections once against this run fresh volume. */
    private migrate(): void {
        const result = spawnSync(process.execPath, ["-r", "tsconfig-paths/register", join(BACKEND_ROOT, "dist", "apps", "migrate", "src", "main.js")], {
            cwd: BACKEND_ROOT,
            encoding: "utf8",
            env: this.childEnv({ IDENTITY_DB_URL: this.databaseUrl("identity"), ORDER_DB_URL: this.databaseUrl("order") }),
        })
        if (result.error) throw stackFailure("the migrate app could not start", result.error)
        if (result.status !== 0) throw stackFailure(`migrate failed (exit ${result.status}): ${result.stderr || result.stdout}`)
    }

    /** The demo catalog and the demo person are seeds of .starcistacks/dev/seeds, applied after the migrations. */
    private seed(): void {
        const seeds: ReadonlyArray<readonly [string, string]> = [
            ["ecommerce_order", "order-catalog.sql"],
            ["ecommerce_identity", "identity-demo.sql"],
        ]
        for (const [database, file] of seeds) {
            const applied = this.psql(database, ["-v", "ON_ERROR_STOP=1", "-f", "-"], readFileSync(join(SEEDS_ROOT, file), "utf8"))
            if (applied.status !== 0) throw stackFailure(`seed ${file} failed: ${applied.stderr}`)
        }
    }

    private spawnApi(name: E2EServiceName, port: number, peerPort: number): SpawnedApi {
        const logDir = join(tmpdir(), this.project)
        mkdirSync(logDir, { recursive: true })
        const logPath = join(logDir, `${name}.log`)
        const child = spawn(process.execPath, ["-r", "tsconfig-paths/register", join(BACKEND_ROOT, "dist", "apps", name, "src", "main.js")], {
            cwd: BACKEND_ROOT,
            env: this.childEnv(this.appEnv(name, port, peerPort)),
            stdio: ["ignore", "pipe", "pipe"],
        })
        const append = (chunk: Buffer): void => appendFileSync(logPath, chunk)
        child.stdout.on("data", append)
        child.stderr.on("data", append)
        const api: SpawnedApi = { name, port, child }
        this.apis.push(api)
        return api
    }

    private async isHealthy(api: SpawnedApi): Promise<boolean> {
        const response = await createE2EHttpClient({ baseUrl: `http://127.0.0.1:${api.port}`, timeoutMs: 4000 }).get<{ status?: string }>("/health")
        return response.status === 200 && response.body.status === "ok"
    }

    private psql(database: string, args: ReadonlyArray<string>, input?: string): ShellResult {
        return this.compose(["exec", "-T", "postgres", "psql", "-U", "e2e", "-d", database, ...args], 60_000, input)
    }

    private compose(args: ReadonlyArray<string>, timeoutMs = 60_000, input?: string): ShellResult {
        return this.run("docker", ["compose", "-p", this.project, "-f", COMPOSE_FILE, ...args], timeoutMs, input)
    }

    private docker(args: ReadonlyArray<string>): ShellResult {
        return this.run("docker", args, 60_000)
    }

    /** Every docker call is bounded: an unresponsive engine must fail the spec, not hang it. */
    private run(command: string, args: ReadonlyArray<string>, timeoutMs: number, input?: string): ShellResult {
        const result = spawnSync(command, [...args], {
            cwd: BACKEND_ROOT,
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
            timeout: timeoutMs,
            input,
            env: this.env.toChildEnv({
                E2E_COMPOSE_PROJECT: this.project,
                E2E_PG_PORT: String(this.pgPort),
                E2E_REDIS_PORT: String(this.redisPort),
                E2E_PG_USER: "e2e",
                E2E_PG_PASSWORD: this.password,
            }),
        })
        if (result.error) throw stackFailure(`${command} could not run`, result.error)
        return { status: result.status, stdout: result.stdout, stderr: result.stderr }
    }
}
