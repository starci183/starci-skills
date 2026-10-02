import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/** The request config lives in this app's i18n module. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** The npm workspace root, used by Turbopack and output tracing. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

/** Next config of the web app. */
const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    experimental: { rootParams: true },
    outputFileTracingRoot: WORKSPACE_ROOT,
    turbopack: { root: WORKSPACE_ROOT },
    poweredByHeader: false,
}

export default withNextIntl(nextConfig)
