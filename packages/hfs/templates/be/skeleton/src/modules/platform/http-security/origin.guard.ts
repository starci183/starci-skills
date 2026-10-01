import { Injectable } from "@nestjs/common"
import type { CanActivate, ExecutionContext } from "@nestjs/common"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { requestOf } from "./execution-request.mapper"
import { InjectHttpSecurityOptions } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"])

const originOf = (origin: string | undefined, referer: string | undefined): string | undefined => {
    if (origin) return origin
    return referer && URL.canParse(referer) ? new URL(referer).origin : undefined
}

@Injectable()
/**
 * The second app guard, the CSRF defence: a state-changing request that names an origin (browsers always do) must name
 * an allowed one. A request without Origin and Referer is not a browser and carries no ambient credential, so it passes.
 */
export class OriginGuard implements CanActivate {
    constructor(@InjectHttpSecurityOptions() private readonly options: HttpSecurityOptions) {}

    /** Refuses a state-changing request from an origin outside the allowlist. */
    canActivate(context: ExecutionContext): boolean {
        const request = requestOf(context)
        if (SAFE_METHODS.has(request.method)) return true
        const origin = originOf(request.headers.origin, request.headers.referer)
        if (origin === undefined || this.options.allowedOrigins.includes(origin)) return true
        throw new HttpSecurityError({ code: HttpSecurityErrorCode.OriginRejected })
    }
}
