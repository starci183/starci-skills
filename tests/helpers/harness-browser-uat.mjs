import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { canonical, regular, save, row } from './browser-proof-artifacts.mjs';
import { attachBrowserTelemetry } from './browser-telemetry.mjs';

const liveCases = [
  { key: 'overview', route: '#/', endpoints: ['/api/workers', '/api/health'] },
  { key: 'engine', route: '#/system/engine', endpoints: ['/api/reconciler', '/api/health'] },
  { key: 'resources', route: '#/system/resources', endpoints: ['/api/resources', '/api/host'] },
  { key: 'services', route: '#/system/services', endpoints: ['/api/services', '/api/seats', '/api/terminals'] },
  { key: 'cleanup', route: '#/system/cleanup', endpoints: ['/api/gc/runs', '/api/leaks'] },
  { key: 'integration', route: '#/system/land', endpoints: ['/api/land', '/api/lanes'] },
];
const fixtureCases = [
  { key: 'checkpoint-products', id: 9, verdict: 'pass', status: 'success', label: 'New runtime commit' },
  { key: 'checkpoint-reused', id: 5, verdict: 'pass', status: 'success', label: 'No new commit; recorded SHA reused' },
  { key: 'failed-preserved', id: 1, verdict: 'fail', status: 'unknown', label: 'Checkpoint receipt not confirmed' },
  { key: 'blocked', id: 4, verdict: 'blocked', status: 'unknown', label: 'Checkpoint receipt not confirmed' },
].map(c => ({ ...c, route: `#/a/shop/${c.id}?step=commit`, endpoints: [`/api/attempts/shop/${c.id}`] }));
const variants = [{ width: 1440, height: 1000 }, { width: 375, height: 900 }];
/** Completeness for both canonical phases; counts require finalized native artifacts and separate caller custody. */
export const captureContract = Object.freeze({ screenshots: 40, interactions: 4, traces: 8, videos: 8 });

/**
 * Require complete, unique, nonempty raw media declarations from both phases.
 * The caller must still compare every row with finalized files and verify native execution and Source custody.
 */
export function assertHarnessCapture(report) {
  for (const field of ['captures', 'interactions', 'traces', 'videos']) assert(Array.isArray(report[field]), `Capture collection required: ${field}`);
  assert.equal(report.captures.length, (liveCases.length + fixtureCases.length) * 4);
  assert.equal(report.captures.length, captureContract.screenshots);
  assert.equal(report.interactions.length, captureContract.interactions);
  assert.equal(report.traces.length, captureContract.traces);
  assert.equal(report.videos.length, captureContract.videos);
  const paths = new Set();
  for (const media of [...report.captures.map(capture => capture.file), ...report.traces, ...report.videos]) {
    assert(media && typeof media.path === 'string' && path.isAbsolute(media.path), 'Absolute media path required');
    assert(Number.isSafeInteger(media.bytes) && media.bytes > 0, 'Finalized media must be nonempty');
    assert(typeof media.sha256 === 'string' && /^[0-9a-f]{64}$/.test(media.sha256), 'Raw media SHA256 required');
    const key = canonical(media.path);
    assert(!paths.has(key), 'Media paths must be unique across captures, traces and videos');
    paths.add(key);
  }
}

