import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import createNextIntlPlugin from "next-intl/plugin"

// The request config lives in this app's i18n module; next-intl compiles it from source.
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

// fe-kit compiles from source and shared is built in this workspace, so
// their bare peer imports walk node_modules upward from .claude/packages/ - landing on whichever
// junction link-peers pointed at, NOT this app's copies. A second real react splits the hook
// dispatcher and a second next-intl splits the intl context ("No intl context found"), so the
// bundler looks in THIS app's node_modules first for every bare import - the dedupe fe-kit's
// link-peers script documents as the consumer's half of the contract. resolve.modules keeps
// package exports maps intact, unlike an alias to a package directory.
const APP_NODE_MODULES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "node_modules")

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config) => {
        config.resolve.modules = [APP_NODE_MODULES, ...(config.resolve.modules ?? ["node_modules"])]
        return config
    },
}

export default withNextIntl(nextConfig)
