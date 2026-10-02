import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/** The request config lives in this app's i18n module; next-intl compiles it from source. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** The npm workspace root: Turbopack resolves the workspace packages from it, and output tracing is pinned to it. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    // The shop is the authenticated app: it does not advertise the framework that serves it.
    poweredByHeader: false,
    outputFileTracingRoot: WORKSPACE_ROOT,
    turbopack: { root: WORKSPACE_ROOT },
}

export default withNextIntl(nextConfig)
