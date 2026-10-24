import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

/**
 * The browser journey's stack: `up` provisions the dev environment once (ephemeral Keycloak/MinIO env the
 * compose services read, the infra containers, `cli migrate run`, the seeds, then the identity and order apis
 * on the host at the projected ports) so `npm run test:browser` has a real product to drive; `down` stops the
 * apis and the compose project. A browser run owns its stack, so every secret value it needs is generated fresh
 * for the run and handed to Compose and to the apis through the environment; no file holds it.
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

/** The environment the compose calls interpolate: the process environment plus, once `up` generated them, the run's secrets. */
let composeEnv = process.env

const compose = (...args) => run("compose", "docker", ["compose", "-f", COMPOSE_FILE, ...args], { env: composeEnv })

/** Polls `probe` until it answers true or the deadline passes (message names what was being waited on). */
const waitFor = async (label, probe, timeoutMs = 180_000) => {
    const deadline = Date.now() + timeoutMs
    const poll = async () => {
        if (await probe()) return log(`${label} is ready`)
        if (Date.now() > deadline) fail(`timed out waiting for ${label}`)
        await new Promise((resolve) => setTimeout(resolve, 1_000))
        return poll()
    }
    return poll()
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

/**
 * The broker serves consumer groups from the host: the group coordinator (the __consumer_offsets partitions) answers a
 * describeGroups through the published port. A KRaft broker answers metadata inside the container seconds before it
 * does, and an api whose consumer subscribes in that window fails its boot with EVENT_BUS_BROKER_UNAVAILABLE.
 */
const kafkaServesGroups = async () => {
    const { Kafka, logLevel } = createRequire(import.meta.url)("kafkajs")
    const admin = new Kafka({
        clientId: "browser-stack-probe",
        brokers: [`localhost:${ports.kafka}`],
        logLevel: logLevel.NOTHING,
        // kafkajs finds the group coordinator through a metadata refresh on its retry path; one probe is a few tries.
        retry: { retries: 3 },
    }).admin()
    try {
        await admin.connect()
        await admin.describeGroups(["browser-stack-probe"])
        return true
    } catch {
        return false
    } finally {
        await admin.disconnect().catch(() => undefined)
    }
}

const composeExecOk = (...args) =>
    spawnSync("docker", ["compose", "-f", COMPOSE_FILE, "exec", "-T", ...args], {
        cwd: APP_ROOT,
        env: composeEnv,
        stdio: "ignore",
    }).status === 0

/**
 * The secrets of this run: fresh random values every `up`, handed to the compose services through the environment their
 * compose files interpolate (which require the run to supply credentials). The Keycloak realm import substitutes
 * KEYCLOAK_ADMIN_CLIENT_SECRET into the identity-admin client, so the same generated value is also handed to the
 * identity api below - the pair is self-consistent per run.
 */
const generateSecrets = () => {
    const values = {
        keycloakAdminPassword: crypto.randomBytes(24).toString("hex"),
        keycloakAdminClientSecret: crypto.randomBytes(24).toString("hex"),
        minioRootPassword: crypto.randomBytes(24).toString("hex"),
        orderServiceKey: crypto.randomBytes(32).toString("hex"),
        billingServiceKey: crypto.randomBytes(32).toString("hex"),
        orderPageCursorKey: crypto.randomBytes(32).toString("hex"),
    }
    composeEnv = {
        ...process.env,
        KC_BOOTSTRAP_ADMIN_PASSWORD: values.keycloakAdminPassword,
        KEYCLOAK_ADMIN_CLIENT_SECRET: values.keycloakAdminClientSecret,
        MINIO_ROOT_PASSWORD: values.minioRootPassword,
    }
    return values
}

/**
 * The service keys of this run, mounted the way sealed custody mounts them in a deployment: one file per key in a private
 * folder outside the repository (owner-only, removed by `down`), handed to the apis as `<KEY>_FILE`. The apis refuse these
 * keys as plaintext environment values, so the folder is the only place they exist besides the processes that read them.
 */
const mountServiceKeys = (secrets) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "full-app-service-keys-"))
    const mount = (name, value) => {
        const file = path.join(dir, name)
        fs.writeFileSync(file, value, { mode: 0o600 })
        return file
    }
    return {
        dir,
        orderServiceKey: mount("order-service-key", secrets.orderServiceKey),
        billingServiceKey: mount("billing-service-key", secrets.billingServiceKey),
    }
}

