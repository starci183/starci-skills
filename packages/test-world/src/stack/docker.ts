import { execCommand, execOrThrow } from "./exec"
import type { Exec, ExecOptions, ExecResult } from "./exec"

/** The docker CLI, thin: every call goes through an injected {@link Exec}, so layers are unit-tested with a scripted runner. */
export class Docker {
    constructor(readonly exec: Exec = execCommand) {}

    /** `docker <args>`; throws `InfrastructureFailed` on a non-zero exit and answers trimmed stdout. */
    run(args: ReadonlyArray<string>, options?: ExecOptions): Promise<string> {
        return execOrThrow(this.exec, "docker", args, options)
    }

    /** `docker <args>` without throwing. */
    try(args: ReadonlyArray<string>, options?: ExecOptions): Promise<ExecResult> {
        return this.exec("docker", args, options)
    }

    /** `docker inspect` of a container as parsed JSON, or null when it does not exist. */
    async inspect(container: string): Promise<Record<string, unknown> | null> {
        const result = await this.try(["inspect", "--type", "container", container])
        if (result.code !== 0) return null
        const parsed: unknown = JSON.parse(result.stdout)
        return Array.isArray(parsed) && typeof parsed[0] === "object" && parsed[0] !== null ? (parsed[0] as Record<string, unknown>) : null
    }

    /** The state of a container: `running`, `exited`, ... or `missing`. */
    async state(container: string): Promise<string> {
        const result = await this.try(["inspect", "--type", "container", "--format", "{{.State.Status}}", container])
        return result.code === 0 ? result.stdout.trim() : "missing"
    }

    /** The host port a container port is published on, or null when unpublished. */
    async hostPort(container: string, containerPort: number, protocol = "tcp"): Promise<number | null> {
        const result = await this.try(["port", container, `${containerPort}/${protocol}`])
        if (result.code !== 0) return null
        const match = /:(\d+)\s*$/.exec((result.stdout.trim().split(/\r?\n/)[0] ?? "").trim())
        return match?.[1] === undefined ? null : Number(match[1])
    }

    /** Creates a user-defined bridge network when absent. */
    async ensureNetwork(name: string): Promise<void> {
        const found = await this.try(["network", "inspect", name])
        if (found.code === 0) return
        const created = await this.try(["network", "create", name])
        if (created.code !== 0 && !/already exists/i.test(created.stderr)) await this.run(["network", "create", name])
    }

    /** Removes a container (force, with its anonymous volumes) if it exists. */
    async remove(container: string): Promise<void> {
        await this.try(["rm", "-f", "-v", container])
    }

    /** `docker exec` inside a container, without throwing. */
    execIn(container: string, args: ReadonlyArray<string>, options?: ExecOptions): Promise<ExecResult> {
        return this.try(["exec", container, ...args], options)
    }
}
