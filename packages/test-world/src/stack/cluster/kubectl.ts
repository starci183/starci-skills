import { execOrThrow } from "../exec"
import type { Exec, ExecResult } from "../exec"

/** What one kubectl call may be given. */
export interface KubectlOptions {
    /** Written to stdin (`apply -f -`). */
    readonly input?: string
    readonly timeoutMs?: number
}

/** kubectl run inside the k3s server container (`docker exec -i <server> kubectl ...`): no host kubectl is needed. */
export interface Kubectl {
    /** Runs kubectl; throws `InfrastructureFailed` on a non-zero exit and answers trimmed stdout. */
    (args: ReadonlyArray<string>, options?: KubectlOptions): Promise<string>
    /** Runs kubectl without throwing. */
    try(args: ReadonlyArray<string>, options?: KubectlOptions): Promise<ExecResult>
}

/** Builds the kubectl helper bound to a server container. */
export const createKubectl = (exec: Exec, serverContainer: string): Kubectl => {
    const full = (args: ReadonlyArray<string>): ReadonlyArray<string> => ["exec", "-i", serverContainer, "kubectl", ...args]
    const run = (args: ReadonlyArray<string>, options?: KubectlOptions): Promise<string> => execOrThrow(exec, "docker", full(args), options)
    return Object.assign(run, { try: (args: ReadonlyArray<string>, options?: KubectlOptions) => exec("docker", full(args), options) })
}
