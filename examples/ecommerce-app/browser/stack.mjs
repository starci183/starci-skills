import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

/**
 * The browser journey's stack: `up` provisions the dev environment once (ephemeral Keycloak/MinIO env the
 * compose services read, the infra containers, `cli migrate run`, the seeds, then the identity and order apis
 * on the host at the projected ports) so `npm run test:browser` has a real product to drive; `down` stops the
 * apis and the compose project. The sealed `secrets/*.enc` are never read - a browser run owns its stack, so
 * every value it needs is generated fresh for the run and written to the gitignored `runtime/env/` folder.
 *
 * The example runs it dispatch-only in CI (the `browser` job of the root examples workflow); a developer may
 * run it the same way to prove a journey locally. The app build (`npm run build:be`) must exist first: the
 * services boot from `be/dist`.
 *
 *   node browser/stack.mjs up     provision, then exit leaving the apis running (state in runtime/)
 *   node browser/stack.mjs down   stop the apis and the compose project
 */

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const STACK_DIR = path.join(APP_ROOT, ".starcistacks", "dev")
const COMPOSE_FILE = path.join(STACK_DIR, "infra", "compose", "compose.yaml")
const METADATA_FILE = path.join(STACK_DIR, "infra", "metadata.json")
const ENV_DIR = path.join(STACK_DIR, "runtime", "env")
const LOG_DIR = path.join(STACK_DIR, "runtime", "browser-logs")
const STATE_FILE = path.join(STACK_DIR, "runtime", "browser-stack.json")

/** The resolved port projection: the one file every consumer of the allocation reads. */
const ports = (() => {
    const parsed = JSON.parse(fs.readFileSync(METADATA_FILE, "utf8"))
    const read = (key) => {
        const value = parsed.ports?.[key]
        if (typeof value !== "number")
            throw new Error(`${path.relative(APP_ROOT, METADATA_FILE)} carries no numeric ports.${key}`)
        return value
    }
    return {
        postgres: read("postgres"),
        redis: read("redis"),
        keycloak: read("keycloak"),
        minio: read("minio"),
        kafka: read("kafka"),
        identityApi: read("identityApi"),
        orderApi: read("orderApi"),
        app: read("app"),
    }
})()

const ORIGIN_APP = `http://localhost:${ports.app}`
const IDENTITY_DB_URL = `postgres://postgres@localhost:${ports.postgres}/ecommerce_identity`
const ORDER_DB_URL = `postgres://postgres@localhost:${ports.postgres}/ecommerce_order`
const BILLING_DB_URL = `postgres://postgres@localhost:${ports.postgres}/ecommerce_billing`

const log = (line) => process.stdout.write(`browser-stack: ${line}\n`)
const fail = (message) => {
    process.stderr.write(`browser-stack: ${message}\n`)
    process.exit(1)
}

/** A synchronous command that must succeed; its output prints only on failure. */
const run = (label, command, args, options = {}) => {
    const result = spawnSync(command, args, { cwd: APP_ROOT, encoding: "utf8", ...options })
    if (result.status !== 0) fail(`${label} failed (${command} ${args.join(" ")}): ${result.stderr || result.stdout}`)
    return result.stdout ?? ""
}

const compose = (...args) => run("compose", "docker", ["compose", "-f", COMPOSE_FILE, ...args])

/** Polls `probe` until it answers true or the deadline passes (message names what was being waited on). */
const waitFor = async (label, probe, timeoutMs = 180_000) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
        if (await probe()) return log(`${label} is ready`)
        if (Date.now() > deadline) fail(`timed out waiting for ${label}`)
        await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
}

/** A URL answers 2xx on the host (connection refused, a pre-import 404 or a warming 503 all mean not ready). */
const serves = async (url) => {
    try {
        const response = await fetch(url)
        return response.ok
    } catch {
        return false
    }
}

const composeExecOk = (...args) =>
    spawnSync("docker", ["compose", "-f", COMPOSE_FILE, "exec", "-T", ...args], { cwd: APP_ROOT, stdio: "ignore" })
        .status === 0

