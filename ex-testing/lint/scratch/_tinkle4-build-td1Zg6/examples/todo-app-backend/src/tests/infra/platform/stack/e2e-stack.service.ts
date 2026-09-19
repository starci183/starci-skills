import {
    freePorts 
} from "@e2e-kit/platform/free-ports"
import {
    retryUntil 
} from "@e2e-kit/platform/readiness"
import {
    secret, specHash 
} from "@e2e-kit/platform/run-tokens"
import {
    Inject, Injectable, OnApplicationShutdown, OnModuleInit 
} from "@nestjs/common"
import {
    ChildProcess, spawn, spawnSync, SpawnSyncReturns 
} from "node:child_process"
import {
    appendFileSync, existsSync, mkdirSync, readdirSync, statSync 
} from "node:fs"
import {
    tmpdir 
} from "node:os"
import {
    join, resolve, sep 
} from "node:path"
import {
    TESTING_INFRA_OPTIONS, TestingInfraOptions 
} from "../../testing-infra.options"

const BACKEND_ROOT = resolve(__dirname,
    "..",
    "..",
    "..",
    "..",
    "..")
const COMPOSE_FILE = join(__dirname,
    "compose.e2e.yaml")
const REALM = "todo"
const PUBLIC_CLIENT = "todo-api"

/** The OS-allocated loopback ports this run's stack bound - one per service, never a fixed number. */
export interface E2EStackPorts {
  readonly postgres: number;
  readonly keycloak: number;
  readonly redis: number;
  readonly api: number;
}

/**
 * What `down -v` left behind, observed through docker itself: clean=true only when no container and
 * no volume of this run's compose project remains on the daemon.
 */
export interface E2ETeardownReport {
  readonly clean: boolean;
  readonly downExit: number | null;
  readonly containersLeft: string;
  readonly volumesLeft: string;
}

interface ShResult {
  status: number;
  stdout: string;
  stderr: string;
}

@Injectable()
/**
 * The spec-owned ephemeral stack: one docker compose project (postgres + keycloak + redis) plus the
 * api child process, both started by the spec's TestingModule boot and disposed on module close. Every
 * host port is allocated from the OS at run time on 127.0.0.1, the compose project name is a hash of
 * the spec id, and disposal is `down -v` against that one project name only - nothing here can reach
 * the dev stack or another spec's stack. Ported from the retired lib/stack.js runner.
 */
export class E2EStackService implements OnModuleInit, OnApplicationShutdown {
    private apiChild: ChildProcess | null = null
    private composeEnv: NodeJS.ProcessEnv = {
    }
    private bootPromise: Promise<void> | null = null
    private readyResolve!: () => void
    private readyReject!: (error: unknown) => void
    // Nest runs provider onModuleInit hooks concurrently (Promise.all), so dependents must await this.
    private readonly ready = new Promise<void>((resolve, reject) => {
        this.readyResolve = resolve
        this.readyReject = reject
    })

    project = ""
    ports: E2EStackPorts = {
        postgres: 0, keycloak: 0, redis: 0, api: 0 
    }
    baseUrl = ""
    databaseUrl = ""
    keycloakUrl = ""
    redisUrl = ""
    apiLogPath = ""
    /** Set by onApplicationShutdown: the observed cleanup result. clean=true only when docker itself
   * shows no container and no volume of this project left. */
    teardownReport: E2ETeardownReport | null = null
    /** Realm-admin pair generated per boot; e2e-auth uses it for account create/delete. */
    keycloakAdmin = {
        username: "e2e-admin", password: "" 
    }

    get apiBaseUrl(): string {
        return this.baseUrl
    }

    constructor(@Inject(TESTING_INFRA_OPTIONS) private readonly options: TestingInfraOptions) {}

    async onModuleInit(): Promise<void> {
        this.bootPromise = this.boot()
        try {
            await this.bootPromise
            this.readyResolve()
        } catch (error) {
            this.readyReject(error)
            // A provider that throws during init never sees onApplicationShutdown, so the spec cleans up
            // here instead of leaking a half-started compose project.
            await this.teardown()
            throw error
        }
    }

    /** Resolves once the stack (compose services + api) is fully up; rejects if boot failed. */
    whenReady(): Promise<void> {
        return this.ready
    }

    async onApplicationShutdown(): Promise<void> {
        await this.teardown()
    }

