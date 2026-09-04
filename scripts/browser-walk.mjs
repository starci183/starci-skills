// @tools/browsercontrol, mode playwright — the runner of a declarative walk (templates/kinds/uat-walk.schema.json).
//
//   node scripts/browser-walk.mjs <walk.json> <response dir> [--host-root <dir>]
//
// The agent writes the walk; this script executes it and writes what a receipt can be checked against.
// Playwright and Chromium are installed once at the host, outside the tree, where resources/tools.json
// → browsercontrol.install says (the parent of the runtime, scripts/validate-request.mjs#hostRootOf);
// a missing install exits with the wording environment.preflight reports for host.playwright, and
// nothing is installed here. Chromium runs headless in one fresh context per run — the walk's own
// storage, viewport, deviceScaleFactor, colorScheme, reducedMotion and locale, never a person's profile.
// Steps run in order; every locator is getByRole over the walk's target and nothing else; the first
// failed step ends the run — nothing is retried and no locator is guessed. A credential is resolved by
// name from the sealed reference the walk's account declares, at the fill and nowhere else: it reaches
// the form field, is masked in every screenshot, and is refused from every file this runner writes.
// Under <response dir> it writes data/walks/<id>/{walk.json, walk-result.json, capture.json, trace.zip},
// artifacts/<name>.{png,ax.txt,dom.json} per capture, and for a UAT walk data/captures/<case>.json in
// the uat-capture shape with every control copied from the walk.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { hostRootOf } from './validate-request.mjs';
import { walkErrors, sweepWalkText, sweepFindingErrors, walkFingerprint, originOf, isCredential, walkFiles, stepControl, controlString, controlOfStep } from './validate-walk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHECK_ID = 'host.playwright';
const DEFAULT_TIMEOUT = 10000;

// Where the host keeps its one Playwright: read from the tool registry, never spelled here.
export function playwrightInstallOf(hostRoot, root = ROOT) {
  const tools = JSON.parse(readFileSync(path.join(root, 'resources', 'tools.json'), 'utf8'));
  const install = tools.tools?.browsercontrol?.install ?? {};
  const dir = path.resolve(hostRoot, install.path ?? '.tools/playwright');
  return { root: dir, browsers: path.resolve(hostRoot, install.browsersPath ?? '.tools/playwright/browsers'), module: path.join(dir, 'node_modules', 'playwright', 'package.json'), command: install.command ?? 'npm init -y && npm i playwright && npx playwright install chromium' };
}
// Present when the package resolves under the install and a Chromium sits under its browsers path.
export function playwrightInstallStatus(hostRoot, root = ROOT) {
  const install = playwrightInstallOf(hostRoot, root);
  const modulePresent = existsSync(install.module);
  let chromium = false;
  try { chromium = readdirSync(install.browsers).some((name) => /^chromium/.test(name)); } catch { chromium = false; }
  return { ...install, modulePresent, chromium, present: modulePresent && chromium };
}
// The one wording of the wall, shared by the preflight report and this runner's exit.
export function missingInstallMessage(hostRoot, root = ROOT) {
  const install = playwrightInstallOf(hostRoot, root);
  return `${CHECK_ID}: no Playwright install at ${install.root}; install once at the host, outside the tree: mkdir -p ${install.root} && cd ${install.root} && PLAYWRIGHT_BROWSERS_PATH=${install.browsers} ${install.command}`;
}
export function loadPlaywright(hostRoot, root = ROOT) {
  const status = playwrightInstallStatus(hostRoot, root);
  if (!status.present) throw Object.assign(new Error(missingInstallMessage(hostRoot, root)), { code: 'PLAYWRIGHT_MISSING' });
  process.env.PLAYWRIGHT_BROWSERS_PATH = status.browsers;
  const require = createRequire(path.join(status.root, 'package.json'));
  return { playwright: require('playwright'), version: JSON.parse(readFileSync(status.module, 'utf8')).version };
}

// The sealed shared password, resolved the way the identity runner resolves it: SOPS with the host's
// master identity, at the moment of the fill. The value is returned to the caller and to nothing else.
export function resolveCredential(hostRoot, credentialRef) {
  if (!/^\.stacks\/[a-z0-9][a-z0-9-]*\/secrets\/uat\.enc$/.test(credentialRef)) throw new Error('credential reference is not a sealed UAT file');
  const deviceState = JSON.parse(readFileSync(path.join(hostRoot, '.workspaces', 'device-state.json'), 'utf8'));
  const masterRef = deviceState.encryption?.masterIdentity;
  if (typeof masterRef !== 'string') throw new Error('device-state declares no master identity');
  const masterFile = masterRef.startsWith('~/') ? path.join(os.homedir(), masterRef.slice(2)) : path.resolve(hostRoot, masterRef);
  const value = execFileSync('sops', ['--decrypt', '--input-type', 'binary', '--output-type', 'binary', path.resolve(hostRoot, credentialRef)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, SOPS_AGE_KEY_FILE: masterFile } }).trim();
  if (!value) throw new Error('the sealed credential resolved to nothing');
  return value;
}

