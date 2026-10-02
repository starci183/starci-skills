import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/** The request config lives in this app's i18n module; next-intl resolves it from the directory the build runs in. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** The npm workspace root (three levels above this app): Turbopack resolves the built workspace packages from it, and output tracing is pinned to it. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

/** Next config of the landing: next-intl wired to the request config, root params on (the locale is read from the route). */
const nextConfig: NextConfig = {
    reactStrictMode: true,
    experimental: { rootParams: true },
    outputFileTracingRoot: WORKSPACE_ROOT,
    turbopack: { root: WORKSPACE_ROOT },
}

export default withNextIntl(nextConfig)
