// layout-render-page.mjs — one viewport capture of a served layout, with the page slot emptied and keyed #FF00FF.
//
// The browser is the runtime's own Playwright (the product ships none). A navigation that never settles is reported with
// the redirect chain it followed, so the Kernel sees the failing URL and the hops, not only "cannot render".
import { allocationMs } from '../../engine/config.mjs';

const SLOT_FILL = '#FF00FF';
const REDIRECT_STATUS_MIN = 300;
const REDIRECT_STATUS_MAX = 399;

/** A render that could not be produced: `cause` is the typed reason, `detail` carries the URL and the redirect chain. */
export class RenderRefusal extends Error {
  constructor(cause, message, detail = {}) {
    super(message);
    this.cause = cause;
    this.detail = detail;
  }
}

/** Empty and key the page slot in the page itself: its children hidden, its box filled. Returns how many elements matched. */
function keySlotInPage({ selector, fill }) {
  const matches = document.querySelectorAll(selector);
  if (matches.length !== 1) return matches.length;
  for (const overlay of document.querySelectorAll('nextjs-portal')) overlay.remove();
  const slot = matches[0];
  for (const child of slot.children) child.style.visibility = 'hidden';
  slot.style.backgroundColor = fill;
  slot.style.backgroundImage = 'none';
  slot.style.color = fill;
  return 1;
}

const isRedirect = (response) => response.status() >= REDIRECT_STATUS_MIN && response.status() <= REDIRECT_STATUS_MAX;

/** Record every redirect answer of the page's document requests into `chain`. */
const followRedirects = (page, chain) => {
  page.on('response', (response) => {
    if (!isRedirect(response) || response.request().resourceType() !== 'document') return;
    chain.push({ status: response.status(), url: response.url(), location: response.headers().location ?? null });
  });
};

async function openPage(browser, { viewport, theme }) {
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1 });
  return context.newPage();
}

async function navigate(page, url, chain) {
  try {
    return await page.goto(url, { waitUntil: 'load', timeout: allocationMs('layoutRender.navigateMs') });
  } catch (error) {
    throw new RenderRefusal(chain.length ? 'redirect-loop' : 'navigation-failed', `${url}: ${String(error.message).split('\n')[0]}`, { url, redirects: chain.slice(0, 8) });
  }
}

const refuseStatus = (response, url, chain) => {
  if (response?.status() < REDIRECT_STATUS_MIN) return;
  throw new RenderRefusal('bad-status', `${url}: the layout answered ${response ? response.status() : 'nothing'}`, { url, status: response?.status() ?? null, redirects: chain.slice(0, 8) });
};

/** Capture `url` at `viewport` (a PNG buffer): the slot matched by `slot` is the one element keyed with SLOT_FILL. */
export async function captureViewport({ chromium, url, viewport, theme, slot }) {
  const browser = await chromium.launch().catch((error) => {
    throw new RenderRefusal('browser-unavailable', `chromium did not launch: ${String(error.message).split('\n')[0]}`, { url });
  });
  try {
    const page = await openPage(browser, { viewport, theme });
    const chain = [];
    followRedirects(page, chain);
    refuseStatus(await navigate(page, url, chain), url, chain);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(allocationMs('layoutRender.settleMs'));
    const matched = await page.evaluate(keySlotInPage, { selector: slot, fill: SLOT_FILL });
    if (matched !== 1) throw new RenderRefusal('slot-not-found', `${url}: the slot selector ${slot} matches ${matched} elements, it must match exactly one`, { url, slot, matched });
    return { png: await page.screenshot({ type: 'png' }), finalUrl: page.url() };
  } finally {
    await browser.close();
  }
}
