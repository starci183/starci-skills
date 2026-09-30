import { freePorts } from "@e2e-kit/platform/free-ports"
import { retryUntil } from "@e2e-kit/platform/readiness"
import type { ReadinessResult } from "@e2e-kit/platform/readiness"
import { runToken, secret, specHash } from "@e2e-kit/platform/run-tokens"
import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import { spawn, spawnSync } from "node:child_process"
import type { ChildProcess } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, sep } from "node:path"
import type { EnvSource } from "@modules/platform/config"
import { E2ESepayGateway } from "./e2e-sepay.gateway"
import { E2EError, E2EErrorCode } from "./e2e.error"

const BACKEND_ROOT = resolve(__dirname, "..", "..", "..", "..")
const COMPOSE_FILE = join(__dirname, "compose.e2e.yaml")
const REALM = "todo"
const PUBLIC_CLIENT = "todo-api"
const DATABASE = "todo"
const PG_USER = "e2e"
const WORKER_STARTED_EVENT = "worker.started"
const JOB_COMPLETED_EVENT = "scheduling.job.completed"

/** The three deployables of the app: the api and the worker run as host child processes, the migrate app runs once. */
type AppName = "todo" | "worker" | "migrate"

const COMPILED_APPS: ReadonlyArray<AppName> = ["todo", "worker", "migrate"]

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

interface SpawnedApp {
    readonly name: AppName
    readonly child: ChildProcess
    readonly logPath: string
}

const stackFailure = (detail: string, cause?: unknown): E2EError =>
    new E2EError({ code: E2EErrorCode.StackFailed, params: { detail }, cause })

/** Newest mtime among the compiled sources under `dir`: unit specs and the tests tree are not part of the build. */
const newestSourceMtimeMs = (dir: string): number => {
    let newest = 0
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== "tests") newest = Math.max(newest, newestSourceMtimeMs(full))
        } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
            newest = Math.max(newest, statSync(full).mtimeMs)
        }
    }
    return newest
}

/** True when one line of the worker log is the JSON event that the named job finished a run. */
const isJobCompletedLine = (line: string, job: string): boolean => {
    try {
        const parsed: unknown = JSON.parse(line)
        return (
            typeof parsed === "object" &&
            parsed !== null &&
            "event" in parsed &&
            parsed.event === JOB_COMPLETED_EVENT &&
            "job" in parsed &&
            parsed.job === job
        )
    } catch {
        return false
    }
}

const mainOf =(app: AppName): string => join(BACKEND_ROOT, "dist", "apps", app, "src", "main.js")

/**
 * The run-owned ephemeral stack. ONE compose project carries postgres and keycloak; a loopback stand-in for the SePay
 * create-intent endpoint runs inside the test process; apps/migrate applies the schema of the one `primary` database once,
 * then the compiled api (apps/todo) and worker (apps/worker) boot as host child processes of this run, configured only
 * through their environment exactly like a deployment. Nothing here can reach the dev stack: every host port comes from
 * the OS on 127.0.0.1, the project and its volume are run-scoped, and disposal is `docker compose down -v` against that one
 * project, verified by observation afterwards.
 */
export class E2EStack {
    /** The compose project name of this run. */
    readonly project: string
    /** What was awaited during boot, in order. */
    readonly readiness: Array<ReadinessResult> = []
    /** The teardown self-report, set once `close` ran. */
    cleanupReport: E2ECleanupReport | null = null
    /** The run-generated shared secret the gateway signs webhook deliveries with. */
    readonly webhookSecret = secret()
    /** The realm-admin pair generated for this run; the auth helper uses it to create and delete accounts. */
    readonly keycloakAdmin = { username: "e2e-admin", password: secret() }

    private readonly password = secret()
    private readonly apiKey = secret()
    private readonly uploadSigningSecret = secret()
    private readonly logDir: string
    private readonly apps: Array<SpawnedApp> = []
    private gatewayHandle: E2ESepayGateway | null = null
    private booted: Promise<void> | null = null
    private closed = false
    private pgPort = 0
    private keycloakPort = 0
    private apiPort = 0