const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeout, label) {
  const until = Date.now() + timeout;
  let last = null;
  for (;;) {
    try { const r = await fn(); if (r.ok) return r; last = r.detail; } catch (e) { last = e.message; }
    if (Date.now() >= until) throw new Error(`${label} not observed within ${timeout}ms${last ? ` (last: ${String(last).slice(0, 120)})` : ''}`);
    await sleep(100);
  }
}
const describeExpect = (expect) => Object.entries(expect).map(([k, v]) => (v === true ? k : `${k} ${JSON.stringify(v)}`)).join(', ');
// An error message that names no resolved value and fits a result: first line, redacted, bounded.
function scrub(message, secrets) {
  let text = String(message ?? 'failed').split(/\r?\n/)[0];
  for (const s of secrets) if (s && text.includes(s)) text = text.split(s).join('[redacted]');
  return text.slice(0, 380) || 'failed';
}
function refuseLeak(text, secrets, what) {
  for (const s of secrets) if (s && s.length >= 4 && String(text).includes(s)) throw Object.assign(new Error(`OUTPUT_SECRET_DETECTED in ${what}; nothing was written`), { code: 'OUTPUT_SECRET_DETECTED' });
  return text;
}
const locatorOf = (page, target) => { let l = page.getByRole(target.role, { name: target.name, exact: target.exact ?? false }); if (target.nth !== undefined) l = l.nth(target.nth); return l; };