/**
 * The gitignored env files the compose services read: fresh random values every `up`, never the sealed demo
 * secrets. The Keycloak realm import substitutes KEYCLOAK_ADMIN_CLIENT_SECRET into the identity-admin client,
 * so the same generated value is also handed to the identity api below - the pair is self-consistent per run.
 */
const writeEphemeralEnv = () => {
    fs.mkdirSync(ENV_DIR, { recursive: true })
    const values = {
        keycloakAdminPassword: crypto.randomBytes(24).toString("hex"),
        keycloakAdminClientSecret: crypto.randomBytes(24).toString("hex"),
        minioRootPassword: crypto.randomBytes(24).toString("hex"),
    }
    fs.writeFileSync(
        path.join(ENV_DIR, "keycloak.env"),
        `KC_BOOTSTRAP_ADMIN_PASSWORD=${values.keycloakAdminPassword}\nKEYCLOAK_ADMIN_CLIENT_SECRET=${values.keycloakAdminClientSecret}\n`,
        { mode: 0o600 },
    )
    fs.writeFileSync(path.join(ENV_DIR, "minio.env"), `MINIO_ROOT_PASSWORD=${values.minioRootPassword}\n`, {
        mode: 0o600,
    })
    return values
}

/** The environment one api boots with, per runtime/env/KEYS.md, every URL read from the projection. */
const serviceEnv = (secrets) => ({
    identity: {
        IDENTITY_API_PORT: String(ports.identityApi),
        IDENTITY_DB_URL,
        CACHE_REDIS_URL: `redis://localhost:${ports.redis}/0`,
        KEYCLOAK_TOKEN_URL: `http://localhost:${ports.keycloak}/realms/ecommerce/protocol/openid-connect/token`,
        KEYCLOAK_CLIENT_ID: "identity-api",
        KEYCLOAK_ADMIN_URL: `http://localhost:${ports.keycloak}`,
        KEYCLOAK_ADMIN_REALM: "ecommerce",
        KEYCLOAK_ADMIN_CLIENT_ID: "identity-admin",
        KEYCLOAK_ADMIN_CLIENT_SECRET: secrets.keycloakAdminClientSecret,
        ORDER_API_URL: `http://localhost:${ports.orderApi}`,
        HTTP_SECURITY_ALLOWED_ORIGINS: ORIGIN_APP,
    },
    order: {
        ORDER_API_PORT: String(ports.orderApi),
        ORDER_DB_URL,
        IDENTITY_API_URL: `http://localhost:${ports.identityApi}`,
        RECEIPTS_S3_ENDPOINT: `http://localhost:${ports.minio}`,
        RECEIPTS_S3_BUCKET: "receipts",
        RECEIPTS_S3_ACCESS_KEY_ID: "ecommerce",
        RECEIPTS_S3_SECRET_ACCESS_KEY: secrets.minioRootPassword,
        EVENT_BUS_BROKERS: `localhost:${ports.kafka}`,
        EVENT_BUS_GROUP_ID: "order-api",
        QUEUE_REDIS_HOST: "localhost",
        QUEUE_REDIS_PORT: String(ports.redis),
        HTTP_SECURITY_ALLOWED_ORIGINS: ORIGIN_APP,
    },
})

/** Boots one built api detached (its log under runtime/browser-logs/), returning the child handle. */
const startService = (name, env) => {
    const main = path.join(APP_ROOT, "be", "dist", "apps", name, "src", "main.js")
    if (!fs.existsSync(main))
        fail(`${name} has no build at ${path.relative(APP_ROOT, main)}: run npm run build:be first`)
    fs.mkdirSync(LOG_DIR, { recursive: true })
    const logFile = path.join(LOG_DIR, `${name}.log`)
    const out = fs.openSync(logFile, "a")
    const child = spawn(process.execPath, [main], {
        cwd: APP_ROOT,
        env: { ...process.env, ...env },
        detached: true,
        stdio: ["ignore", out, out],
    })
    child.unref()
    fs.closeSync(out)
    return { name, pid: child.pid, exited: () => child.exitCode !== null, log: path.relative(APP_ROOT, logFile) }
}

