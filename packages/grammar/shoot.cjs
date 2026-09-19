const { chromium } = require('playwright');
const stories = ['sign-in-screen','tasks-screen','primitives','empty-state'];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const s of stories) {
    await page.goto(`http://localhost:6199/iframe.html?id=grammar-core-anatomy--${s}&viewMode=story`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `reference-renders/${s}.png`, fullPage: true });
    console.log('shot', s);
  }
  await browser.close();
})();