    private async boot(): Promise<void> {
        this.ensureApiBuild()
        const specId = this.options.specId ?? currentSpecPath()
        this.project = `todo-e2e-${specHash(specId)}`
        const [postgres,
            keycloak,
            redis,
            api] = await freePorts(4)
        this.ports = {
            postgres, keycloak, redis, api 
        }
        const pgUser = "e2e"
        const pgPassword = secret()
        const pgDb = "todo"
        this.keycloakAdmin = {
            username: "e2e-admin", password: secret() 
        }
        this.composeEnv = {
            ...process.env,
            E2E_COMPOSE_PROJECT: this.project,
            // Bind-mount sources are interpolated into the compose file as an absolute path, so the yaml
            // stays correct wherever it lives in the tree. Docker Desktop wants forward slashes.
            E2E_BACKEND_ROOT: BACKEND_ROOT.split(sep).join("/"),
            E2E_PG_PORT: String(postgres),
            E2E_KC_PORT: String(keycloak),
            E2E_REDIS_PORT: String(redis),
            E2E_PG_USER: pgUser,
            E2E_PG_PASSWORD: pgPassword,
            E2E_PG_DB: pgDb,
            E2E_KC_ADMIN: this.keycloakAdmin.username,
            E2E_KC_ADMIN_PASSWORD: this.keycloakAdmin.password,
        }
        this.databaseUrl = `postgres://${pgUser}:${pgPassword}@127.0.0.1:${postgres}/${pgDb}`
        this.keycloakUrl = `http://127.0.0.1:${keycloak}`
        this.redisUrl = `redis://127.0.0.1:${redis}`
        this.baseUrl = `http://127.0.0.1:${api}`

        // The project name is deterministic per spec, so a leaked or interrupted earlier run could still
        // own containers/volumes under it (a reused pg volume keeps its first password). Reset first.
        this.compose(["down",
            "-v",
            "--remove-orphans",
            "--timeout",
            "20"])
        const upResult = this.compose(["up",
            "-d",
            "--wait"])
        if (upResult.status !== 0) {
            throw new Error(`docker compose up failed (exit ${upResult.status}):\n${upResult.stderr || upResult.stdout}`)
        }

        await retryUntil("postgres:5432",
            120_000,
            async () => this.pgReady())
        await retryUntil("redis:6379",
            60_000,
            async () => this.redisReady())
        await retryUntil(`keycloak:/realms/${REALM}`,
            240_000,
            async () => this.keycloakReady())

        this.startApi()
        await retryUntil(`api /health on ${this.baseUrl}`,
            120_000,
            async () => this.apiReady())
    }

    /**
     * The api child runs the compiled `dist/main.js`, not ts-node: a stale or absent build would make
     * the suite exercise code the tree no longer contains (a fixed ping deadline that never reached
     * dist once produced exactly that false failure). When any compiled source is newer than
     * `dist/main.js` this rebuilds through the same `npm run build` steps before booting anything;
     * a compile failure stops boot with the tsc output instead of an api that never answers /health.
     */
    private ensureApiBuild(): void {
        const distMain = join(BACKEND_ROOT,
            "dist",
            "main.js")
        if (existsSync(distMain) && newestSourceMtimeMs(join(BACKEND_ROOT,
            "src")) <= statSync(distMain).mtimeMs) {
            return
        }
        for (const bin of [
            join("typescript",
                "bin",
                "tsc"),
            join("tsc-alias",
                "dist",
                "bin",
                "index.js"),
        ]) {
            const result = spawnSync(process.execPath,
                [join(BACKEND_ROOT,
                    "node_modules",
                    bin),
                "-p",
                "tsconfig.build.json"],
                {
                    cwd: BACKEND_ROOT,
                    encoding: "utf8",
                    maxBuffer: 32 * 1024 * 1024,
                })
            if (result.error) throw result.error
            if (result.status !== 0) {
                throw new Error(`api build failed (${bin} exited ${result.status}):\n${result.stderr || result.stdout}`)
            }
        }
    }

    private startApi(): void {
        const logDir = join(tmpdir(),
            "todo-e2e",
            this.project)
        mkdirSync(logDir,
            {
                recursive: true 
            })
        this.apiLogPath = join(logDir,
            "api.log")
        const env: NodeJS.ProcessEnv = {
            ...process.env,
            // Only the knobs AppConfigService actually reads are set. The schema comes from TypeORM's
            // migrations (migrationsRun: true in PostgresqlPrimaryModule) on this boot's fresh volume.
            PORT: String(this.ports.api),
            DATABASE_URL: this.databaseUrl,
            REDIS_URL: this.redisUrl,
            KEYCLOAK_TOKEN_URL: `${this.keycloakUrl}/realms/${REALM}/protocol/openid-connect/token`,
            KEYCLOAK_CLIENT_ID: PUBLIC_CLIENT,
            RECUR_TICK_CRON: process.env.E2E_RECUR_TICK_CRON ?? "* * * * * *",
            // The one outbound-network effect the app can attempt is pinned to a loopback port nothing
            // listens on, so an accidental send fails locally instead of reaching a real MX.
            SMTP_HOST: "127.0.0.1",
            SMTP_PORT: "1",
            SMTP_FROM: "e2e@localhost",
        }
        this.apiChild = spawn(process.execPath,
            ["-r",
                "tsconfig-paths/register",
                join(BACKEND_ROOT,
                    "dist",
                    "main.js")],
            {
                cwd: BACKEND_ROOT,
                env,
                stdio: ["ignore",
                    "pipe",
                    "pipe"],
            })
        const logPath = this.apiLogPath
        this.apiChild.stdout?.on("data",
            (chunk) => appendFileSync(logPath,
                chunk))
        this.apiChild.stderr?.on("data",
            (chunk) => appendFileSync(logPath,
                chunk))
    }

