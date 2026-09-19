import {
    freePorts 
} from "@e2e-kit/platform/free-ports"
import {
    ReadinessResult, retryUntil 
} from "@e2e-kit/platform/readiness"
import {
    runToken, secret, specHash 
} from "@e2e-kit/platform/run-tokens"
import {
    Inject, Injectable, OnApplicationShutdown, OnModuleDestroy, OnModuleInit 
} from "@nestjs/common"
import {
    appendFileSync, existsSync, mkdirSync 
} from "node:fs"
import {
    tmpdir 
} from "node:os"
import {
    join, resolve 
} from "node:path"
import {
    ChildProcess, spawn, spawnSync 
} from "node:child_process"
import {
    TESTING_INFRA_OPTIONS, TestingInfraOptions 
} from "../../testing-infra.options"

export const BACKEND_ROOT = resolve(__dirname,
    "..",
    "..",
    "..",
    "..",
    "..")
export const COMPOSE_FILE = join(__dirname,
    "compose.e2e.yaml")

/** The two deployables this stack spawns as host child processes. */
export type E2EServiceName = "identity" | "order";

/** Where one spawned api answers: its name, loopback base URL and run-allocated port. */
export interface E2EServiceEndpoint {
  name: E2EServiceName;
  baseUrl: string;
  port: number;
}

/** One compose container as docker reports it - service, container, state and published ports. */
export interface E2EComposeIdentity {
  service: string;
  name: string;
  id: string;
  image: string;
  state: string;
  health: string | null;
  ports: Array<string>;
}

/** One entry in the teardown self-report: the step taken and what it observed. */
export interface E2ECleanupStep {
  step: string;
  detail?: unknown;
}

/** The stack's teardown self-report: whether nothing of this run survived, step by step. */
export interface E2ECleanupReport {
  clean: boolean;
  steps: Array<E2ECleanupStep>;
}

interface SpawnedApi {
  name: E2EServiceName;
  child: ChildProcess;
  logPath: string;
  endpoint: E2EServiceEndpoint;
}

interface ShellResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

@Injectable()
/**
 * The run-owned ephemeral stack, ported from todo-app-backend's test/e2e/lib/stack.js and adapted to
 * this monorepo's topology: ONE compose project carries the shared postgres + redis, and the two
 * services boot as host child processes of this run - identity first, order only after identity's
 * /health answers (order's own /health is itself a live HTTP check against identity, so the boot
 * order is proven by observation, not assumed).
 *
 * Nothing here can reach the dev stack: every host port is allocated from the OS at run time on
 * 127.0.0.1, the compose project name and its volume are run-scoped, and disposal is
 * `docker compose down -v` against that one project name only, verified by observation afterward.
 */
export class E2EStackService implements OnModuleInit, OnApplicationShutdown, OnModuleDestroy {
    readonly project: string
    readiness: Array<ReadinessResult> = []
    services: Array<E2EComposeIdentity> = []
    cleanupReport: E2ECleanupReport | null = null

    private endpoints!: Record<E2EServiceName, E2EServiceEndpoint>
    private env!: Record<string, string>
    private apis: Array<SpawnedApi> = []
    private bootPromise: Promise<void> | null = null
    private stopped = false
    private pgPort = 0
    private redisPort = 0

    constructor(@Inject(TESTING_INFRA_OPTIONS) options: TestingInfraOptions) {
        const specPart = options.specId ? `${specHash(options.specId)}-` : ""
        this.project = `ec-e2e-${specPart}${runToken(4)}`
    }

    async onModuleInit(): Promise<void> {
    // Idempotent: TestingModule.compile() does not run lifecycle hooks, so the spec calls
    // moduleRef.init() explicitly - but a caller that triggers both must never boot twice.
        this.bootPromise ??= this.boot()
        return this.bootPromise
    }

