import { createHash } from "node:crypto"
import { Injectable, SetMetadata } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { ThrottlerGuard } from "@nestjs/throttler"
import type { ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { requestOf } from "./execution-request.mapper"
import { InjectHttpSecurityOptions, InjectRateLimitStorage, InjectRateLimitReflector } from "./http-security.decorators"
import type { HttpSecurityOptions, RateLimitOptions } from "./http-security.options"

/** The rate limit tiers of a door. */
export enum RateTier {
    /** The global default tier. */
    Default = "default",
    /** The tight tier every authentication handshake and signed webhook carries. */
    Strict = "strict",
    /**
     * The tier of a door another service calls with its own credential: counted per presented credential, not per address,
     * so the services behind one address keep separate budgets and a shopper's traffic through them never meets the strict tier.
     */
    Service = "service",
}

const RATE_TIER_KEY = "platform.http-security.rate-tier"

/** Marks a door with a rate limit tier other than the default. */
export const RateLimit = (tier: RateTier): ReturnType<typeof SetMetadata> => SetMetadata(RATE_TIER_KEY, tier)

const tierOf = (context: ExecutionContext): RateTier => {
    const declared: RateTier | undefined =
        Reflect.getMetadata(RATE_TIER_KEY, context.getHandler()) ??
        Reflect.getMetadata(RATE_TIER_KEY, context.getClass())
    return declared ?? RateTier.Default
}

/**
 * The service tier's counter key: a digest of the presented credential, so each calling service has its own window and the
 * credential itself is never a storage key. An absent credential shares one anonymous window.
 */
export const serviceTrackerOf = (request: Record<string, unknown>): string => {
    const headers = request.headers as Readonly<Record<string, unknown>> | undefined
    const authorization = typeof headers?.authorization === "string" ? headers.authorization : ""
    return `service:${createHash("sha256").update(authorization).digest("hex")}`
}

/** The throttler configuration of the app: one window per tier, each counting only the doors of its own tier. */
export const throttlerOptionsOf = (rateLimit: RateLimitOptions): ThrottlerModuleOptions => ({
    throttlers: [
        {
            name: RateTier.Default,
            ttl: rateLimit.windowMs,
            limit: rateLimit.defaultLimit,
            skipIf: (context) => tierOf(context) !== RateTier.Default,
        },
        {
            name: RateTier.Strict,
            ttl: rateLimit.windowMs,
            limit: rateLimit.strictLimit,
            skipIf: (context) => tierOf(context) !== RateTier.Strict,
        },
        {
            name: RateTier.Service,
            ttl: rateLimit.windowMs,
            limit: rateLimit.serviceLimit,
            skipIf: (context) => tierOf(context) !== RateTier.Service,
            getTracker: serviceTrackerOf,
        },
    ],
    setHeaders: false,
})

/** The two objects the throttler reads of a request: the caller and its response. */
export interface ThrottledExchange {
    /** The caller address and the headers of the HTTP request. */
    readonly req: Record<string, unknown>
    /** Nothing: the guard sets no response headers. */
    readonly res: Record<string, unknown>
}

@Injectable()
/**
 * The first app guard, the throttler: a window counter per caller address and tier kept by `@nestjs/throttler`. It reads
 * the caller from the HTTP request under either transport and answers an overrun with the RateLimited capability error.
 */
export class RateLimitGuard extends ThrottlerGuard {
    constructor(
        @InjectHttpSecurityOptions() options: HttpSecurityOptions,
        @InjectRateLimitStorage() storage: ThrottlerStorage,
        @InjectRateLimitReflector() reflector: Reflector,
    ) {
        super(throttlerOptionsOf(options.rateLimit), storage, reflector)
    }

    /** The two fields the throttler reads: the caller address and the headers of the HTTP request behind REST or GraphQL. */
    protected override getRequestResponse(context: ExecutionContext): ThrottledExchange {
        const request = requestOf(context)
        return { req: { ip: request.ip, headers: request.headers }, res: {} }
    }

    /** Refuses the request with the RateLimited code, which the one error filter and formatter map to `rate-limited`. */
    protected override throwThrottlingException(): Promise<void> {
        return Promise.reject(new HttpSecurityError({ code: HttpSecurityErrorCode.RateLimited }))
    }
}
