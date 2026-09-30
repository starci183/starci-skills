import { Injectable, SetMetadata } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectReflector } from "@modules/platform/composition"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { requestOf } from "./execution-request.mapper"
import { InjectHttpSecurityOptions } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

/** The rate limit tiers of a door. */
export enum RateTier {
    /** The global default tier. */
    Default = "default",
    /** The tight tier every authentication handshake and signed webhook carries. */
    Strict = "strict",
}

const RATE_TIER_KEY = "platform.http-security.rate-tier"
const BUCKETS_MAX = 10_000

interface Bucket {
    count: number
    resetAt: number
}

/** Marks a door with a rate limit tier other than the default. */
export const RateLimit = (tier: RateTier): ReturnType<typeof SetMetadata> => SetMetadata(RATE_TIER_KEY, tier)

@Injectable()
/** The first app guard: a fixed-window counter per caller address and tier, kept in process memory and stamped by the Clock. */
export class RateLimitGuard implements CanActivate {
    private readonly buckets = new Map<string, Bucket>()

    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectClock() private readonly clock: Clock,
        @InjectHttpSecurityOptions() private readonly options: HttpSecurityOptions,
    ) {}

    /** Counts the request and refuses it when the caller is over the limit of the door tier. */
    canActivate(context: ExecutionContext): boolean {
        const tier = this.reflector.getAllAndOverride<RateTier | undefined>(RATE_TIER_KEY, [context.getHandler(), context.getClass()]) ?? RateTier.Default
        const limit = tier === RateTier.Strict ? this.options.rateLimit.strictLimit : this.options.rateLimit.defaultLimit
        const now = this.clock.now().getTime()
        const key = `${tier}:${requestOf(context).ip ?? "unknown"}`
        const current = this.buckets.get(key)
        const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + this.options.rateLimit.windowMs }
        bucket.count += 1
        this.buckets.set(key, bucket)
        if (this.buckets.size > BUCKETS_MAX) this.prune(now)
        if (bucket.count > limit) throw new HttpSecurityError({ code: HttpSecurityErrorCode.RateLimited })
        return true
    }

    private prune(now: number): void {
        for (const [key, bucket] of this.buckets) {
            if (bucket.resetAt <= now) this.buckets.delete(key)
        }
    }
}