    private async teardown(): Promise<void> {
        const leftovers: Array<string> = []
        // A sibling provider's init failure rejects the module while boot is still in flight; wait for
        // it to settle first so a mid-flight `compose up` cannot create containers after `down` ran.
        if (this.bootPromise) await this.bootPromise.catch(() => undefined)
        if (this.apiChild && this.apiChild.exitCode === null) {
            const signalSent = this.apiChild.kill("SIGTERM")
            if (!signalSent && this.apiChild.pid) {
                spawn("taskkill",
                    ["/PID",
                        String(this.apiChild.pid),
                        "/T",
                        "/F"],
                    {
                        shell: true 
                    })
            }
            this.apiChild = null
        }
        if (!this.project) return
        const down = this.compose(["down",
            "-v",
            "--remove-orphans",
            "--timeout",
            "20"])
        if (down.status !== 0) {
            leftovers.push(`compose down exited ${down.status}: ${(down.stderr || down.stdout).trim()}`)
        }
        // Cleanup is asserted by observation, not by trusting the down exit code: no container and no
        // volume of this project name may remain.
        const containers = sh("docker",
            [
                "ps",
                "-a",
                "--filter",
                `label=com.docker.compose.project=${this.project}`,
                "--format",
                "{{.Names}}",
            ])
        const volumes = sh("docker",
            ["volume",
                "ls",
                "--filter",
                `name=${this.project}`,
                "--format",
                "{{.Name}}"])
        if (containers.status !== 0) leftovers.push(`container check failed: ${containers.stderr.trim()}`)
        else if (containers.stdout.trim()) leftovers.push(`containers left: ${containers.stdout.trim()}`)
        if (volumes.status !== 0) leftovers.push(`volume check failed: ${volumes.stderr.trim()}`)
        else if (volumes.stdout.trim()) leftovers.push(`volumes left: ${volumes.stdout.trim()}`)
        this.teardownReport = {
            clean: leftovers.length === 0,
            downExit: down.status,
            containersLeft: containers.stdout.trim(),
            volumesLeft: volumes.stdout.trim(),
        }
        if (leftovers.length) {
            throw new Error(`e2e stack ${this.project} teardown incomplete - ${leftovers.join("; ")}`)
        }
    }

    private compose(args: Array<string>): ShResult {
        return sh("docker",
            ["compose",
                "-p",
                this.project,
                "-f",
                COMPOSE_FILE,
                ...args],
            this.composeEnv)
    }

    private pgReady(): boolean {
        const probe = this.compose([
            "exec",
            "-T",
            "postgres",
            "pg_isready",
            "-U",
            String(this.composeEnv.E2E_PG_USER),
            "-d",
            String(this.composeEnv.E2E_PG_DB),
        ])
        return probe.status === 0
    }

    private redisReady(): boolean {
        return this.compose(["exec",
            "-T",
            "redis",
            "redis-cli",
            "ping"]).stdout.trim() === "PONG"
    }

    private async keycloakReady(): Promise<boolean> {
        return (await httpStatus(`${this.keycloakUrl}/realms/${REALM}`)) === 200
    }

    private async apiReady(): Promise<boolean> {
        if (this.apiChild && this.apiChild.exitCode !== null) {
            throw new Error(`api process exited early with code ${this.apiChild.exitCode} - see ${this.apiLogPath}`)
        }
        if ((await httpStatus(`${this.baseUrl}/health`)) !== 200) return false
        const response = await fetch(`${this.baseUrl}/health`,
            {
                signal: AbortSignal.timeout(4000) 
            })
        const body = (await response.json()) as { status?: string }
        return body?.status === "ok"
    }
}

function sh(command: string, args: Array<string>, env?: NodeJS.ProcessEnv): ShResult {
    const result: SpawnSyncReturns<string> = spawnSync(command,
        args,
        {
            cwd: BACKEND_ROOT,
            encoding: "utf8",
            maxBuffer: 32 * 1024 * 1024,
            env: env ?? process.env,
        })
    if (result.error) throw result.error
    return {
        status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" 
    }
}

async function httpStatus(url: string): Promise<number> {
    const response = await fetch(url,
        {
            signal: AbortSignal.timeout(4000) 
        })
    return response.status
}

/**
 * Newest mtime among the `.ts` files `tsconfig.build.json` compiles under `src` - the freshness
 * watermark `dist/main.js` is compared against. Unit `*.spec.ts` files are excluded from the build,
 * so they do not count as a reason to rebuild.
 */
function newestSourceMtimeMs(dir: string): number {
    let newest = 0
    for (const entry of readdirSync(dir,
        {
            withFileTypes: true 
        })) {
        const full = join(dir,
            entry.name)
        if (entry.isDirectory()) {
            newest = Math.max(newest,
                newestSourceMtimeMs(full))
        } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
            newest = Math.max(newest,
                statSync(full).mtimeMs)
        }
    }
    return newest
}

function currentSpecPath(): string {
    try {
        return expect.getState().testPath ?? "unknown-spec"
    } catch {
        return "unknown-spec"
    }
}
