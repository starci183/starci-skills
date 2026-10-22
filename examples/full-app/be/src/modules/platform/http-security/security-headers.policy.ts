import type { INestApplication } from "@nestjs/common"
import type { Application, RequestHandler } from "express"

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
    const server: Application = app.getHttpAdapter().getInstance()
    server.disable("x-powered-by")
    app.use(securityHeaders)
}
