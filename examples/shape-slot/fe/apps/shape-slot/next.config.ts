import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/** The request config lives in this app's i18n module; next-intl resolves it from the directory the build runs in. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** The npm workspace root (three levels above this app): Turbopack resolves the built workspace packages from it, and output tracing is pinned to it. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

/** Next config of the shape-slot app: the standalone output its image ships, next-intl wired to the request config, root params on (the locale is read from the route). */
const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    experimental: { rootParams: true },
    outputFileTracingRoot: WORKSPACE_ROOT,
    turbopack: { root: WORKSPACE_ROOT },
    // The product app is the authenticated one: it does not advertise the framework that serves it.
    poweredByHeader: false,
    headers() {
        return Promise.resolve([
            {
                source: "/:path*",
                headers: [
                    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Content-Security-Policy",
                        value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
                    },
                ],
            },
        ])
    },
}

export default withNextIntl(nextConfig)
