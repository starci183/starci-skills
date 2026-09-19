/**
 * Running-page captures for the ecommerce-app-fe pair.
 *
 * Drives the real served builds of apps/landing and apps/shop and writes, beside this script, one
 * PNG plus the served markup per route and viewport - the same keep-markup-with-capture shape
 * schemas/work-layout.yaml's frontendCaptures note asks for, and the same replay shape
 * todo-app-backend's impl capture scripts use.
 *
 * What the captures actually show, honestly: the backend lane's services are NOT running in this
 * environment (no Docker daemon for the dev Postgres/Redis, and the BE repo is verify-only from
 * this lane), so /browse and /account render their designed unreachable states - the refusal text
 * names the projected service origin and the reason. /cart and /checkout render their genuine
 * empty states (mascot present, per the brand record's mayAppearIn). The landing renders fully -
 * it intentionally ships static copy so it works with no backend.
 *
 * Both apps are booted by scripts/serve.mjs, which reads their ports from the product's resolved
 * projection (../ecommerce-app-be/metadata.json) - so this script resolves the base URLs the same
 * way instead of restating them. NEXT_PUBLIC_* env vars still override, same precedence as the
 * apps' own config.
 *
 * Usage (replayable, cwd = this repository, both apps already serving):
 *   node captures/capture.mjs [landingUrl] [shopUrl]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPorts } from '../scripts/projection.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ports = readPorts();
const LANDING = process.argv[2] ?? process.env.NEXT_PUBLIC_LANDING_URL ?? `http://localhost:${ports.landing}`;
const SHOP = process.argv[3] ?? process.env.NEXT_PUBLIC_SHOP_URL ?? `http://localhost:${ports.shop}`;

const repoPkg = path.resolve(here, '../package.json');
const require = createRequire(repoPkg);
const { chromium } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const ROUTES = [
  { app: 'landing', base: LANDING, path: '/', name: 'landing' },
  { app: 'shop', base: SHOP, path: '/browse', name: 'browse' },
  { app: 'shop', base: SHOP, path: '/cart', name: 'cart' },
  { app: 'shop', base: SHOP, path: '/checkout', name: 'checkout' },
  { app: 'shop', base: SHOP, path: '/account', name: 'account' },
];

const shot = async (page, name, fullPage) => {
  // The Next.js dev-tools overlay is build tooling, not product chrome; it is removed so the
  // capture shows only the implemented surface.
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((el) => el.remove()));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(here, `${name}.png`), fullPage });
  writeFileSync(path.join(here, `${name}.html`), await page.content());
  console.log(`captured ${name}.png`);
};

for (const viewport of VIEWPORTS) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  for (const route of ROUTES) {
    const name = `${route.name}-${viewport.name}`;
    try {
      await page.goto(`${route.base}${route.path}`, { waitUntil: 'networkidle' });
      await shot(page, name, viewport.name === 'desktop');
    } catch (error) {
      console.error(`capture ${name} failed:`, error);
      process.exitCode = 1;
    }
  }
  await browser.close();
}
