import createNextIntlPlugin from "next-intl/plugin"
import type { NextConfig } from "next"

/** The request config the plugin resolves a locale and a message catalogue from, per request. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

const nextConfig: NextConfig = {
    reactStrictMode: true,
}

export default withNextIntl(nextConfig)