    constructor(
        specId: string,
        private readonly env: EnvSource,
    ) {
        this.project = `todo-e2e-${specHash(specId)}-${runToken(4)}`
        this.logDir = join(tmpdir(), "todo-e2e", this.project)
    }

    /** Boots the stack once; a second call answers the first boot. */
    boot(): Promise<void> {
        this.booted ??= this.bootOnce()
        return this.booted
    }

    /** The loopback base URL of the api; only valid after `boot`. */
    get baseUrl(): string {
        if (this.apiPort === 0) throw stackFailure("the api base URL was requested before boot")
        return `http://127.0.0.1:${this.apiPort}`
    }

    /** The loopback base URL of the keycloak of this run; only valid after `boot`. */
    get keycloakUrl(): string {
        if (this.keycloakPort === 0) throw stackFailure("the keycloak URL was requested before boot")
        return `http://127.0.0.1:${this.keycloakPort}`
    }

    /** The payment gateway stand-in of this run; only valid after `boot`. */
    get gateway(): E2ESepayGateway {
        if (this.gatewayHandle === null) throw stackFailure("the payment gateway was requested before boot")
        return this.gatewayHandle
    }

    /** The URL of the one database of this run, for out-of-band verification only: never to shortcut a flow. */
    databaseUrl(): string {
        return `postgres://${PG_USER}:${this.password}@127.0.0.1:${this.pgPort}/${DATABASE}`
    }

    /**
     * How many runs of the named scheduled job the worker finished so far, read from its JSON log. A spec that asserts
     * stillness waits for this to advance instead of sleeping: a run that finished after the change proves the job looked
     * at the changed state and left it alone.
     */
    completedJobRuns(job: string): number {
        const worker = this.apps.find((app) => app.name === "worker")
        if (!worker || !existsSync(worker.logPath)) return 0
        return readFileSync(worker.logPath, "utf8")
            .split("\n")
            .filter((line) => isJobCompletedLine(line, job)).length
    }

    /** Disposes exactly what this run created, then verifies by observation that it is gone. */
    async close(): Promise<void> {
        if (this.closed) return
        this.closed = true
        const steps: Array<E2ECleanupStep> = []
        for (const app of [...this.apps].reverse()) {
            if (app.child.exitCode !== null) continue
            steps.push({ step: `terminate ${app.name} process`, detail: `signal sent: ${this.terminate(app.child)}` })
        }
        if (this.gatewayHandle) {
            await this.gatewayHandle.close()
            steps.push({ step: "stop the payment gateway stand-in" })
        }
        const down = this.compose(["down", "-v", "--remove-orphans", "--timeout", "20"])
        steps.push({ step: "docker compose down -v --remove-orphans", detail: `exit ${down.status}` })
        const containers = this.docker(["ps", "-a", "--filter", `label=com.docker.compose.project=${this.project}`, "--format", "{{.Names}}"])
        const volumes = this.docker(["volume", "ls", "--filter", `name=${this.project}`, "--format", "{{.Name}}"])
        steps.push({ step: "verify no container of this project remains", detail: containers.stdout.trim() || "(none)" })
        steps.push({ step: "verify no volume of this project remains", detail: volumes.stdout.trim() || "(none)" })
        this.cleanupReport = { steps, clean: !containers.stdout.trim() && !volumes.stdout.trim() }
    }

    /** SIGTERM first; where the platform cannot deliver it, the process tree is taken down by pid. */
    private terminate(child: ChildProcess): boolean {
        const sent = child.kill("SIGTERM")
        if (!sent && child.pid !== undefined) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"])
        return sent
    }

