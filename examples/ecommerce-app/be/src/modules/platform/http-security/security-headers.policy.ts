import type { INestApplication } from "@nestjs/common"
import type { Application, NextFunction, Request, Response } from "express"

/** Applies API response headers and removes the framework fingerprint before the app starts listening. */
export const applySecurityHeaders = (app: INestApplication): void => {
    const server = app.getHttpAdapter().getInstance<Application>()
    server.disable("x-powered-by")
    app.use((_request: Request, response: Response, next: NextFunction): void => {
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("X-Frame-Options", "DENY")
        response.setHeader("Referrer-Policy", "no-referrer")
        response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        next()
    })
}