async function apiRead(context, origin, endpoint, dir, name, report, privateData) {
  const response = await context.request.get(`${origin}${endpoint}`, { headers: { 'cache-control': 'no-cache' } });
  const bytes = await response.body();
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, bytes);
  const evidence = { endpoint, status: response.status(), headers: response.headers(), body: row(file), privateData };
  report.apiReads.push(evidence);
  assert.equal(response.status(), 200, `${endpoint}: ${bytes.toString().slice(0, 300)}`);
  const payload = JSON.parse(bytes);
  assert(Object.hasOwn(payload, 'data') && payload.meta && Array.isArray(payload.meta.sources), `Read envelope missing: ${endpoint}`);
  if (privateData) {
    assert.equal(payload.meta.stale?.length ?? 0, 0, `Private fixture unavailable: ${endpoint}`);
    assert(!payload.meta.sources.some(s => s.availability && s.availability !== 'available'));
  }
  evidence.meta = payload.meta;
  return payload;
}
async function nativePrivate(context, origin, sample, dir, name, report, fixture, products) {
  const payload = await apiRead(context, origin, sample.endpoints[0], dir, name, report, true);
  const a = payload.data;
  assert.equal(a.id, sample.id); assert.equal(a.project, 'shop'); assert.equal(a.wf, 'wf-stuck');
  assert.equal(a.verdict, sample.verdict); assert.equal(a.land, null, 'Checkpoint does not establish integration');
  if (sample.id === 9) {
    assert.equal(a.job, products.jobId); assert.equal(a.unit, products.unitId);
    assert.equal(a.report.json.head, products.reportHead);
    assert.equal(a.checkpoint.sha, products.checkpointHead); assert.equal(a.checkpoint.committed, true);
    assert.notEqual(a.checkpoint.sha, a.report.json.head);
    const p = (await apiRead(context, origin, '/api/attempts/shop/9/products', dir, `${name}-products`, report, true)).data;
    assert.equal(p.headSource, 'runtime-checkpoint'); assert.equal(p.head, products.checkpointHead);
    assert.equal(p.parent, products.reportHead); assert.equal(p.reportHead, products.reportHead);
    assert.equal(p.error, null); assert.equal(p.errorCode, null);
    assert.equal(p.scope.truncated, false); assert.equal(p.scope.returned, products.files.length);
    assert.deepEqual(new Set(p.files.map(f => f.path)), new Set(products.files));
    assert.equal(canonical(p.repo), canonical(products.repoRoot));
    assert(fixture.productRoots.some(root => canonical(root) === canonical(p.repo)));
    assert.equal(fs.readFileSync(regular(path.join(p.repo, products.workingCopy.path)), 'utf8'), products.workingCopy.content);
    for (const f of p.files) {
      assert.equal(f.content, products.committed[f.path]); assert.equal(f.error, null);
      assert(!f.content?.includes(products.workingCopy.content.trim()) && !f.diff?.includes(products.workingCopy.content.trim()));
    }
  } else if (sample.id === 5) {
    assert.equal(a.job, 'job-unchanged'); assert.equal(a.checkpoint.committed, false);
    assert.equal(a.checkpoint.sha, a.report.json.head);
    assert.deepEqual(a.checkpoint.scope, ['be/source']); assert.deepEqual(a.checkpoint.files, []);
  } else {
    assert.equal(a.checkpoint, null, 'Failure/preservation/blocked verdict does not create a checkpoint');
    if (sample.id === 1) {
      const events = await apiRead(context, origin, '/api/timeline?project=shop&wf=wf-stuck&sources=event&limit=200', dir, `${name}-timeline`, report, true);
      assert.equal(events.meta.next ?? null, null);
      assert(events.data.some(event => event.kind === 'workflow-op-preserved'));
    }
  }
  if (a.checkpoint) {
    assert(a.checkpoint.at >= a.dispatchedAt);
    if (a.settledAt != null) assert(a.checkpoint.at <= a.settledAt);
  }
  return a;
}
async function checkpointDom(page, sample, attempt, t) {
  const section = page.locator('#attempt-step-commit');
  await section.waitFor(); assert.equal(await section.count(), 1);
  assert(await page.locator('#attempt-result').evaluate(e => e.contains(document.getElementById('attempt-step-commit'))));
  const chip = section.locator('[data-status]'); assert.equal(await chip.count(), 1);
  assert.equal(await chip.getAttribute('data-status'), sample.status);
  assert.equal((await chip.innerText()).trim(), t(sample.label));
  const checkpoint = section.getByText(t('Checkpoint SHA'), { exact: true }).locator('..').locator('dd code');
  if (attempt.checkpoint) assert.equal(await checkpoint.getAttribute('title'), attempt.checkpoint.sha);
  else assert.equal(await checkpoint.count(), 0);
  const tested = section.getByText(t('HEAD tested by the Op'), { exact: true }).locator('..').locator('dd code');
  if (attempt.report?.json?.head) assert.equal(await tested.getAttribute('title'), attempt.report.json.head);
  else assert.equal(await tested.count(), 0);
  if (attempt.checkpoint) {
    const disclosure = section.locator('details');
    if (!(await disclosure.evaluate(e => e.open))) { await disclosure.locator('summary').focus(); await page.keyboard.press('Enter'); }
    assert.equal(await disclosure.evaluate(e => e.open), true);
    for (const [label, values] of [['Recorded owned paths', attempt.checkpoint.scope], ['Files recorded by the checkpoint', attempt.checkpoint.files]]) {
      const value = disclosure.getByText(t(label), { exact: true }).locator('..').locator('dd');
      if (values == null) assert.equal((await value.innerText()).trim(), t('Not recorded'));
      else if (!values.length) assert.equal((await value.innerText()).trim(), t('Recorded empty list'));
      else assert.deepEqual(await value.locator('li').allTextContents(), values);
    }
  } else await section.getByText(t('The verdict does not establish a checkpoint receipt.'), { exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: t('Recorded attempt milestones'), exact: true });
  assert.equal(await nav.locator('button').count(), 7);
  assert.equal(await nav.locator('button').nth(4).getAttribute('aria-current'), 'location');
  assert.equal(await nav.locator('button').nth(6).getAttribute('data-state'), 'unknown');
  return nav;
}
async function productsDom(page, attempt, t) {
  const card = page.locator('#attempt-products');
  await card.getByText(t('Content source: recorded runtime checkpoint'), { exact: false }).waitFor();
  const trigger = card.locator('button[data-slot="collapsible-trigger"]');
  assert.equal(await trigger.count(), 1);
  if (await trigger.getAttribute('aria-expanded') !== 'true') {
    await trigger.focus(); await page.keyboard.press('Enter');
  }
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  await card.locator(`code[title="${attempt.checkpoint.sha}"]`).waitFor();
  await card.locator(`code[title="${attempt.report.json.head}"]`).waitFor();
}
async function refreshUat(page, telemetry, origin, sample, attempt, report, t, facts) {
  const endpoint = `${origin}${sample.endpoints[0]}`;
  const message = 'Explicit final Source UI cached-refresh UAT';
  let calls = 0;
  // Inject only this private refresh fault; Retry returns to the real API.
  await page.route(endpoint, route => {
    calls++; telemetry.expectHttp(route.request(), 503, 'Explicit private cached-refresh presentation injection');
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UAT_REFRESH_UNAVAILABLE', message } }) });
  });
  try {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const warning = page.locator('[data-feedback="error"]').filter({ hasText: message });
    await warning.waitFor(); assert(calls > 0);
    await warning.getByText(t('Refresh failed; showing the last recorded snapshot.'), { exact: false }).waitFor();
    const nav = await checkpointDom(page, sample, attempt, t);
    await nav.locator('button').nth(4).focus(); await page.keyboard.press('Enter');
    assert.equal(await nav.locator('button').nth(4).getAttribute('aria-current'), 'location');
    await page.unroute(endpoint);
    await warning.getByRole('button').click(); await warning.waitFor({ state: 'hidden' });
    await checkpointDom(page, sample, attempt, t);
    report.interactions.push({ ...facts, kind: 'private-cached-refresh', injected: true, calls, retained: true, retryFromRealApi: true, keyboard: true });
  } finally { await page.unroute(endpoint); }
}
/**
 * Capture one canonical host or private-fixture phase using the caller's actual browser and preview.
 * Requires the selected Source/full revision, owned external directory, native fixture inputs and a live revision guard.
 * This function closes its contexts; the caller owns browser/server closure, native slot custody and final file verification.
 */
