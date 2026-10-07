/** The implementation of `starci app stack`: `up`, `down` and `status` of the shared warm stack. */
import { TestWorldErrorCode, worldError } from "../errors"
import { matchesKind, readStackDefinition } from "../config/stack-file"
import { INFRA_SERVICES, type InfraName } from "../config/types"
import type { StackApi, StackImageRequest, StackStatus } from "../stack/contracts"

/** What `main` may be given instead of the real process environment. */
export interface CliDependencies {
    /** The stack implementation (default: `../stack`, loaded lazily). */
    readonly stack?: StackApi
    /** Standard output (default: `process.stdout`). */
    readonly out?: (text: string) => void
    /** Standard error (default: `process.stderr`). */
    readonly err?: (text: string) => void
    /** The working directory, the default `--cwd` (default: `process.cwd()`). */
    readonly cwd?: string
}

/** The parsed command line. */
export interface CliOptions {
    readonly command: "up" | "down" | "status"
    readonly stack: string
    readonly services: ReadonlyArray<InfraName> | undefined
    readonly k3d: boolean
    readonly force: boolean
    readonly json: boolean
    readonly cwd: string | undefined
}

/** A command line that cannot be parsed; the CLI answers it with the shared bad-usage exit code. */
export interface CliUsageError {
    readonly usageError: string
}

/** The exit code of a bad command line. */
export const EXIT_USAGE = 2
/** The exit code of `down` refused because of live leases. */
export const EXIT_LEASED = 2

/** The usage text. */
export const USAGE = `Usage: starci app stack <up|down|status> [options]

Commands:
  up        start (or find) the shared warm containers of the stack definition
  status    list the shared containers and the live leases (always exit 0)
  down      stop the shared containers; refused while leases exist unless --force

Options:
  --stack <dir>            stack definition directory (default .starcistacks/dev)
  --services <a,b,...>     services to keep warm: ${INFRA_SERVICES.join(", ")} (default: every one the stack definition has)
  --k3d                    up: also warm the k3d cluster and registry
  --force                  down: stop everything even while leases exist
  --json                   status: print JSON
  --cwd <dir>              app root (default: the current directory)
  -h, --help               this text
`

/** Parses the arguments after the binary name. `help` answers the usage request. */
export const parseArguments = (argv: ReadonlyArray<string>): CliOptions | CliUsageError | "help" => {
    let command: CliOptions["command"] | undefined
    let stack = ".starcistacks/dev"
    let services: InfraName[] | undefined
    let k3d = false
    let force = false
    let json = false
    let cwd: string | undefined
    const args = [...argv]
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? ""
        const inline = arg.startsWith("--") && arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : undefined
        const flag = inline === undefined ? arg : arg.slice(0, arg.indexOf("="))
        const value = (): string | CliUsageError => {
            if (inline !== undefined) return inline
            const next = args[index + 1]
            if (next === undefined || next.startsWith("-")) return { usageError: `${flag} needs a value` }
            index += 1
            return next
        }
        if (flag === "-h" || flag === "--help") return "help"
        if (flag === "--k3d") k3d = true
        else if (flag === "--force") force = true
        else if (flag === "--json") json = true
        else if (flag === "--stack" || flag === "--cwd" || flag === "--services") {
            const got = value()
            if (typeof got !== "string") return got
            if (flag === "--stack") stack = got
            else if (flag === "--cwd") cwd = got
            else {
                const names = got.split(",").map((name) => name.trim()).filter((name) => name !== "")
                const unknown = names.filter((name) => !(INFRA_SERVICES as ReadonlyArray<string>).includes(name))
                if (names.length === 0 || unknown.length > 0) {
                    return { usageError: `--services: ${unknown.length > 0 ? `unknown ${unknown.join(", ")}` : "empty list"} (known: ${INFRA_SERVICES.join(", ")})` }
                }
                services = names as InfraName[]
            }
        } else if (arg.startsWith("-")) return { usageError: `unknown option ${arg}` }
        else if (command === undefined && (arg === "up" || arg === "down" || arg === "status")) command = arg
        else return { usageError: command === undefined ? `unknown command ${arg}` : `unexpected argument ${arg}` }
    }
    if (command === undefined) return { usageError: "a command is required" }
    return { command, stack, services, k3d, force, json, cwd }
}

const pad = (cells: ReadonlyArray<string>, widths: ReadonlyArray<number>): string =>
    cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd()

