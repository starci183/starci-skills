/**
 * Lane v7-10 harness: boot one ecommerce-app-be service from its compiled output.
 *
 * `npm run start:identity` / `start:order` fail on this checkout with
 * `Cannot find module '@modules/platform/config/identity/config.module'`: tsconfig-paths/register reads
 * tsconfig.json, whose baseUrl is the repository root and whose `@modules/*` maps to `./src/modules/*` —
 * TypeScript source, while `npm run build` (tsconfig.build.json, rootDir ".") emits to `dist/src/modules/*`.
 * This harness re-registers the same map against `dist` so the boot can be exercised at all, without
 * touching product source. argv[2] selects the app.
 */
const path = require('node:path');
const {register} = require('tsconfig-paths');

const app = process.argv[2];
if (!['identity', 'order'].includes(app)) {
  console.error('usage: node v7-10-be-launch.cjs <identity|order>');
  process.exit(2);
}
const repoRoot = path.resolve(__dirname, '../../../examples/ecommerce-app-be');
process.chdir(repoRoot);
register({
  baseUrl: path.join(repoRoot, 'dist'),
  paths: {
    '@modules/*': ['src/modules/*'],
    '@features/*': ['src/features/*'],
    '@tests/*': ['src/tests/*'],
  },
});
require(path.join(repoRoot, 'dist', 'apps', app, 'src', 'main.js'));
