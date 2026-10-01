/**
 * The docker calls of the test world: plain `docker run` / `docker kill` / `docker start` / `docker rm -f` on the
 * run-named containers of the services `.starcistacks/dev` declares (the Postgres database, the Keycloak identity provider
 * with the realm the stack imports), each at the image the stack pins. No compose file and no container library: the host port is allocated by the caller
 * (OS-assigned, loopback only) and published explicitly, so `docker start` after `docker kill` restores the identical
 * endpoint. Every call is bounded: an unresponsive engine fails the run instead of hanging it.
 */
import { execFileSync } from "node:child_process"
import { basename } from "node:path"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const DOCKER_TIMEOUT_MS = 120_000
const OUTPUT_MAX_BYTES = 16 * 1024 * 1024
const POSTGRES_IMAGE = "postgres:16"
const POSTGRES_PORT = 5432
const KEYCLOAK_IMAGE = "quay.io/keycloak/keycloak:26.0"
const KEYCLOAK_PORT = 8080
const KEYCLOAK_IMPORT_DIR = "/opt/keycloak/data/import"

/** What one Postgres container of the run is made of. */
export interface PostgresContainerSpec {
    /** The run-scoped container name. */
    readonly name: string
    /** The run token, stamped as a label so a leftover of this run can be found by observation. */
    readonly runId: string
    /** The loopback host port the container publishes 5432 on. */
    readonly hostPort: number
    /** The superuser created at first start. */
    readonly user: string
    /** The password of that user. */
    readonly password: string
    /** The database created at first start. */
    readonly database: string
}

const docker = (args: ReadonlyArray<string>): string => {
    try {
        return execFileSync("docker", [...args], {
            encoding: "utf8",
            maxBuffer: OUTPUT_MAX_BYTES,
            timeout: DOCKER_TIMEOUT_MS,
        }).trim()
    } catch (cause) {
        throw new TestWorldError({
            code: TestWorldErrorCode.InfrastructureFailed,
            params: { detail: `docker ${args.slice(0, 2).join(" ")} failed` },
            cause,
        })
    }
}

/** Starts the Postgres container of the run, detached, published on loopback only. */
export const runPostgres = (spec: PostgresContainerSpec): void => {
    docker([
        "run",
        "-d",
        "--name",
        spec.name,
        "--label",
        `todo-e2e-run=${spec.runId}`,
        "-e",
        `POSTGRES_USER=${spec.user}`,
        "-e",
        `POSTGRES_PASSWORD=${spec.password}`,
        "-e",
        `POSTGRES_DB=${spec.database}`,
        "-p",
        `127.0.0.1:${spec.hostPort}:${POSTGRES_PORT}`,
        POSTGRES_IMAGE,
    ])
}

/** What the Keycloak container of the run is made of. */
export interface KeycloakContainerSpec {
    /** The run-scoped container name. */
    readonly name: string
    /** The run token, stamped as a label so a leftover of this run can be found by observation. */
    readonly runId: string
    /** The loopback host port the container publishes its HTTP port on. */
    readonly hostPort: number
    /** The realm export the stack imports (`.starcistacks/dev/infra/compose/realm-<realm>.json`), mounted read-only. */
    readonly realmFile: string
    /** The password of the bootstrap administrator of the master realm. */
    readonly adminPassword: string
}

/** The bootstrap administrator of a Keycloak container of the run. */
export const KEYCLOAK_ADMIN_USER = "admin"

/** Starts the Keycloak container of the run in development mode, importing the stack's realm, published on loopback only. */
export const runKeycloak = (spec: KeycloakContainerSpec): void => {
    docker([
        "run",
        "-d",
        "--name",
        spec.name,
        "--label",
        `todo-e2e-run=${spec.runId}`,
        "-e",
        `KC_BOOTSTRAP_ADMIN_USERNAME=${KEYCLOAK_ADMIN_USER}`,
        "-e",
        `KC_BOOTSTRAP_ADMIN_PASSWORD=${spec.adminPassword}`,
        "--mount",
        `type=bind,source=${spec.realmFile},target=${KEYCLOAK_IMPORT_DIR}/${basename(spec.realmFile)},readonly`,
        "-p",
        `127.0.0.1:${spec.hostPort}:${KEYCLOAK_PORT}`,
        KEYCLOAK_IMAGE,
        "start-dev",
        "--import-realm",
    ])
}

/** True once the server inside the container answers a query over TCP (the init-time server listens on a socket only); throws while it does not. */
export const postgresAccepts = (name: string, user: string, database: string): boolean => {
    docker(["exec", name, "psql", "-h", "127.0.0.1", "-U", user, "-d", database, "-tAc", "SELECT 1"])
    return true
}

/** Kills the container: the process dies with no shutdown, like a crashed host. */
export const killContainer = (name: string): void => {
    docker(["kill", name])
}

/** Starts a killed container again: the identical container, same published port, same data. */
export const startContainer = (name: string): void => {
    docker(["start", name])
}

/** Removes the container and its anonymous volume, running or not; absent is fine. */
export const removeContainer = (name: string): void => {
    if (containersNamed(name).length > 0) docker(["rm", "-f", "-v", name])
}

/** The names of the containers (running or not) that carry exactly this name: empty when the run left nothing. */
export const containersNamed = (name: string): ReadonlyArray<string> =>
    docker(["ps", "-a", "--filter", `name=^${name}$`, "--format", "{{.Names}}"])
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
