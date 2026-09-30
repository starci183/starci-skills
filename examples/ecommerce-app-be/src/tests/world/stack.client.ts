/**
 * The world's handle on the repository's own stack definition (`.starcistacks/dev`): every service the stack declares
 * (Postgres, Keycloak with its realm imported, Redis, ...) runs REAL, each behind a toxiproxy proxy. The world spells no
 * image and no port: `hfs test-stack up` (the `test:stack` script) reads the stack, starts or attaches to the warm stack
 * under its stable project name and answers where everything listens; `hfs test-stack down` removes it again.
 */
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const STACK_UP_TIMEOUT_MS = 20 * 60_000
const STACK_DOWN_TIMEOUT_MS = 5 * 60_000
const OUTPUT_MAX_BYTES = 16 * 1024 * 1024
const REPOSITORY_ROOT = join(__dirname, "..", "..", "..")

/** One published port of a stack service: the direct loopback port and the port of its toxiproxy proxy. */
export interface StackPort {
    /** The port inside the container. */
    readonly containerPort: number
    /** The loopback host of both ports. */
    readonly host: string
    /** The host port of the service itself: the world's own reads and admin calls. */
    readonly direct: number
    /** The host port of the toxiproxy proxy of this port: everything the apps under test talk to. */
    readonly proxy: number
    /** The name of the proxy at toxiproxy. */
    readonly proxyName: string
}

/** A bind mount of a stack service, as the stack declares it. */
export interface StackMount {
    /** The absolute host path. */
    readonly host: string
    /** The path inside the container. */
    readonly container: string
}

/** One service of the stack that runs for real. */
export interface StackService {
    /** The image the stack declares for it. */
    readonly image: string
    /** The container name. */
    readonly container: string
    /** The (test-only) environment of the service: users and passwords the stack declares. */
    readonly environment: Readonly<Record<string, string>>
    /** The bind mounts of the service (the imported realm of Keycloak, ...). */
    readonly mounts: ReadonlyArray<StackMount>
    /** The published ports. */
    readonly ports: ReadonlyArray<StackPort>
}

/** What `hfs test-stack up` answers. */
export interface TestStack {
    /** The stable project name of the stack. */
    readonly project: string
    /** True when this call started the stack (and so must stop it); false when it attached to a warm stack. */
    readonly started: boolean
    /** Where the toxiproxy control API listens. */
    readonly toxiproxy: { readonly apiUrl: string }
    /** The running services by their stack name. */
    readonly services: Readonly<Record<string, StackService>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isPort = (value: unknown): value is StackPort =>
    isRecord(value) &&
    typeof value.containerPort === "number" &&
    typeof value.host === "string" &&
    typeof value.direct === "number" &&
    typeof value.proxy === "number" &&
    typeof value.proxyName === "string"

const isMount = (value: unknown): value is StackMount =>
    isRecord(value) && typeof value.host === "string" && typeof value.container === "string"

const isService = (value: unknown): value is StackService =>
    isRecord(value) &&
    typeof value.image === "string" &&
    typeof value.container === "string" &&
    isRecord(value.environment) &&
    Object.values(value.environment).every((item) => typeof item === "string") &&
    Array.isArray(value.mounts) &&
    value.mounts.every(isMount) &&
    Array.isArray(value.ports) &&
    value.ports.every(isPort)

/** True when `value` has the shape of the state document `hfs test-stack up` prints. */
export const isTestStack = (value: unknown): value is TestStack =>
    isRecord(value) &&
    typeof value.project === "string" &&
    typeof value.started === "boolean" &&
    isRecord(value.toxiproxy) &&
    typeof value.toxiproxy.apiUrl === "string" &&
    isRecord(value.services) &&
    Object.values(value.services).every(isService)

const failed = (detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.InfrastructureFailed, params: { detail }, cause })

/** The command line of `hfs`, from the installed `@starci/hfs` package. */
const hfs = (args: ReadonlyArray<string>, timeoutMs: number): string => {
    let binary: string
    try {
        binary = join(dirname(require.resolve("@starci/hfs/package.json")), "bin", "hfs.mjs")
    } catch (cause) {
        throw failed("@starci/hfs is not installed: the world starts its stack through `hfs test-stack`", cause)
    }
    try {
        return execFileSync(process.execPath, [binary, ...args, "--repo", REPOSITORY_ROOT], {
            encoding: "utf8",
            maxBuffer: OUTPUT_MAX_BYTES,
            timeout: timeoutMs,
            stdio: ["ignore", "pipe", "inherit"],
        })
    } catch (cause) {
        throw failed(`hfs ${args.join(" ")} failed`, cause)
    }
}

/** Brings the stack up (or attaches to the warm one) and answers where every service and proxy listens. */
export const startStack = (): TestStack => {
    const parsed: unknown = JSON.parse(hfs(["test-stack", "up"], STACK_UP_TIMEOUT_MS))
    if (!isTestStack(parsed)) throw failed("hfs test-stack up answered a document the world does not understand")
    return parsed
}

/** Removes the stack this run started; a warm stack is never passed here. */
export const stopStack = (): void => {
    hfs(["test-stack", "down"], STACK_DOWN_TIMEOUT_MS)
}

/** The running service `name` of the stack; the stack the repository declares must carry it. */
export const serviceOf = (stack: TestStack, name: string): StackService => {
    const service = stack.services[name]
    if (service === undefined) throw failed(`the stack declares no service ${name} that the test world runs`)
    return service
}

/** The port of a service: the one published `containerPort`, else its first. */
export const portOf = (service: StackService, containerPort?: number): StackPort => {
    const port =
        containerPort === undefined
            ? service.ports[0]
            : service.ports.find((candidate) => candidate.containerPort === containerPort)
    if (port === undefined) {
        throw failed(`the service ${service.container} publishes no port ${containerPort ?? "at all"}`)
    }
    return port
}