/** The environment one api boots with, per runtime/env/KEYS.md, every URL read from the projection. */
const serviceEnv = (secrets, mounts) => ({
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
        ORDER_SERVICE_KEY_FILE: mounts.orderServiceKey,
        BILLING_SERVICE_KEY_FILE: mounts.billingServiceKey,
        HTTP_SECURITY_ALLOWED_ORIGINS: ORIGIN_APP,
    },
    order: {
        ORDER_API_PORT: String(ports.orderApi),
        ORDER_DB_URL,
        IDENTITY_API_URL: `http://localhost:${ports.identityApi}`,
        IDENTITY_API_SERVICE_KEY_FILE: mounts.orderServiceKey,
        RECEIPTS_S3_ENDPOINT: `http://localhost:${ports.minio}`,
        RECEIPTS_S3_BUCKET: "receipts",
        RECEIPTS_S3_ACCESS_KEY_ID: "ecommerce",
        RECEIPTS_S3_SECRET_ACCESS_KEY: secrets.minioRootPassword,
        ORDER_PAGE_CURSOR_KEY: secrets.orderPageCursorKey,
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
    const secrets = generateSecrets()
    log("secrets generated for this run (environment only, no file)")
    compose("up", "-d", "postgres", "redis", "keycloak", "minio", "kafka")

    await waitFor("postgres", () => composeExecOk("postgres", "pg_isready", "-U", "postgres"))
    await waitFor("redis", () => composeExecOk("redis", "redis-cli", "ping"))
    await waitFor("keycloak realm", () => serves(`http://localhost:${ports.keycloak}/realms/ecommerce`))
    await waitFor("minio", () => serves(`http://localhost:${ports.minio}/minio/health/live`))
    await waitFor("kafka", () =>
        composeExecOk("kafka", "/opt/kafka/bin/kafka-topics.sh", "--bootstrap-server", "kafka:9092", "--list"),
    )
    await waitFor("kafka group coordinator", kafkaServesGroups)

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
                // compose re-reads compose.yaml for `exec` too, so the run's secrets must be in its environment.
                env: composeEnv,
                input: fs.readFileSync(seed, "utf8"),
            },
        )
    }
    log("seeds applied")

    const mounts = mountServiceKeys(secrets)
    const env = serviceEnv(secrets, mounts)
    const services = ["identity", "order"].map((name) => startService(name, env[name]))
    const state = {
        startedAt: new Date().toISOString(),
        services: services.map(({ name, pid }) => ({ name, pid })),
        serviceKeys: mounts.dir,
        logs: path.relative(APP_ROOT, LOG_DIR),
    }
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)

    await Promise.all(
        services.map(async (service) => {
            const port = service.name === "identity" ? ports.identityApi : ports.orderApi
            log(`waiting for the ${service.name} api (log: ${service.log})`)
            await waitFor(
                `the ${service.name} api - see ${service.log}`,
                () => {
                    if (service.exited())
                        fail(`the ${service.name} api exited before answering /health - see ${service.log}`)
                    return serves(`http://localhost:${port}/health`)
                },
                120_000,
            )
        }),
    )
    log(`stack is up: shop ${ORIGIN_APP} once served, apis on ${ports.identityApi}/${ports.orderApi}`)
    log("run \`node browser/stack.mjs down\` when the browser run is done")
}

/** `down`: stop the host apis of the state file, then the compose project; best-effort, always reports. */
const down = () => {
    // Teardown only needs a valid model; fresh values satisfy required interpolation without storing the run's credentials.
    generateSecrets()
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
        if (typeof state.serviceKeys === "string") {
            fs.rmSync(state.serviceKeys, { recursive: true, force: true })
            log("service keys removed")
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