    private async boot(): Promise<void> {
        try {
            this.ensureBuilt()
            const [pgPort,
                redisPort,
                identityPort,
                orderPort] = await freePorts(4)
            this.pgPort = pgPort
            this.redisPort = redisPort
            this.env = {
                E2E_COMPOSE_PROJECT: this.project,
                E2E_PG_PORT: String(pgPort),
                E2E_REDIS_PORT: String(redisPort),
                E2E_PG_USER: "e2e",
                E2E_PG_PASSWORD: secret(),
                E2E_PG_DB: "ecommerce",
            }
            const up = this.compose(["up",
                "-d",
                "--wait"],
            300_000)
            if (up.status !== 0) {
                throw new Error(`docker compose up failed (exit ${up.status}):\n${up.stderr || up.stdout}`)
            }

            this.readiness.push(await retryUntil("postgres:5432",
                120_000,
                async () => this.pgIsReady()))
            this.readiness.push(await retryUntil("redis:6379",
                60_000,
                async () => this.redisIsReady()))

            // Dependency ordering: identity boots and answers /health BEFORE the order process is even
            // spawned. Order's /health then re-proves the link itself (its identity check is a live call).
            const identity = this.spawnApi("identity",
                identityPort,
                orderPort)
            this.readiness.push(await retryUntil(`identity /health on ${identity.endpoint.baseUrl}`,
                120_000,
                () => this.apiIsReady(identity)))
            const order = this.spawnApi("order",
                orderPort,
                identityPort)
            this.readiness.push(await retryUntil(`order /health on ${order.endpoint.baseUrl}`,
                120_000,
                () => this.apiIsReady(order)))

            this.endpoints = {
                identity: identity.endpoint, order: order.endpoint 
            }
            this.services = this.serviceIdentities()
        } catch (error) {
            await this.teardown()
            throw error
        }
    }

    async onApplicationShutdown(): Promise<void> {
        await this.teardown()
    }

    async onModuleDestroy(): Promise<void> {
        await this.teardown()
    }

    endpoint(service: E2EServiceName): E2EServiceEndpoint {
        return this.endpoints[service]
    }

    /** Out-of-band access to the run's Postgres, for seed/verify only - never to shortcut a flow. */
    get databaseUrl(): string {
        return `postgres://${this.env.E2E_PG_USER}:${this.env.E2E_PG_PASSWORD}@127.0.0.1:${this.pgPort}/${this.env.E2E_PG_DB}`
    }

    /** Tables + row counts observed after both services migrated, on this run's own volume. */
    schemaSnapshot(): { tables: Array<string>; rows: Record<string, number> } {
        const raw = this.psql(
            "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'",
        )
        const tables = raw.split(",").map((name) => name.trim()).filter(Boolean)
        const rows = Object.fromEntries(tables.map((table) => [table,
            Number(this.psql(`select count(*) from ${table}`))]))
        return {
            tables, rows 
        }
    }

    /** Both apps' dist entries must exist before any docker work starts; build once if they do not. */
    private ensureBuilt(): void {
        const entries = [
            join(BACKEND_ROOT,
                "dist",
                "apps",
                "identity",
                "src",
                "main.js"),
            join(BACKEND_ROOT,
                "dist",
                "apps",
                "order",
                "src",
                "main.js"),
        ]
        if (entries.every((entry) => existsSync(entry))) return
        const npm = process.platform === "win32" ? "npm.cmd" : "npm"
        const build = spawnSync(npm,
            ["run",
                "build"],
            {
                cwd: BACKEND_ROOT, encoding: "utf8", timeout: 120_000 
            })
        if (build.status !== 0 || !entries.every((entry) => existsSync(entry))) {
            throw new Error(`npm run build failed (exit ${build.status}):\n${build.stderr || build.stdout}`)
        }
    }

