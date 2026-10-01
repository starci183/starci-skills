import { spawn } from "node:child_process"
import { TestWorldErrorCode, worldError } from "../errors"

/** The result of one command. */
export interface ExecResult {
    readonly code: number
    readonly stdout: string
    readonly stderr: string
}

/** What a command may be given. */
export interface ExecOptions {
    /** Written to stdin. */
    readonly input?: string
    /** Kill after this many milliseconds (default 120000). */
    readonly timeoutMs?: number
    readonly cwd?: string
    readonly env?: Readonly<Record<string, string>>
}

/** Runs one command; never throws on a non-zero exit (the caller decides). Injected so every layer is unit-testable without docker. */
export type Exec = (command: string, args: ReadonlyArray<string>, options?: ExecOptions) => Promise<ExecResult>

const DEFAULT_TIMEOUT_MS = 120_000

/** The real {@link Exec}: `spawn` without a shell, output captured as utf8. */
export const execCommand: Exec = (command, args, options = {}) =>
    new Promise<ExecResult>((resolve, reject) => {
        const child = spawn(command, [...args], {
            cwd: options.cwd,
            env: options.env === undefined ? process.env : { ...process.env, ...options.env },
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        })
        const out: Array<Buffer> = []
        const err: Array<Buffer> = []
        const timer = setTimeout(() => child.kill("SIGKILL"), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
        child.stdout.on("data", (chunk: Buffer) => out.push(chunk))
        child.stderr.on("data", (chunk: Buffer) => err.push(chunk))
        child.on("error", (cause) => {
            clearTimeout(timer)
            reject(worldError(TestWorldErrorCode.InfrastructureFailed, `${command} could not start: ${String(cause)}`, cause))
        })
        child.on("close", (code) => {
            clearTimeout(timer)
            resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") })
        })
        child.stdin.on("error", () => undefined)
        child.stdin.end(options.input ?? "")
    })

/** Runs a command and answers stdout (trimmed); a non-zero exit is an `InfrastructureFailed` carrying stderr. */
export const execOrThrow = async (exec: Exec, command: string, args: ReadonlyArray<string>, options?: ExecOptions): Promise<string> => {
    const result = await exec(command, args, options)
    if (result.code !== 0) {
        throw worldError(TestWorldErrorCode.InfrastructureFailed, `${command} ${args.join(" ")} exited ${result.code}: ${(result.stderr || result.stdout).trim().slice(0, 2000)}`)
    }
    return result.stdout.trim()
}