    private async bootOnce(): Promise<void> {
        try {
            this.ensureBuilt()
            mkdirSync(this.logDir, { recursive: true })
            const [pgPort, keycloakPort, apiPort, gatewayPort] = await freePorts(4)
            this.pgPort = pgPort ?? 0
            this.keycloakPort = keycloakPort ?? 0
            this.apiPort = apiPort ?? 0
            this.gatewayHandle = await E2ESepayGateway.listen(gatewayPort ?? 0)
            const up = this.compose(["up", "-d", "--wait"], 300_000)
            if (up.status !== 0) throw stackFailure(`docker compose up failed (exit ${up.status}): ${up.stderr || up.stdout}`)
            this.readiness.push(await retryUntil("postgres", 120_000, () => Promise.resolve(this.pgReady())))
            this.readiness.push(await retryUntil("keycloak", 240_000, () => this.keycloakReady()))
            this.migrate()
            const api = this.spawnApp("todo")
            this.readiness.push(await retryUntil("api /health", 120_000, () => this.apiHealthy(api)))
            const worker = this.spawnApp("worker")
            this.readiness.push(await retryUntil("worker started", 120_000, () => Promise.resolve(this.workerStarted(worker))))
        } catch (error) {
            await this.close()
            throw error
        }
    }

    /**
     * The compiled entrypoints must be fresh before any docker work starts: a stale or absent build would make the
     * suite exercise code the tree no longer contains. When any compiled source is newer than the oldest entrypoint, the
     * same steps as `npm run build` run first; a compile failure stops the boot with the compiler output.
     */
    private ensureBuilt(): void {
        const entries = COMPILED_APPS.map(mainOf)
        const newestSource = Math.max(newestSourceMtimeMs(join(BACKEND_ROOT, "src")), newestSourceMtimeMs(join(BACKEND_ROOT, "apps")))
        if (entries.every((entry) => existsSync(entry) && statSync(entry).mtimeMs >= newestSource)) return
        for (const bin of [join("typescript", "bin", "tsc"), join("tsc-alias", "dist", "bin", "index.js")]) {
            const result = spawnSync(process.execPath, [join(BACKEND_ROOT, "node_modules", bin), "-p", "tsconfig.build.json"], {
                cwd: BACKEND_ROOT,
                encoding: "utf8",
                maxBuffer: 32 * 1024 * 1024,
            })
            if (result.error) throw stackFailure(`the build step ${bin} could not run`, result.error)
            if (result.status !== 0) throw stackFailure(`build failed (${bin} exited ${result.status}): ${result.stderr || result.stdout}`)
        }
    }

    /** What the api and the worker both read: the one database, the identity provider, the gateway, uploads, mail and the recurrence tick. */
    private sharedEnv(): Record<string, string> {
        return {
            PRIMARY_DB_URL: this.databaseUrl(),
            KEYCLOAK_TOKEN_URL: `${this.keycloakUrl}/realms/${REALM}/protocol/openid-connect/token`,
            KEYCLOAK_CLIENT_ID: PUBLIC_CLIENT,
            SEPAY_BASE_URL: this.gateway.baseUrl,
            SEPAY_API_KEY: this.apiKey,
            SEPAY_WEBHOOK_SECRET: this.webhookSecret,
            UPLOAD_SIGNING_SECRET: this.uploadSigningSecret,
            UPLOAD_DIR: join(this.logDir, "uploads"),
            // The generation tick is a cron of whole minutes: every minute is the shortest cadence the job supports.
            RECUR_TICK_CRON: "* * * * *",
            // The one outbound-network effect the worker can attempt is pinned to a loopback port nothing listens on, so an
            // accidental send fails locally instead of reaching a real MX.
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: "1",
            SMTP_FROM: "e2e@localhost",
        }
    }

    private appEnv(name: AppName): Record<string, string> {
        if (name === "worker") return { ...this.sharedEnv(), SCHEDULING_TICK: "250ms", MESSAGING_POLL: "250ms" }
        return {
            ...this.sharedEnv(),
            PORT: String(this.apiPort),
            HTTP_SECURITY_ALLOWED_ORIGINS: "http://localhost:4069",
            HTTP_SECURITY_RATE_DEFAULT_LIMIT: "100000",
            HTTP_SECURITY_RATE_STRICT_LIMIT: "100000",
        }
    }

