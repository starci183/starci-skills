/**
 * What every fake shares regardless of transport: the log of received requests, the queue of armed failures, the timers of
 * delayed work and the base control actions (`fail-next`, `requests`, `reset`).
 */
import type { FailureSpec, RecordedRequest } from "./contracts"

/** A request being recorded: the status and body are filled once the fake answered. */
export interface RecordingHandle {
    /** Sets the status the fake answered. */
    setStatus(status: number): void
    /** Replaces the recorded body. */
    setBody(body: string): void
}

type MutableRecord = { -readonly [K in keyof RecordedRequest]: RecordedRequest[K] }

/** The calls one fake received, oldest first; entries are recorded on arrival so a request that never gets an answer shows status 0. */
export class RequestLog {
    private entries: Array<MutableRecord> = []

    /** Records the arrival of one call (status 0 until answered). */
    begin(entry: Omit<RecordedRequest, "at" | "status">): RecordingHandle {
        const stored: MutableRecord = { at: new Date().toISOString(), status: 0, ...entry }
        this.entries.push(stored)
        return {
            setStatus: (status) => {
                stored.status = status
            },
            setBody: (body) => {
                stored.body = body
            },
        }
    }

    /** Everything recorded so far (copies). */
    all(): ReadonlyArray<RecordedRequest> {
        return this.entries.map((entry) => ({ ...entry }))
    }

    /** Forgets everything. */
    clear(): void {
        this.entries = []
    }
}

/** One armed inbound failure and how many calls it still fails. */
interface ArmedFailure {
    readonly spec: FailureSpec
    remaining: number
}

/** The failures a spec armed for one fake: each serves `times` matching calls (default 1), in arming order. */
export class FailureQueue {
    private inbound: Array<ArmedFailure> = []
    private outbound: Array<ArmedFailure> = []

    /** Arms a failure. Status, timeout and truncated streams wait for an inbound call; a bad signature waits for a webhook delivery. */
    push(spec: FailureSpec): void {
        const remaining = Math.max(1, spec.times ?? 1)
        if (spec.status !== undefined || spec.timeout === true || spec.truncateStream !== undefined) {
            this.inbound.push({ spec, remaining })
        }
        if (spec.badSignature === true) this.outbound.push({ spec, remaining })
    }

    /**
     * The armed failure for a call, consumed once; null when none matches. A failure without `match.method` matches every
     * method unless `defaultMethod` restricts it (SMTP: `RCPT`).
     */
    takeInbound(method: string, path: string, defaultMethod?: string): FailureSpec | null {
        const index = this.inbound.findIndex(({ spec }) => {
            const wanted = spec.match?.method ?? defaultMethod
            if (wanted !== undefined && wanted.toUpperCase() !== method.toUpperCase()) return false
            const prefix = spec.match?.pathStartsWith
            return prefix === undefined || path.startsWith(prefix)
        })
        const armed = this.inbound[index]
        if (armed === undefined) return null
        armed.remaining -= 1
        if (armed.remaining <= 0) this.inbound.splice(index, 1)
        return armed.spec
    }

    /** True when the next webhook delivery must carry a wrong signature; consumes one. */
    takeBadSignature(): boolean {
        const armed = this.outbound[0]
        if (armed === undefined) return false
        armed.remaining -= 1
        if (armed.remaining <= 0) this.outbound.shift()
        return true
    }

    /** Forgets every armed failure. */
    clear(): void {
        this.inbound = []
        this.outbound = []
    }
}

/** Delayed work of a fake (a delayed webhook): tracked so a reset or a close cancels it. */
export class FakeTimers {
    private readonly pending = new Set<NodeJS.Timeout>()

    /** Runs `task` after `delayMs`; a failing task is swallowed (there is nobody to tell). */
    schedule(delayMs: number, task: () => Promise<unknown> | unknown): void {
        const timer = setTimeout(() => {
            this.pending.delete(timer)
            void Promise.resolve()
                .then(task)
                .catch(() => undefined)
        }, delayMs)
        this.pending.add(timer)
    }

    /** How many timers wait. */
    get size(): number {
        return this.pending.size
    }

    /** Cancels every waiting timer. */
    clear(): void {
        for (const timer of this.pending) clearTimeout(timer)
        this.pending.clear()
    }
}

/** A control call the fake refuses with a chosen HTTP status (the host answers `{error}` with it). */
export class FakeControlRejected extends Error {
    /** The HTTP status the control channel answers. */
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = "FakeControlRejected"
        this.status = status
    }
}

/** What the base control actions act on. */
export interface BaseControlTargets {
    readonly failures: FailureQueue
    readonly log: RequestLog
    /** Runs the full reset of the fake. */
    reset(): Promise<void>
}

/** Runs `fail-next`, `requests` or `reset`; `{ handled: false }` for any other action. */
export const runBaseControl = async (
    action: string,
    body: unknown,
    targets: BaseControlTargets,
): Promise<{ readonly handled: true; readonly result: unknown } | { readonly handled: false }> => {
    if (action === "fail-next") {
        if (typeof body !== "object" || body === null) throw new FakeControlRejected(400, "fail-next needs a FailureSpec body")
        targets.failures.push(body as FailureSpec)
        return { handled: true, result: { armed: true } }
    }
    if (action === "requests") return { handled: true, result: targets.log.all() }
    if (action === "reset") {
        await targets.reset()
        return { handled: true, result: { reset: true } }
    }
    return { handled: false }
}
