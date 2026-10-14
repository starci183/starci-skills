import type { RequestHandler } from "express"

/** The API serves data only: deny document embedding and active content, and keep responses out of caches. */
export const securityHeaders: RequestHandler = (_request, response, next): void => {
    response.removeHeader("X-Powered-By")
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("X-Frame-Options", "DENY")
    response.setHeader("Referrer-Policy", "no-referrer")
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
    response.setHeader("Cache-Control", "no-store")
    next()
}
