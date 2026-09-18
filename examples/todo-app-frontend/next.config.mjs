/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `.npmrc`'s `install-links=true` copies the local `@todo-app/grammar` workspace package into
  // node_modules as raw `.tsx` instead of symlinking it; webpack refuses to parse that TSX unless the
  // package is named here so Next applies its own transform to it like any other first-party source.
  transpilePackages: ['@todo-app/grammar'],
};

export default nextConfig;