    private spawnApi(name: E2EServiceName, port: number, peerPort: number): SpawnedApi {
        const logDir = join(tmpdir(),
            this.project)
        mkdirSync(logDir,
            {
                recursive: true 
            })
        const logPath = join(logDir,
            `${name}.log`)
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            ECOMMERCE_APP_BE_METADATA: join(BACKEND_ROOT,
                "metadata.json"),
            // The emitted dist keeps @modules/@features specifiers verbatim (tsc does not rewrite
            // paths); pointing tsconfig-paths' baseUrl at dist resolves them to dist/src/**.
            TS_NODE_BASEURL: join(BACKEND_ROOT,
                "dist"),
        }
        if (name === "identity") {
            env.IDENTITY_PORT = String(port)
            env.IDENTITY_DATABASE_URL = this.databaseUrl
            env.IDENTITY_REDIS_URL = `redis://127.0.0.1:${this.redisPort}/0`
            env.ORDER_API_URL = `http://127.0.0.1:${peerPort}`
        } else {
            env.ORDER_PORT = String(port)
            env.ORDER_DATABASE_URL = this.databaseUrl
            env.IDENTITY_API_URL = `http://127.0.0.1:${peerPort}`
        }
        const child = spawn(process.execPath,
            ["-r",
                "tsconfig-paths/register",
                join(BACKEND_ROOT,
                    "dist",
                    "apps",
                    name,
                    "src",
                    "main.js")],
            {
                cwd: BACKEND_ROOT,
                env,
                stdio: ["ignore",
                    "pipe",
                    "pipe"],
            })
        const append = (chunk: Buffer) => appendFileSync(logPath,
            chunk)
        child.stdout?.on("data",
            append)
        child.stderr?.on("data",
            append)
        const api: SpawnedApi = {
            name, child, logPath, endpoint: {
                name, baseUrl: `http://127.0.0.1:${port}`, port 
            } 
        }
        this.apis.push(api)
        return api
    }

    private async apiIsReady(api: SpawnedApi): Promise<boolean> {
        const response = await fetch(`${api.endpoint.baseUrl}/health`,
            {
                signal: AbortSignal.timeout(4000) 
            })
        if (response.status !== 200) return false
        const body = (await response.json()) as { status?: string }
        return body?.status === "ok"
    }

    private pgIsReady(): boolean {
        return this.compose(["exec",
            "-T",
            "postgres",
            "pg_isready",
            "-U",
            this.env.E2E_PG_USER,
            "-d",
            this.env.E2E_PG_DB]).status === 0
    }

    private redisIsReady(): boolean {
        return this.compose(["exec",
            "-T",
            "redis",
            "redis-cli",
            "ping"]).stdout.trim() === "PONG"
    }

    private psql(sql: string): string {
        const run = this.compose(["exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            this.env.E2E_PG_USER,
            "-d",
            this.env.E2E_PG_DB,
            "-tAc",
            sql])
        if (run.status !== 0) throw new Error(`psql failed: ${run.stderr}`)
        return run.stdout.trim()
    }

    private compose(args: Array<string>, timeoutMs = 60_000): ShellResult {
        return this.sh("docker",
            ["compose",
                "-p",
                this.project,
                "-f",
                COMPOSE_FILE,
                ...args],
            timeoutMs)
    }

    /** Every docker call is bounded: an unresponsive engine must fail the spec, not hang it. */
    private sh(command: string, args: Array<string>, timeoutMs = 60_000): ShellResult {
        const result = spawnSync(command,
            args,
            {
                cwd: BACKEND_ROOT,
                encoding: "utf8",
                maxBuffer: 32 * 1024 * 1024,
                timeout: timeoutMs,
                env: {
                    ...process.env, ...this.env 
                },
            })
        if (result.error) throw result.error
        return {
            status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" 
        }
    }

    private serviceIdentities(): Array<E2EComposeIdentity> {
        const run = this.compose(["ps",
            "--format",
            "json",
            "--all"])
        return run.stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const record = JSON.parse(line) as Record<string, unknown>
                const publishers = (record.Publishers ?? []) as Array<Record<string, number | string>>
                return {
                    service: String(record.Service),
                    name: String(record.Name),
                    id: String(record.Id),
                    image: String(record.Image),
                    state: String(record.State),
                    health: record.Health ? String(record.Health) : null,
                    ports: publishers.map(
                        (p) => `${p.URL ?? "127.0.0.1"}:${p.publishedPort ?? p.Published}->${p.targetPort ?? p.Target}`,
                    ),
                }
            })
    }

    /** Disposes exactly what this run created, then verifies by observation that it is gone. */
    private async teardown(): Promise<void> {
        if (this.stopped) return
        this.stopped = true
        const steps: Array<E2ECleanupStep> = []
        // Reverse boot order: order first (it depends on identity), then identity.
        for (const api of [...this.apis].reverse()) {
            if (api.child.exitCode !== null) continue
            const killed = api.child.kill("SIGTERM")
            steps.push({
                step: `terminate ${api.name} api process`, detail: {
                    pid: api.child.pid, signalSent: killed 
                } 
            })
            if (!killed && api.child.pid) spawn("taskkill",
                ["/PID",
                    String(api.child.pid),
                    "/T",
                    "/F"],
                {
                    shell: true 
                })
        }
        const down = this.compose(["down",
            "-v",
            "--remove-orphans",
            "--timeout",
            "20"])
        steps.push({
            step: "docker compose down -v --remove-orphans", detail: {
                exit: down.status, stderr: down.stderr.trim() || undefined 
            } 
        })
        const containers = this.sh("docker",
            ["ps",
                "-a",
                "--filter",
                `label=com.docker.compose.project=${this.project}`,
                "--format",
                "{{.Names}}"]).stdout.trim()
        const volumes = this.sh("docker",
            ["volume",
                "ls",
                "--filter",
                `name=${this.project}`,
                "--format",
                "{{.Name}}"]).stdout.trim()
        steps.push({
            step: "verify no container of this project remains", detail: containers || "(none)" 
        })
        steps.push({
            step: "verify no volume of this project remains", detail: volumes || "(none)" 
        })
        this.cleanupReport = {
            steps, clean: !containers && !volumes 
        }
    }
}