    /** The schema comes only from apps/migrate (an api never migrates): it applies the one connection once against this run fresh volume. */
    private migrate(): void {
        const result = spawnSync(process.execPath, ["-r", "tsconfig-paths/register", mainOf("migrate")], {
            cwd: BACKEND_ROOT,
            encoding: "utf8",
            env: this.env.toChildEnv({ PRIMARY_DB_URL: this.databaseUrl() }),
        })
        if (result.error) throw stackFailure("the migrate app could not start", result.error)
        if (result.status !== 0) throw stackFailure(`migrate failed (exit ${result.status}): ${result.stderr || result.stdout}`)
    }

    private spawnApp(name: "todo" | "worker"): SpawnedApp {
        mkdirSync(join(this.logDir, "uploads"), { recursive: true })
        const logPath = join(this.logDir, `${name}.log`)
        const child = spawn(process.execPath, ["-r", "tsconfig-paths/register", mainOf(name)], {
            cwd: BACKEND_ROOT,
            env: this.env.toChildEnv(this.appEnv(name)),
            stdio: ["ignore", "pipe", "pipe"],
        })
        const append = (chunk: Buffer): void => appendFileSync(logPath, chunk)
        child.stdout.on("data", append)
        child.stderr.on("data", append)
        const app: SpawnedApp = { name, child, logPath }
        this.apps.push(app)
        return app
    }

    private assertAlive(app: SpawnedApp): void {
        if (app.child.exitCode !== null) throw stackFailure(`the ${app.name} process exited early with code ${app.child.exitCode}: see ${app.logPath}`)
    }

    private async apiHealthy(api: SpawnedApp): Promise<boolean> {
        this.assertAlive(api)
        const response = await createE2EHttpClient({ baseUrl: this.baseUrl, timeoutMs: 4000 }).get<{ status?: string }>("/health")
        return response.status === 200 && response.body.status === "ok"
    }

    /** The worker has no listener: it is up when it logged its started event and is still running. */
    private workerStarted(worker: SpawnedApp): boolean {
        this.assertAlive(worker)
        return existsSync(worker.logPath) && readFileSync(worker.logPath, "utf8").includes(WORKER_STARTED_EVENT)
    }

    private pgReady(): boolean {
        return this.compose(["exec", "-T", "postgres", "pg_isready", "-U", PG_USER, "-d", DATABASE]).status === 0
    }

    private async keycloakReady(): Promise<boolean> {
        const response = await createE2EHttpClient({ baseUrl: this.keycloakUrl, timeoutMs: 4000 }).get(`/realms/${REALM}`)
        return response.status === 200
    }

    private compose(args: ReadonlyArray<string>, timeoutMs = 60_000): ShellResult {
        return this.run("docker", ["compose", "-p", this.project, "-f", COMPOSE_FILE, ...args], timeoutMs)
    }

    private docker(args: ReadonlyArray<string>): ShellResult {
        return this.run("docker", args, 60_000)
    }

    /** Every docker call is bounded: an unresponsive engine must fail the spec, not hang it. */
    private run(command: string, args: ReadonlyArray<string>, timeoutMs: number): ShellResult {
        const result = spawnSync(command, [...args], {
            cwd: BACKEND_ROOT,
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
            timeout: timeoutMs,
            env: this.env.toChildEnv({
                E2E_COMPOSE_PROJECT: this.project,
                // The bind-mount source is interpolated as an absolute path with forward slashes, which Docker Desktop wants.
                E2E_BACKEND_ROOT: BACKEND_ROOT.split(sep).join("/"),
                E2E_PG_PORT: String(this.pgPort),
                E2E_KC_PORT: String(this.keycloakPort),
                E2E_PG_USER: PG_USER,
                E2E_PG_PASSWORD: this.password,
                E2E_PG_DB: DATABASE,
                E2E_KC_ADMIN: this.keycloakAdmin.username,
                E2E_KC_ADMIN_PASSWORD: this.keycloakAdmin.password,
            }),
        })
        if (result.error) throw stackFailure(`${command} could not run`, result.error)
        return { status: result.status, stdout: result.stdout, stderr: result.stderr }
    }
}
