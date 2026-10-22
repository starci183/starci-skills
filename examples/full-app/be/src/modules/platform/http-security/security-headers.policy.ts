import type { INestApplication } from "@nestjs/common"
import type { Application, RequestHandler } from "express"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"

/** The express application behind the Nest adapter. Nest types the instance `any`; it is read as `unknown` and checked before use. */
const isExpressApplication = (value: unknown): value is Application =>
    (typeof value === "function" || (typeof value === "object" && value !== null)) &&
    typeof Reflect.get(value, "disable") === "function" &&
    typeof Reflect.get(value, "set") === "function"

const expressOf = (app: INestApplication): Application => {
    const instance: unknown = app.getHttpAdapter().getInstance()
    if (!isExpressApplication(instance))
        throw new HttpSecurityError({ code: HttpSecurityErrorCode.RequestInvalid, params: { fields: "HTTP_ADAPTER" } })
    return instance
}

/** Security headers of the API's data and probe responses, including errors. */
export const securityHeaders: RequestHandler = (_request, response, next) => {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("X-Frame-Options", "DENY")
    response.setHeader("Referrer-Policy", "no-referrer")
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    next()
}

/** Applies API response headers and removes the framework fingerprint before the app starts listening. */
export const applySecurityHeaders = (app: INestApplication): void => {
    const server = expressOf(app)
    server.disable("x-powered-by")
    app.use(securityHeaders)
}
