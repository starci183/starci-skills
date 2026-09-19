import createNextIntlPlugin from 'next-intl/plugin';

/** The request config the plugin resolves a locale and a message catalogue from, per request. */
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @todo-app/grammar is a `file:` workspace package whose `main`/`exports` point straight at its own
  // TSX source (no build step of its own) - webpack does not transpile node_modules by default, so
  // without this the production build fails on its JSX/TS syntax. Pre-existing gap, unrelated to the
  // nivo-shape refactor; caught only now because this lane is the first to actually run `next build`.
  transpilePackages: ['@todo-app/grammar'],
};

export default withNextIntl(nextConfig);