/** `up`: the whole provisioning, ending in the running apis. */
const up = async () => {
    if (fs.existsSync(STATE_FILE))
        fail(
            `${path.relative(APP_ROOT, STATE_FILE)} exists: the stack is already up (run \`node browser/stack.mjs down\` first)`,
        )
    const secrets = writeEphemeralEnv()
    log("ephemeral env written under .starcistacks/dev/runtime/env (never the sealed secrets)")
    compose("up", "-d", "postgres", "redis", "keycloak", "minio", "kafka")

    await waitFor("postgres", () => composeExecOk("postgres", "pg_isready", "-U", "postgres"))
    await waitFor("redis", () => composeExecOk("redis", "redis-cli", "ping"))
    await waitFor("keycloak realm", () => serves(`http://localhost:${ports.keycloak}/realms/ecommerce`))
    await waitFor("minio", () => serves(`http://localhost:${ports.minio}/minio/health/live`))
    await waitFor("kafka", () =>
        composeExecOk("kafka", "/opt/kafka/bin/kafka-topics.sh", "--bootstrap-server", "kafka:9092", "--list"),
    )

    run("migrate", process.execPath, [path.join("be", "dist", "apps", "cli", "src", "main.js"), "migrate", "run"], {
        env: { ...process.env, IDENTITY_DB_URL, ORDER_DB_URL, BILLING_DB_URL },
    })
    log("migrations ran")

    for (const [database, seed] of [
        ["ecommerce_order", path.join(STACK_DIR, "seeds", "order-catalog.sql")],
        ["ecommerce_identity", path.join(STACK_DIR, "seeds", "identity-demo.sql")],
    ]) {
        run(
            `seed ${database}`,
            "docker",
            [
                "compose",
                "-f",
                COMPOSE_FILE,
                "exec",
                "-T",
                "postgres",
                "psql",
                "-v",
                "ON_ERROR_STOP=1",
                "-U",
                "postgres",
                "-d",
                database,
            ],
            {
                input: fs.readFileSync(seed, "utf8"),
            },
        )
    }
    log("seeds applied")

    const env = serviceEnv(secrets)
    const services = ["identity", "order"].map((name) => startService(name, env[name]))
    const state = {
        startedAt: new Date().toISOString(),
        services: services.map(({ name, pid }) => ({ name, pid })),
        logs: path.relative(APP_ROOT, LOG_DIR),
    }
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)

    for (const service of services) {
        const port = service.name === "identity" ? ports.identityApi : ports.orderApi
        log(`waiting for the ${service.name} api (log: ${service.log})`)
        const deadline = Date.now() + 120_000
        while (!(await serves(`http://localhost:${port}/health`))) {
            if (service.exited()) fail(`the ${service.name} api exited before answering /health - see ${service.log}`)
            if (Date.now() > deadline) fail(`timed out waiting for the ${service.name} api - see ${service.log}`)
            await new Promise((resolve) => setTimeout(resolve, 1_000))
        }
        log(`${service.name} api is ready`)
    }
    log(`stack is up: shop ${ORIGIN_APP} once served, apis on ${ports.identityApi}/${ports.orderApi}`)
    log("run \`node browser/stack.mjs down\` when the browser run is done")
}

/** `down`: stop the host apis of the state file, then the compose project; best-effort, always reports. */
const down = () => {
    if (fs.existsSync(STATE_FILE)) {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
        for (const { name, pid } of state.services ?? []) {
            try {
                process.kill(pid)
                log(`stopped ${name} (pid ${pid})`)
            } catch {
                log(`${name} (pid ${pid}) was already gone`)
            }
        }
        fs.unlinkSync(STATE_FILE)
    }
    try {
        compose("down")
        log("compose project is down")
    } catch {
        log("compose down failed (already gone?)")
    }
}

const command = process.argv[2]
if (command === "up") await up()
else if (command === "down") down()
else fail("usage: node browser/stack.mjs <up|down>")
