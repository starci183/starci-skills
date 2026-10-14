import type { INestApplication } from "@nestjs/common"
import type { Express, RequestHandler } from "express"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import type { HttpSecurityOptions } from "./http-security.options"

/** The declared ingress hop count and the environment in which HTTP origins may be used. */
export interface HttpEdgeOptions {
    /** Exact trusted proxy hops; the standard API stack has one ingress in front of it. */
    readonly trustProxy: number
}

/** Validates exact browser origins at boot, before CORS can admit a request. */
export const validateAllowedOrigins = (origins: ReadonlyArray<string>, allowHttpOrigins: boolean): Array<string> => {
    if (origins.length === 0)
        throw new HttpSecurityError({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "HTTP_SECURITY_ALLOWED_ORIGINS" },
        })
    return origins.map((origin) => {
        const parsed = URL.canParse(origin) ? new URL(origin) : undefined
        if (
            parsed === undefined ||
            origin.includes("*") ||
            parsed.origin !== origin ||
            (parsed.protocol !== "https:" && !(allowHttpOrigins && parsed.protocol === "http:"))
        )
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.RequestInvalid,
                params: { fields: "HTTP_SECURITY_ALLOWED_ORIGINS" },
            })
        return origin
    })
}

/** Security headers of the API's data and probe responses, including errors. */
export const securityHeaders: RequestHandler = (_request, response, next) => {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("X-Frame-Options", "DENY")
    response.setHeader("Referrer-Policy", "no-referrer")
    response.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'")
    next()
}

/** Installs the API edge policy once: validated CORS, security headers and a declared numeric ingress hop count. */
export const applyHttpSecurity = (app: INestApplication, options: HttpSecurityOptions, edge: HttpEdgeOptions): void => {
    const origins = validateAllowedOrigins(options.allowedOrigins, options.allowHttpOrigins === true)
    if (!Number.isSafeInteger(edge.trustProxy) || edge.trustProxy < 0)
        throw new HttpSecurityError({
            code: HttpSecurityErrorCode.RequestInvalid,
            params: { fields: "HTTP_SECURITY_TRUST_PROXY" },
        })
    const server = app.getHttpAdapter().getInstance<Express>()
    server.disable("x-powered-by")
    server.set("trust proxy", edge.trustProxy)
    app.use(securityHeaders)
    app.enableCors({ origin: origins })
}
