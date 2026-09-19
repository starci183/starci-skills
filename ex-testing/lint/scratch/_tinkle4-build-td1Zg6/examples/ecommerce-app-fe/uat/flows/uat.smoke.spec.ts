import { test } from '@playwright/test';
import { ORDER_API_URL } from '../lib/run-context';
import { recordAssertion, walkStep } from '../lib/steps';

/**
 * uat.smoke.browse - this harness's own rig proof, NOT the `uat.checkout.place-order` walk.
 *
 * The spec exists to prove the ported run-writer rig end-to-end: one real browser visit against the
 * shop app's `/browse` route (the entry `uat.checkout.place-order` declares and the one shop route
 * already wired to a live service read - `apps/shop/src/app/[lang]/browse/page.tsx` renders
 * `BrowsePage`, which fetches `${ORDER_API_URL}/products` server-side on every request). Its run
 * lands under that record's node because that is where the surface it exercises is owned.
 *
 * It records what the catalogue surface actually settled as - product grid, genuine empty, the
 * unreachable-service block, or a route that errored before any of those could render - and never
 * upgrades the observation. `fr.checkout.place-order` itself stays `not-run`: the full order walk is
 * the real spec's job, not a smoke's.
 */
test.describe('uat.smoke.browse', () => {
  test('visits /browse and records which catalogue surface the app settled on', async ({ page }, testInfo) => {
    // next-intl middleware owns the locale segment: /browse redirects to /en/browse (default locale).
    // The response is the LAST of the redirect chain - its status is what the route actually served.
    const response = await page.goto('/browse', { waitUntil: 'domcontentloaded' });
    const status = response?.status() ?? 0;
    const finalUrl = page.url();

    await walkStep(page, testInfo, 'browse-route-resolves', async () => {
      // The SectionHeader renders in every settled state (ready, empty and failed all carry it), so a
      // level-1 "Browse" heading means the route really resolved - a bare error shell does not.
      const headingVisible = await page
        .getByRole('heading', { level: 1, name: 'Browse' })
        .isVisible()
        .catch(() => false);
      recordAssertion(testInfo, {
        id: 'smoke.browse.route-resolves',
        expected: 'yes',
        observed: status === 200 && headingVisible ? 'yes' : 'no',
        note: `GET /browse settled at ${finalUrl} with HTTP ${status}; ` +
          (headingVisible
            ? 'the browse screen heading rendered.'
            : 'no "Browse" heading was in the rendered page - the route never reached its own surface.'),
      });
    });

    await walkStep(page, testInfo, 'catalogue-surface', async () => {
      // The settled surface is chosen on the server before the page ships, so what is in the DOM now
      // is the truth: CatalogueTile renders each product name as a level-3 heading, while both the
      // "empty" and "unreachable" fallbacks come through StateBlock's data-component="EmptyNotice".
      const productCount = await page.getByRole('heading', { level: 3 }).count().catch(() => 0);
      const notice = page.locator('[data-component="EmptyNotice"]');
      const noticeText = (await notice.count().catch(() => 0)) > 0
        ? (await notice.first().innerText()).replace(/\s+/g, ' ').trim()
        : null;

      if (productCount > 0) {
        recordAssertion(testInfo, {
          id: 'smoke.browse.catalog-renders',
          expected: 'yes',
          observed: 'yes',
          note: `The catalogue grid rendered ${productCount} product tile(s) served by ${ORDER_API_URL}/products.`,
        });
      } else {
        recordAssertion(testInfo, {
          id: 'smoke.browse.catalog-renders',
          expected: 'yes',
          observed: 'no',
          note: noticeText !== null
            ? `No product tiles rendered; the settled surface was the state block: "${noticeText}".`
            : 'Neither the product grid nor a state block was in the rendered page; the route settled on an unrecognized surface.',
        });
      }

      recordAssertion(testInfo, {
        id: 'fr.checkout.place-order',
        expected: 'yes',
        observed: 'not-run',
        note: 'This smoke spec proves the harness loop only; the real place-order walk (sign-in, add to cart, confirm, replay, refusals, account read-back) belongs to the flow\'s own spec.',
      });
    });
  });
});
