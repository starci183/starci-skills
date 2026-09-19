/**
 * One-shot render capture for `ui.identity.sign-in`: the served shop's anonymous /account surface
 * at the record's declared viewport, written as the `<screen>-<viewport>.png/.html` pair
 * `verify-render.mjs` checks. A fresh browser context carries no cookies, so this is the real
 * signed-out render - the auth split the direction drew, implemented.
 *
 * Usage (replayable, cwd = this repository, shop already serving):
 *   node captures/capture-sign-in.mjs [shopUrl]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPorts } from '../scripts/projection.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ports = readPorts();
const SHOP = process.argv[2] ?? process.env.NEXT_PUBLIC_SHOP_URL ?? `http://localhost:${ports.shop}`;

const repoPkg = path.resolve(here, '../package.json');
const require = createRequire(repoPkg);
const { chromium } = require('@playwright/test');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
await page.goto(`${SHOP}/en/account`, { waitUntil: 'networkidle' });
// The Next.js dev-tools overlay is build tooling, not product chrome; it is removed so the
// capture shows only the implemented surface.
await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((el) => el.remove()));
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: path.join(here, 'sign-in-desktop-1536x1024.png'), fullPage: true });
writeFileSync(path.join(here, 'sign-in-desktop-1536x1024.html'), await page.content());
console.log('captured sign-in-desktop-1536x1024.png');
await browser.close();
