import nextra from 'nextra';

// Static export, because the site is served by GitHub Pages and has no server. The repository
// publishes one Pages site: the landing app sits at the root and this one is copied into /docs, so
// every route and asset is prefixed with basePath.
// Next's built-in i18n routing is incompatible with `output: 'export'`, so the Vietnamese tree is a
// plain sub-path (`/vi/...`) built from docs/vi/ rather than a Next locale; the navbar carries the
// switch. Everything else about the two trees is identical.
const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
  defaultShowCopyCode: true,
});

export default withNextra({
  // `_meta.js` files describe the sidebar; without narrowing the page extensions Next would also
  // export each of them as a route.
  pageExtensions: ['mdx', 'md', 'jsx', 'tsx'],
  basePath: '/docs',
  assetPrefix: '/docs',
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
});