export async function capturePhase({ source, sourceSha, browser, origin, privateData, dir, report, fixture, products, t, guard }) {
  const owner = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  assert.equal(canonical(source), canonical(owner), 'Capture scenarios must load from the selected Source');
  assert(/^[0-9a-f]{40}$/.test(sourceSha), 'Full Source revision required');
  assert.equal(report.source, source); assert.equal(report.sourceSha, sourceSha);
  const output = canonical(dir), root = canonical(source);
  assert(output !== root && !output.startsWith(root + '/') && !root.startsWith(output + '/'), 'Capture output must be outside Source');
  assert(fs.lstatSync(dir).isDirectory() && !fs.lstatSync(dir).isSymbolicLink(), 'Explicit capture directory required');
  assert.equal(canonical(fs.realpathSync.native(dir)), output, 'Capture directory cannot redirect');
  const cases = privateData ? fixtureCases : liveCases;
  for (const viewport of variants) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', recordVideo: { dir: path.join(dir, 'videos') } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); page.setDefaultTimeout(15_000);
    await context.addInitScript(value => localStorage.setItem('starci-status-theme', value), theme);
    const telemetry = await attachBrowserTelemetry(page, report, { phase: privateData ? 'fixture' : 'observer', ...viewport, theme });
    const video = page.video();
    try {
      for (const sample of cases) {
        guard();
        const key = `${privateData ? 'fixture' : 'observer'}-${sample.key}-${viewport.width}-${theme}`;
        const facts = { key, route: sample.route, ...viewport, theme, privateData, injected: false };
        telemetry.setCase({ ...facts, case: key });
        const attempt = privateData ? await nativePrivate(context, origin, sample, dir, key, report, fixture, products) : null;
        if (!privateData) for (let i = 0; i < sample.endpoints.length; i++) await apiRead(context, origin, sample.endpoints[i], dir, `${key}-${i}`, report, false);
        await telemetry.goto(`${origin}/${sample.route}`);
        await page.locator('#main-content').waitFor();
        if (!privateData) {
          await page.getByRole('heading', { name: t(sample.key === 'overview' ? 'Overview' : 'System'), level: 1, exact: true }).waitFor();
          if (sample.key !== 'overview') {
            const selected = page.getByRole('navigation', { name: t('System sections'), exact: true }).locator('a[aria-current="page"]');
            assert.equal(await selected.getAttribute('href'), sample.route);
          }
        }
        await page.waitForFunction(metricsLabel => !document.querySelector('#main-content .page-skeleton')
          && ![...document.querySelectorAll('#main-content section[aria-label]')].some(e => e.getAttribute('aria-label') === metricsLabel), t('Worker metrics'));
        if (privateData) {
          await checkpointDom(page, sample, attempt, t);
          await telemetry.reload(); await checkpointDom(page, sample, attempt, t);
          if (sample.id === 9) await productsDom(page, attempt, t);
        }
        await page.waitForTimeout(600);
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
        const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light', main: Boolean(document.querySelector('main')), pendingSkeletons: document.querySelectorAll('#main-content .page-skeleton').length, feedback: [...document.querySelectorAll('#main-content [data-feedback]')].map(e => ({ state: e.getAttribute('data-feedback'), text: e.textContent })) }));
        assert(geometry.main && geometry.scrollWidth <= viewport.width + 1, `Overflow/missing main ${key}`);
        assert.equal(geometry.theme, theme); assert.equal(geometry.pendingSkeletons, 0);
        const file = path.join(dir, `${key}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const bytes = fs.readFileSync(file); assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
        report.captures.push({ ...facts, at: new Date().toISOString(), origin, file: row(file), geometry, png: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, actualUrl: page.url(), checkpoint: attempt?.checkpoint ?? null, verdict: attempt?.verdict ?? null });
        if (privateData && sample.id === 9) await refreshUat(page, telemetry, origin, sample, attempt, report, t, facts);
        assert.equal(telemetry.pageErrors.length, 0, `Page exception ${key}`);
        save(dir, 'progress.json', report);
      }
    } finally {
      const trace = path.join(dir, `${privateData ? 'fixture' : 'observer'}-${viewport.width}-${theme}.trace.zip`);
      // Finalize native recordings before pinning; declarations alone cannot complete the run.
      await context.tracing.stop({ path: trace });
      report.traces.push(row(trace));
      await telemetry.close(context);
      if (video) report.videos.push(row(await video.path()));
    }
  }
}
