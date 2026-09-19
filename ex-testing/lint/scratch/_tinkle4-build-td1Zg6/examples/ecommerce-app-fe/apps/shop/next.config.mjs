import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

// One request config serves the whole product: the shared module in `packages/shared/` holds the
// single source of messages both apps consume, so the plugin points at it rather than a per-app copy.
const withNextIntl = createNextIntlPlugin('../../packages/shared/src/i18n/request.ts');

// fe-kit and packages/shared compile from SOURCE through the @fe-kit/* and @shared/* aliases, so
// their bare peer imports walk node_modules upward from .claude/packages/ - landing on whichever
// junction link-peers pointed at, NOT this app's copies. A second real react splits the hook
// dispatcher and a second next-intl splits the intl context ("No intl context found"), so the
// bundler looks in THIS app's node_modules first for every bare import - the dedupe fe-kit's
// link-peers script documents as the consumer's half of the contract. resolve.modules keeps
// package exports maps intact, unlike an alias to a package directory.
const APP_NODE_MODULES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'node_modules');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This repo sits inside the host's pnpm tree, so Next's lockfile scan would climb past it and
  // trace against the wrong root ("Cannot find module for page: /_document"). Pin the real one.
  outputFileTracingRoot: join(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  webpack: (config) => {
    config.resolve.modules = [APP_NODE_MODULES, ...(config.resolve.modules ?? ['node_modules'])];
    return config;
  },
};

export default withNextIntl(nextConfig);
