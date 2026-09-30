import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** Next config of the {{app}} app: next-intl wired to the request config, Turbopack rooted at the repository. */
const nextConfig: NextConfig = {
    turbopack: { root: process.cwd() },
}

export default withNextIntl(nextConfig)
