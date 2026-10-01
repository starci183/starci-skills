import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LocalWindow, RateLimitHitParams } from "./http-security.contracts"
import { InjectRateLimitStore } from "./http-security.decorators"
import { HttpSecurityLogEvent } from "./http-security.log-events"
import type { RateLimitStore } from "./rate-limit-store.port"

/** The in-process windows kept at most; the lapsed ones are dropped when the map grows past it. */
const LOCAL_WINDOWS_MAX = 10_000

@Injectable()
/**
 * The counter behind the rate-limit guard. It counts in the shared store, so every replica of the app sees one count per
 * caller. When the store fails it degrades to a fixed-window counter in process memory (the protection of one replica: at
 * most replicas x limit), logs `rate-limit.store.degraded` once per window and keeps serving; the next request that the
 * store answers counts there again.
 */
export class RateLimitService {
    private readonly local = new Map<string, LocalWindow>()
    private degradedUntil = 0

    constructor(
        @InjectRateLimitStore() private readonly store: RateLimitStore,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Counts one request under the key and answers the count of its current window. */
    async count(params: RateLimitHitParams): Promise<number> {
        try {
            return await this.store.hit(params)
        } catch (cause) {
            return this.countLocally(params, cause)
        }
    }

    private countLocally(params: RateLimitHitParams, cause: unknown): number {
        const now = this.clock.now().getTime()
        if (now >= this.degradedUntil) {
            this.logger.error(HttpSecurityLogEvent.RateLimitStoreDegraded, cause, { windowMs: params.windowMs })
            this.degradedUntil = now + params.windowMs
        }
        const current = this.local.get(params.key)
        const window = current && current.resetAt > now ? current : { count: 0, resetAt: now + params.windowMs }
        window.count += 1
        this.local.set(params.key, window)
        if (this.local.size > LOCAL_WINDOWS_MAX) this.prune(now)
        return window.count
    }

    private prune(now: number): void {
        for (const [key, window] of this.local) {
            if (window.resetAt <= now) this.local.delete(key)
        }
    }
}