export async function runWalk(walkFile, responseDir, { hostRoot = hostRootOf(ROOT), root = ROOT, log = () => {} } = {}) {
  const bytes = readFileSync(walkFile);
  const text = bytes.toString('utf8');
  let walk; try { walk = JSON.parse(text); } catch (e) { return { code: 2, errors: [`${walkFile}: ${e.message}`] }; }
  const errors = [...walkErrors(walk, { root, at: path.basename(walkFile) }), ...sweepFindingErrors(sweepWalkText(text, originOf(walk?.entry?.route), { file: path.basename(walkFile) }))];
  if (errors.length) return { code: 2, errors };
  const files = walkFiles(walk.id);
  // Every ref the receipt carries is branch-relative (response/…); <response dir> is that folder.
  const under = (ref) => path.join(responseDir, ref.replace(/^response\//, ''));
  const walkDir = path.join(responseDir, 'data', 'walks', walk.id);
  if (existsSync(under(files.result))) return { code: 2, errors: [`${files.result}: a result already exists; a walk is run once, and a second attempt is a new walk id`] };
  let loaded; try { loaded = loadPlaywright(hostRoot, root); } catch (e) { return { code: 3, errors: [e.message] }; }
  const { playwright, version } = loaded;

  mkdirSync(walkDir, { recursive: true });
  mkdirSync(path.join(responseDir, 'artifacts'), { recursive: true });
  mkdirSync(path.join(responseDir, 'data', 'captures'), { recursive: true });
  writeFileSync(under(files.walk), bytes);

  const timeout = walk.entry.stepTimeoutMs ?? DEFAULT_TIMEOUT;
  const secrets = [];
  const maskTargets = [];
  const ledger = [];
  const captures = [];
  const startedAt = now();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: walk.entry.viewport.width, height: walk.entry.viewport.height },
    deviceScaleFactor: walk.entry.viewport.deviceScaleFactor,
    colorScheme: walk.entry.colorScheme,
    reducedMotion: walk.entry.reducedMotion,
    locale: walk.entry.locale,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  let firstFailure = null;

  const capture = async (name, step, { fullPage = false } = {}) => {
    const shot = path.join(responseDir, 'artifacts', `${name}.png`);
    await page.screenshot({ path: shot, fullPage, mask: maskTargets.map((t) => locatorOf(page, t)) });
    let ax;
    try { ax = await page.locator('body').ariaSnapshot(); } catch { ax = JSON.stringify(await page.accessibility.snapshot(), null, 2); }
    const dom = JSON.stringify({ url: page.url(), title: await page.title(), html: await page.content() }, null, 2);
    writeFileSync(path.join(responseDir, 'artifacts', `${name}.ax.txt`), refuseLeak(ax, secrets, `${name}.ax.txt`));
    writeFileSync(path.join(responseDir, 'artifacts', `${name}.dom.json`), refuseLeak(dom, secrets, `${name}.dom.json`));
    const record = { name, stepId: step.id, screenshotRef: `response/artifacts/${name}.png`, axRef: `response/artifacts/${name}.ax.txt`, domRef: `response/artifacts/${name}.dom.json` };
    captures.push(record);
    return record;
  };

  const run = async (step) => {
    const target = step.target ? locatorOf(page, step.target) : null;
    switch (step.action) {
      case 'goto': await page.goto(walk.entry.route, { waitUntil: 'load', timeout }); return 'navigated to the entry route';
      case 'click': await target.click({ timeout }); return 'clicked';
      case 'fill': {
        let value = step.value;
        if (isCredential(value)) {
          let resolved; try { resolved = resolveCredential(hostRoot, walk.account.credentialRef); } catch (e) { throw new Error(`credential ${value.credential} could not be resolved by name from ${walk.account.credentialRef}: ${scrub(e.message, secrets)}`); }
          secrets.push(resolved); maskTargets.push(step.target); value = resolved;
          await target.fill(value, { timeout });
          return `filled credential ${step.value.credential} by name`;
        }
        await target.fill(value, { timeout }); return 'filled';
      }
      case 'press': if (target) await target.press(step.value, { timeout }); else await page.keyboard.press(step.value); return `pressed ${step.value}`;
      case 'select': await target.selectOption(step.value, { timeout }); return `selected ${JSON.stringify(step.value)}`;
      case 'check': if (step.value === false) await target.uncheck({ timeout }); else await target.check({ timeout }); return step.value === false ? 'unchecked' : 'checked';
      case 'wait': if (target) await target.waitFor({ state: 'visible', timeout }); else await sleep(step.value); return target ? 'visible' : `waited ${step.value}ms`;
      case 'capture': await capture(step.capture.name, step, { fullPage: step.capture.fullPage ?? false }); return `captured ${step.capture.name}`;
      case 'expect': {
        const e = step.expect;
        if (e.visible) await target.waitFor({ state: 'visible', timeout });
        if (e.hidden) await target.waitFor({ state: 'hidden', timeout });
        if (e.url !== undefined) await poll(async () => { const p = new URL(page.url()).pathname; return { ok: p === e.url, detail: p }; }, timeout, `url ${e.url}`);
        if (e.text !== undefined) await poll(async () => { const t = (await target.textContent()) ?? ''; return { ok: t.includes(e.text), detail: t.trim().slice(0, 80) }; }, timeout, `text ${JSON.stringify(e.text)}`);
        if (e.count !== undefined) await poll(async () => { const c = await target.count(); return { ok: c === e.count, detail: c }; }, timeout, `count ${e.count}`);
        if (e.attribute) await poll(async () => { const v = await target.getAttribute(e.attribute.name); return { ok: v === e.attribute.value, detail: v }; }, timeout, `attribute ${e.attribute.name}`);
        if (e.checked !== undefined) await poll(async () => { const c = await target.isChecked(); return { ok: c === e.checked, detail: c }; }, timeout, `checked ${e.checked}`);
        if (e.value !== undefined) await poll(async () => { const v = await target.inputValue(); return { ok: v === e.value, detail: v.length }; }, timeout, `value`);
        return `observed ${describeExpect(e)}`;
      }
      default: throw new Error(`unknown action ${step.action}`);
    }
  };

  try {
    for (const step of walk.steps) {
      const control = stepControl(walk, step.id);
      if (firstFailure) { ledger.push({ id: step.id, action: step.action, control, outcome: 'skipped', url: null, startedAt: null, ms: 0 }); continue; }
      const t0 = Date.now();
      const stepStart = now();
      let outcome = 'pass'; let observed;
      try { observed = await run(step); }
      catch (e) {
        outcome = 'fail';
        observed = scrub(e.message, secrets);
        firstFailure = { stepId: step.id, message: observed };
        // Evidence of the failure: the frame at the moment the walk stopped, for the case it stood in.
        const caseId = step.assertion?.caseId;
        if (caseId && !captures.some((c) => c.name === caseId)) { try { await capture(caseId, step); } catch { /* the frame is the evidence that was lost */ } }
      }
      const url = page.isClosed() ? null : page.url();
      ledger.push({ id: step.id, action: step.action, control, outcome, url, startedAt: stepStart, ms: Date.now() - t0, observed });
      log(`${outcome === 'pass' ? 'ok  ' : 'FAIL'} ${step.id} ${step.action} ${control ?? ''} — ${observed}`);
    }
  } finally {
    try { await context.tracing.stop({ path: under(files.trace) }); } catch { /* the trace is a convenience */ }
    await context.close();
    await browser.close();
  }
  const finishedAt = now();

  // What the receipt is checked against. The ledger carries every step with its control; the result
  // carries pass or fail per step and the first failure; a UAT walk also yields one uat-capture per
  // frozen case, every control copied from the walk step that produced the assertion.
  const ledgerDoc = { schemaVersion: 9, walkRef: files.walk, steps: ledger };
  writeFileSync(under(files.ledger), refuseLeak(`${JSON.stringify(ledgerDoc, null, 2)}\n`, secrets, 'capture.json'));
  const result = {
    schemaVersion: 9, mode: 'playwright', walkRef: files.walk, walkFingerprint: walkFingerprint(bytes), route: walk.entry.route,
    outcome: firstFailure ? 'fail' : 'pass', startedAt, finishedAt,
    driver: { playwright: version, browser: 'chromium', browserVersion: browser.version(), headless: true, context: { fresh: true, viewport: [walk.entry.viewport.width, walk.entry.viewport.height], deviceScaleFactor: walk.entry.viewport.deviceScaleFactor, colorScheme: walk.entry.colorScheme, reducedMotion: walk.entry.reducedMotion, locale: walk.entry.locale } },
    steps: ledger.map(({ id, action, control, outcome, url, ms }) => ({ id, action, control, outcome, url, ms })),
    firstFailure, captures, traceRef: files.trace, ledgerRef: files.ledger,
  };
  writeFileSync(under(files.result), refuseLeak(`${JSON.stringify(result, null, 2)}\n`, secrets, 'walk-result.json'));
  const uatCaptures = [];
  for (const c of walk.run?.cases ?? []) {
    const steps = walk.steps.filter((s) => s.assertion?.caseId === c.caseId);
    const entries = steps.map((s) => ({ step: s, row: ledger.find((l) => l.id === s.id) }));
    if (entries.every(({ row }) => row.outcome === 'skipped')) continue;
    const shot = captures.find((x) => x.name === c.caseId);
    if (!shot) continue;
    const assertions = entries.filter(({ row }) => row.outcome !== 'skipped').map(({ step, row }) => ({
      assertionId: step.assertion.assertionId, lane: step.assertion.lane,
      observed: `${controlString(controlOfStep(walk, step.id))}: ${row.observed}`,
      control: stepControl(walk, step.id), evidenceRef: shot.screenshotRef, outcome: row.outcome, stepId: step.id,
    }));
    if (!assertions.length) continue;
    const doc = {
      caseId: c.caseId, runId: walk.run.runId, order: c.order, executedAt: entries.find(({ row }) => row.startedAt)?.row.startedAt ?? startedAt,
      screenshotRef: shot.screenshotRef, loginFieldMasked: true, captureStartedAfterRedirect: true,
      outcome: assertions.every((a) => a.outcome === 'pass') && entries.length === assertions.length ? 'pass' : 'fail',
      driver: { mode: 'playwright', walkRef: files.walk, resultRef: files.result },
      assertions,
    };
    const file = `response/data/captures/${c.caseId}.json`;
    writeFileSync(path.join(responseDir, 'data', 'captures', `${c.caseId}.json`), refuseLeak(`${JSON.stringify(doc, null, 2)}\n`, secrets, file));
    uatCaptures.push(file);
  }
  return { code: firstFailure ? 1 : 0, errors: [], result, files: { ...files, captures: uatCaptures } };
}

function parseArgs(argv) {
  const out = { walk: null, out: null, hostRoot: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--host-root') out.hostRoot = path.resolve(argv[++i]);
    else if (!out.walk) out.walk = path.resolve(a);
    else if (!out.out) out.out = path.resolve(a);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.walk || !opts.out) { process.stderr.write('usage: node scripts/browser-walk.mjs <walk.json> <response dir> [--host-root <dir>]\n'); process.exit(2); }
  const { code, errors, result } = await runWalk(opts.walk, opts.out, { hostRoot: opts.hostRoot ?? hostRootOf(ROOT), log: (line) => process.stdout.write(`${line}\n`) });
  if (errors.length) process.stderr.write(`${errors.join('\n')}\n`);
  else process.stdout.write(`${result.outcome}: ${result.steps.filter((s) => s.outcome === 'pass').length}/${result.steps.length} steps, ${result.captures.length} capture(s), ${result.walkRef}\n`);
  process.exitCode = code;
}
