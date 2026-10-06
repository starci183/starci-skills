import fs from 'node:fs';

/**
 * Why a spec cannot drive a browser though Playwright resolves, or false when it can. `chromium` is Playwright's browser type: its
 * executable is a download that `npm ci --ignore-scripts` never makes, so a bare CI host has the package and no browser.
 */
export const chromiumGap = (chromium) => {
  try { return fs.existsSync(chromium.executablePath()) ? false : 'Playwright resolves but its Chromium download is absent (provide it: npx playwright install chromium)'; } catch (error) { return `Playwright cannot name its Chromium executable (${error.message}); provide it: npx playwright install chromium`; }
};