/** Formats the containers as a table, one line per container: service, image, container, state, port. */
export const formatContainers = (status: StackStatus): ReadonlyArray<string> => {
    const rows = status.containers.map((container) => [container.service, container.image, container.container, container.state, container.port === null ? "-" : String(container.port)])
    const widths = [0, 1, 2, 3, 4].map((column) => Math.max(...rows.map((row) => (row[column] ?? "").length)))
    return rows.map((row) => pad(row, widths))
}

/** The lease line(s) of a status. */
export const formatLeases = (status: StackStatus): ReadonlyArray<string> => [
    `leases: ${status.leases.length}`,
    ...status.leases.map((lease) => `  ${lease.namespace} run ${lease.runId} pid ${lease.pid} since ${lease.since}`),
]

/** The images the stack definition has for the wanted services (default: every supported kind it contains). */
export const imagesFromDefinition = (root: string, stackDir: string, wanted: ReadonlyArray<InfraName> | undefined): ReadonlyArray<StackImageRequest> => {
    const definition = readStackDefinition(root, stackDir)
    const entries = Object.entries(definition.services)
    const requests: StackImageRequest[] = []
    for (const service of wanted ?? INFRA_SERVICES) {
        const found = entries.find(([name, entry]) => matchesKind(service, name, entry.image))
        if (found !== undefined) requests.push({ service, image: found[1].image })
        else if (wanted !== undefined) {
            throw worldError(
                TestWorldErrorCode.StackDefinition,
                `--services ${service}: the stack definition ${stackDir} has no ${service} service; it has: ${entries.map(([name]) => name).join(", ") || "no services with an image"}`,
            )
        }
    }
    return requests
}

const STACK_MODULE = "../stack"

/** Loads the real stack lazily, so the CLI parses, prints usage and runs against an injected stack without docker code. */
const loadStack = (): Promise<StackApi> => Promise.resolve().then(() => (require(STACK_MODULE) as { readonly stack: StackApi }).stack)

/** Runs the command; answers the process exit code. */
export const main = async (argv: ReadonlyArray<string>, dependencies: CliDependencies = {}): Promise<number> => {
    const out = dependencies.out ?? ((text: string) => void process.stdout.write(text))
    const err = dependencies.err ?? ((text: string) => void process.stderr.write(text))
    const parsed = parseArguments(argv)
    if (parsed === "help") {
        out(USAGE)
        return 0
    }
    if ("usageError" in parsed) {
        err(`starci app stack: ${parsed.usageError}\n\n${USAGE}`)
        return EXIT_USAGE
    }
    const line = (text: string): void => out(`${text}\n`)
    try {
        const stack = dependencies.stack ?? (await loadStack())
        if (parsed.command === "status") {
            const status = await stack.status()
            if (parsed.json) line(JSON.stringify(status, null, 2))
            else {
                if (status.containers.length === 0) line("no shared containers")
                for (const row of formatContainers(status)) line(row)
                for (const row of formatLeases(status)) line(row)
            }
            return 0
        }
        if (parsed.command === "down") {
            if (!parsed.force) {
                const status = await stack.status()
                if (status.leases.length > 0) {
                    err(
                        `starci app stack: refusing to stop the stack, ${status.leases.length} live lease(s) hold it: ${status.leases.map((lease) => `${lease.namespace} (run ${lease.runId}, pid ${lease.pid})`).join(", ")}. Use --force to stop it anyway.\n`,
                    )
                    return EXIT_LEASED
                }
            }
            const status = await stack.down({ force: parsed.force })
            line(`stopped; ${status.containers.length} shared container(s) remain`)
            for (const row of formatContainers(status)) line(row)
            line(formatLeases(status)[0] ?? "")
            return 0
        }
        const root = parsed.cwd ?? dependencies.cwd ?? process.cwd()
        const images = imagesFromDefinition(root, parsed.stack, parsed.services)
        if (images.length === 0) {
            err(`starci app stack: the stack definition ${parsed.stack} under ${root} has no service this library supports (${INFRA_SERVICES.join(", ")})\n`)
            return 1
        }
        const status = await stack.up(images, parsed.k3d ? { images: [], root } : undefined)
        for (const row of formatContainers(status)) line(row)
        for (const row of formatLeases(status)) line(row)
        return 0
    } catch (error) {
        err(`starci app stack: ${error instanceof Error ? error.message : String(error)}\n`)
        return 1
    }
}
