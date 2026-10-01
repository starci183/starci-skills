import { Injectable, SetMetadata } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { InjectReflector } from "@modules/platform/composition"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { requestOf } from "./execution-request.mapper"
import { InjectHttpSecurityOptions } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { RateLimitService } from "./rate-limit.service"

/** The rate limit tiers of a door. */
export enum RateTier {
    /** The global default tier. */
    Default = "default",
    /** The tight tier every authentication handshake and signed webhook carries. */
    Strict = "strict",
}

const RATE_TIER_KEY = "platform.http-security.rate-tier"

/** Marks a door with a rate limit tier other than the default. */
export const RateLimit = (tier: RateTier): ReturnType<typeof SetMetadata> => SetMetadata(RATE_TIER_KEY, tier)

@Injectable()
/** The first app guard: a fixed-window counter per caller address and tier, shared by every replica through the counter service. */
export class RateLimitGuard implements CanActivate {
    constructor(
        @InjectReflector() private readonly reflector: Reflector,
        @InjectHttpSecurityOptions() private readonly options: HttpSecurityOptions,
        private readonly counter: RateLimitService,
    ) {}

    /** Counts the request and refuses it when the caller is over the limit of the door tier. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const tier =
            this.reflector.getAllAndOverride<RateTier | undefined>(RATE_TIER_KEY, [
                context.getHandler(),
                context.getClass(),
            ]) ?? RateTier.Default
        const limit =
            tier === RateTier.Strict ? this.options.rateLimit.strictLimit : this.options.rateLimit.defaultLimit
        const key = `${tier}:${requestOf(context).ip ?? "unknown"}`
        const count = await this.counter.count({ key, windowMs: this.options.rateLimit.windowMs })
        if (count > limit) throw new HttpSecurityError({ code: HttpSecurityErrorCode.RateLimited })
        return true
    }
}
