// The declarative walk: its gate (scripts/validate-walk.mjs) and its sweep on synthetic walks, which
// need no browser; the host install status the preflight and the runner share; and the runner itself
// (scripts/browser-walk.mjs), proved by one real run against a static page served on the loopback
// interface by scripts/host-artifacts.mjs — skipped, with the runner's own wording as the reason, when
// the host carries no Playwright install. Nothing here fakes a browser.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { walkErrors, sweepWalkText, sweepWalkRun, sweepFindingErrors, originOf, stepControl, stepOwnControl, controlOfStep, citedMeasurement, loadMeasurementsSchema, validateWalkFile, walkFingerprint, walkFiles, SECRET_FIELD, AGENT_CODE } from './validate-walk.mjs';
import { validateAgainst } from './json-schema.mjs';
import { playwrightInstallOf, playwrightInstallStatus, missingInstallMessage, loadPlaywright, runWalk, CHECK_ID } from './browser-walk.mjs';
import { hostRootOf } from './validate-request.mjs';
import { start } from './host-artifacts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = 'http://127.0.0.1:60000/index.html';

function walk(over = {}) {
  return {
    schemaVersion: 9, id: 'sign-in', flow: 'paid-enrollment',
    entry: { route: ROUTE, viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' },
    account: { alias: 'learner', credentialName: 'uat-shared', credentialRef: '.stacks/dev/secrets/uat.enc' },
    run: { runId: '20260110-000000-1111111', cases: [{ caseId: 'entry', order: 1 }] },
    steps: [
      { id: 'open', action: 'goto', target: null, value: ROUTE },
      { id: 'user', action: 'fill', target: { role: 'textbox', name: 'Username' }, value: 'uat-learner' },
      { id: 'pass', action: 'fill', target: { role: 'textbox', name: 'Password' }, value: { credential: 'uat-shared' } },
      { id: 'submit', action: 'click', target: { role: 'button', name: 'Sign in' } },
      { id: 'landed', action: 'expect', target: { role: 'heading', name: 'Welcome' }, expect: { visible: true }, assertion: { caseId: 'entry', assertionId: 'entry', lane: 'ui' } },
      { id: 'shot', action: 'capture', target: null, capture: { name: 'entry' } },
    ],
    ...over,
  };
}
const withSteps = (edit) => { const w = walk(); edit(w.steps); return w; };
const refuses = (w, needle, label) => { const errors = walkErrors(w, { root }); assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected "${needle}", got:\n${errors.join('\n') || '(none)'}`); };

test('a lawful walk passes, and its controls are the walk\'s own targets', () => {
  assert.deepEqual(walkErrors(walk(), { root }), []);
  assert.equal(stepControl(walk(), 'landed'), 'heading "Welcome"');
  assert.equal(stepControl(walk(), 'submit'), 'button "Sign in"');
  assert.equal(stepControl(walk(), 'shot'), 'heading "Welcome"', 'a capture follows the control pressed before it');
  assert.equal(stepControl(walk(), 'open'), `entry ${ROUTE}`);
  assert.deepEqual(controlOfStep(walk(), 'nowhere'), null);
  // The ledger's spelling: what the step itself named, never the previous step's target.
  assert.equal(stepOwnControl(walk(), 'submit'), 'button "Sign in"');
  assert.equal(stepOwnControl(walk(), 'open'), `entry ${ROUTE}`);
  assert.equal(stepOwnControl(walk(), 'shot'), null, 'a targetless capture names no control');
  assert.equal(stepOwnControl(walk({ steps: [{ id: 'open', action: 'goto', target: null, value: ROUTE }, { id: 'w', action: 'wait', target: null, value: 10 }, { id: 'u', action: 'expect', target: null, expect: { url: '/x' } }], run: undefined }), 'u'), null, 'a url-only expectation names no control');
  assert.equal(stepOwnControl(walk(), 'nowhere'), null);
  assert.equal(stepControl(walk({ steps: [{ id: 'open', action: 'goto', target: null, value: ROUTE }, { id: 'n', action: 'expect', target: { role: 'button', name: 'Go', exact: true, nth: 1 }, expect: { visible: true } }], run: undefined }), 'n'), 'button "Go" exact nth=1');
});

test('the gate against the fake walk: selector, mid-flow goto, literal password, capture before the redirect', () => {
  refuses(withSteps((s) => { s[3].target = { css: '#submit' }; }), 'no unique allowed schema branch', 'a selector target');
  refuses(withSteps((s) => { s[3].target = { role: 'button', name: 'Sign in', selector: 'button' }; }), 'no unique allowed schema branch', 'a target smuggling a selector');
  refuses(withSteps((s) => { s.splice(3, 0, { id: 'jump', action: 'goto', target: null, value: `${ROUTE}?next=1` }); }), 'the walk navigates once, at step 1', 'a goto after step 1');
  refuses(withSteps((s) => { s[0].value = 'http://127.0.0.1:60000/other.html'; }), 'the only navigation a walk makes is to entry.route', 'a goto to another page');
  refuses(withSteps((s) => { s.splice(0, 1); }), 'the first step is the goto', 'a walk with no goto');
  refuses(withSteps((s) => { s[2].value = 'hunter2hunter2'; }), 'with a literal value', 'a password literal');
  refuses(withSteps((s) => { s[1].value = { credential: 'uat-shared' }; }), 'a field whose name does not read as a secret', 'a credential into a plain field');
  refuses(withSteps((s) => { s[2].value = { credential: 'other-name' }; }), 'a walk resolves no other name', 'a credential the account does not declare');
  refuses(walk({ account: null }), 'declares no account', 'a credential with no account');
  refuses(withSteps((s) => { s.splice(3, 0, { id: 'early', action: 'capture', target: null, capture: { name: 'form' } }); }), 'before the sign-in redirect landed', 'a frame that could hold the credential');
  refuses(withSteps((s) => { s.push({ id: 'shot2', action: 'capture', target: null, capture: { name: 'entry' } }); }), 'is used twice', 'a capture name reused');
  refuses(withSteps((s) => { s[4].id = 'user'; }), 'id is declared twice', 'a step id reused');
  refuses(withSteps((s) => { s[3].target = null; }), 'names no target', 'a click with nothing to press');
  refuses(withSteps((s) => { s[4].expect = {}; }), 'states no expectation', 'an empty expectation');
  refuses(withSteps((s) => { s[4].target = null; }), 'can only expect a url', 'a targetless expectation of text');
  refuses(withSteps((s) => { s[4].assertion.caseId = 'ghost'; }), 'which run.cases does not freeze', 'an assertion of an unfrozen case');
  refuses(withSteps((s) => { s[5].capture.name = 'other'; }), 'captured by no capture step named entry', 'a case with no capture of its own name');
  assert.ok(SECRET_FIELD.test('Mật khẩu') && SECRET_FIELD.test('Passphrase') && !SECRET_FIELD.test('Username'));
});

test('the sweep refuses foreign URLs, secret-shaped values and browser code, and names no value', () => {
  const origin = originOf(ROUTE);
  const text = ['{ "target": { "role": "button", "name": "Sign in" } }', 'await page.evaluate(() => 1)', 'see https://evil.example/collect', `"token": "eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}"`, '"password": "hunter2hunter2"'].join('\n');
  const found = sweepWalkText(text, origin, { file: 'walk.json' });
  assert.deepEqual(found.map((f) => [f.line, f.pattern]), [[2, 'agent-code'], [3, 'foreign-url'], [4, 'jwt'], [5, 'password-literal']]);
  for (const e of sweepFindingErrors(found)) { assert.ok(!e.includes('hunter2')); assert.ok(!e.includes('eyJ')); }
  assert.deepEqual(sweepWalkText(`{ "route": "${ROUTE}", "url": "http://127.0.0.1:60000/dashboard" }`, origin), [], 'URLs under the route origin are the walk\'s own');
  assert.ok(AGENT_CODE.test("page.locator('#x')") && AGENT_CODE.test('page.request.post') && !AGENT_CODE.test('the locator of the button'));
});

test('the sweep reads what a run wrote under the response folder and leaves the tree\'s own scripts alone', () => {
  const runner = readFileSync(path.join(root, 'scripts', 'browser-walk.mjs'), 'utf8');
  assert.ok(runner.split(/\r?\n/).some((l) => AGENT_CODE.test(l)), 'the runner is browser code by design, and the pattern would flag it if the sweep read it');
  const dir = mkdtempSync(path.join(tmpdir(), 'walk-sweep-'));
  try {
    const response = path.join(dir, 'response');
    const w = walk();
    mkdirSync(path.join(response, 'data', 'walks', w.id), { recursive: true });
    mkdirSync(path.join(response, 'artifacts'), { recursive: true });
    mkdirSync(path.join(response, 'scripts'), { recursive: true });
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    for (const f of ['scripts/browser-walk.mjs', 'response/scripts/browser-walk.mjs', 'response/artifacts/browser-walk.mjs']) writeFileSync(path.join(dir, f), runner);
    const walkText = JSON.stringify(w, null, 2);
    writeFileSync(path.join(response, 'data', 'walks', w.id, 'walk.json'), walkText);
    assert.deepEqual(sweepWalkRun(walkText, response, w.id, { relativeTo: dir }), [], 'a script beside, under or inside the response folder is never the sweep\'s input');
    writeFileSync(path.join(response, 'artifacts', 'entry.measurements.json'), '{ "text": "await page.evaluate(() => 1)" }');
    const found = sweepWalkRun(walkText, response, w.id, { relativeTo: dir });
    assert.deepEqual(found.map((f) => [f.file, f.pattern]), [['response/artifacts/entry.measurements.json', 'agent-code']], 'a record the run wrote is swept, and only that');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// The origin check answers one question — did the agent go somewhere the route does not cover — so it
// reads what the agent wrote. A rendered page carries URLs of its own (an inline SVG namespace, a
// framework's development links), and the runner's record of that page is not the agent speaking.
test('the origin check reads what the agent wrote, and the runner\'s page records carry the page\'s own URLs', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'walk-origin-'));
  try {
    const response = path.join(dir, 'response');
    const w = walk();
    const walkText = JSON.stringify(w, null, 2);
    mkdirSync(path.join(response, 'data', 'walks', w.id), { recursive: true });
    mkdirSync(path.join(response, 'data', 'captures'), { recursive: true });
    mkdirSync(path.join(response, 'artifacts'), { recursive: true });
    writeFileSync(path.join(response, 'data', 'walks', w.id, 'walk.json'), walkText);
    const page = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg> https://react.dev/link/switch-to-createroot';
    writeFileSync(path.join(response, 'artifacts', 'entry.dom.json'), JSON.stringify({ url: ROUTE, title: 'Sign in', html: page }));
    writeFileSync(path.join(response, 'artifacts', 'entry.ax.txt'), `- link "Docs" /url: https://react.dev/link/x`);
    writeFileSync(path.join(response, 'artifacts', 'entry.measurements.json'), JSON.stringify({ capture: 'entry', elements: [{ ref: 'link "Docs"', text: 'https://react.dev/link/x' }] }));
    writeFileSync(path.join(response, 'artifacts', 'host.json'), JSON.stringify({ url: 'http://127.0.0.1:60007/', pages: [] }));
    assert.deepEqual(sweepWalkRun(walkText, response, w.id, { relativeTo: dir }), [], 'every page record of one capture of a page with an icon passes');
    // What the agent writes keeps the check: its own capture record, and the walk itself.
    writeFileSync(path.join(response, 'data', 'captures', 'entry.json'), JSON.stringify({ matrixId: 'entry', nodes: [{ path: 'a', measured: { href: 'https://evil.example/collect' } }] }));
    assert.deepEqual(sweepWalkRun(walkText, response, w.id, { relativeTo: dir }).map((f) => [f.file, f.pattern]), [['response/data/captures/entry.json', 'foreign-url']], 'a capture record the agent wrote is read');
    rmSync(path.join(response, 'data', 'captures', 'entry.json'));
    const foreign = JSON.stringify({ ...w, flow: 'https://evil.example/collect' }, null, 2);
    assert.ok(sweepWalkRun(foreign, response, w.id, { relativeTo: dir }).some((f) => f.file === 'walk.json' && f.pattern === 'foreign-url'), 'a walk that names another origin is still refused');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a verdict\'s citation resolves against the measurements record by ref and dotted property', () => {
  const doc = { schemaVersion: 9, capture: 'entry', viewport: [1280, 800], deviceScaleFactor: 1, colorScheme: 'light', elements: [{ ref: 'heading "Sign in"', tag: 'h1', bbox: { x: 8, y: 21, width: 1264, height: 37 }, computed: { fontSize: '32px', fontWeight: '700', lineHeight: 'normal', color: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)', minHeight: '0px', padding: { top: '0px', right: '0px', bottom: '0px', left: '0px' }, margin: { top: '21px', right: '0px', bottom: '21px', left: '0px' }, gap: { row: 'normal', column: 'normal' }, borderRadius: '0px', border: { top: '0px none rgb(0, 0, 0)', right: '0px none rgb(0, 0, 0)', bottom: '0px none rgb(0, 0, 0)', left: '0px none rgb(0, 0, 0)' }, overflow: { x: 'visible', y: 'visible' }, display: 'block', visibility: 'visible' }, contrast: 21, text: 'Sign in' }] };
  assert.deepEqual(validateAgainst(loadMeasurementsSchema(root), doc, 'm'), []);
  assert.deepEqual(citedMeasurement(doc, { ref: 'heading "Sign in"', property: 'computed.fontSize' }).recorded, '32px');
  assert.deepEqual(citedMeasurement(doc, { ref: 'heading "Sign in"', property: 'bbox.height' }).recorded, 37);
  assert.deepEqual(citedMeasurement(doc, { ref: 'heading "Sign in"', property: 'contrast' }).recorded, 21);
  assert.equal(citedMeasurement(doc, { ref: 'heading "Sign in"', property: 'computed.padding' }).found, false, 'a citation names one value, not a group');
  assert.equal(citedMeasurement(doc, { ref: 'heading "Sign in"', property: 'computed.gap.diagonal' }).found, false);
  assert.equal(citedMeasurement(doc, { ref: 'button "Go"', property: 'bbox.height' }).element, null);
  assert.equal(loadMeasurementsSchema(root).properties.elements.maxItems > 0, true, 'the cap lives in the kind');
});

test('a run beside its walk: the result hashes the walk, and every text the run wrote is swept', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'walk-run-'));
  try {
    const response = path.join(dir, 'response');
    const w = walk();
    const files = walkFiles(w.id);
    const under = (ref) => path.join(response, ref.replace(/^response\//, ''));
    const bytes = Buffer.from(JSON.stringify(w, null, 2));
    mkdirSync(path.join(response, 'data', 'walks', w.id), { recursive: true });
    mkdirSync(path.join(response, 'artifacts'), { recursive: true });
    writeFileSync(under(files.walk), bytes);
    const result = { schemaVersion: 9, mode: 'playwright', walkRef: files.walk, walkFingerprint: walkFingerprint(bytes), route: ROUTE, outcome: 'pass', startedAt: '2026-01-10T00:00:00Z', finishedAt: '2026-01-10T00:00:05Z', driver: { playwright: '1.0.0', browser: 'chromium', browserVersion: '100', headless: true, context: { fresh: true, viewport: [1280, 800], deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' } }, steps: w.steps.map((s) => ({ id: s.id, action: s.action, control: stepControl(w, s.id), outcome: 'pass', url: ROUTE, ms: 1 })), firstFailure: null, captures: [{ name: 'entry', stepId: 'shot', screenshotRef: 'response/artifacts/entry.png', axRef: 'response/artifacts/entry.ax.txt', domRef: 'response/artifacts/entry.dom.json' }] };
    writeFileSync(under(files.result), JSON.stringify(result, null, 2));
    assert.deepEqual(validateWalkFile(under(files.walk), response, { root }).errors, []);
    writeFileSync(path.join(response, 'artifacts', 'entry.dom.json'), '{ "html": "<a href=\\"https://tracker.example/x\\">" }');
    assert.deepEqual(sweepWalkRun(bytes.toString(), response, w.id, { relativeTo: dir }), [], 'a URL the page carries is the page\'s, and the record of it is the runner\'s');
    writeFileSync(path.join(response, 'artifacts', 'entry.dom.json'), '{ "html": "<p>eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk</p>" }');
    assert.ok(sweepWalkRun(bytes.toString(), response, w.id, { relativeTo: dir }).some((f) => f.file === 'response/artifacts/entry.dom.json' && f.pattern === 'jwt'), 'the secret sweep still reads every record a run wrote');
    writeFileSync(under(files.walk), JSON.stringify({ ...w, flow: 'edited' }, null, 2));
    assert.ok(validateWalkFile(under(files.walk), response, { root }).errors.some((e) => e.includes('a walk edited after its run')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the host install is read from the tool registry, and its absence has one wording', () => {
  const host = mkdtempSync(path.join(tmpdir(), 'walk-host-'));
  try {
    const install = playwrightInstallOf(host, root);
    assert.equal(install.root, path.join(host, '.tools', 'playwright'));
    assert.equal(install.browsers, path.join(host, '.tools', 'playwright', 'browsers'));
    assert.equal(playwrightInstallStatus(host, root).present, false);
    const message = missingInstallMessage(host, root);
    assert.ok(message.startsWith(`${CHECK_ID}: `) && message.includes(install.root) && message.includes('PLAYWRIGHT_BROWSERS_PATH='));
    assert.throws(() => loadPlaywright(host, root), (e) => e.code === 'PLAYWRIGHT_MISSING' && e.message === message);
    mkdirSync(path.dirname(install.module), { recursive: true });
    writeFileSync(install.module, '{ "name": "playwright", "version": "0.0.0" }');
    assert.equal(playwrightInstallStatus(host, root).present, false, 'a package with no browser is not an install');
    mkdirSync(path.join(install.browsers, 'chromium-1'), { recursive: true });
    assert.equal(playwrightInstallStatus(host, root).present, true);
  } finally { rmSync(host, { recursive: true, force: true }); }
});

// The runner, for real: a page with a labelled field, a button and a heading, served on loopback by
// the tree's own host; the walk fills, clicks, expects and captures; the runner writes the walk, the
// result at its digest, the ledger, the trace, the screenshot with its accessibility and DOM records,
// and the uat-capture whose control is the walk's. A second walk fails at its first wrong step and
// nothing after it runs. Skipped by name when the host carries no install.
const HOST_ROOT = process.env.STARCI_WALK_HOST_ROOT ? path.resolve(process.env.STARCI_WALK_HOST_ROOT) : hostRootOf(root);
const install = playwrightInstallStatus(HOST_ROOT, root);
test('the runner drives a static page and writes what the receipt is checked against', { skip: install.present ? false : missingInstallMessage(HOST_ROOT, root) }, async () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'walk-page-'));
  const response = path.join(mkdtempSync(path.join(tmpdir(), 'walk-out-')), 'response');
  writeFileSync(path.join(folder, 'index.html'), `<!doctype html><meta charset="utf-8"><title>sign in</title>
<main><h1>Sign in</h1><form onsubmit="event.preventDefault(); document.getElementById('h').textContent='Welcome ' + document.getElementById('u').value; document.getElementById('h').hidden=false;">
<label for="u">Username</label><input id="u"><label for="p">Password</label><input id="p" type="password">
<button type="submit">Sign in</button></form><h2 id="h" hidden></h2>
<p id="muted" style="color: rgb(119, 119, 119)">Forgot your password? Ask an administrator.</p></main>`);
  const served = await start(folder);
  try {
    const route = `${served.receipt.url}index.html`;
    const w = walk({ account: null, entry: { ...walk().entry, route } });
    w.steps = [
      { id: 'open', action: 'goto', target: null, value: route },
      { id: 'user', action: 'fill', target: { role: 'textbox', name: 'Username' }, value: 'uat-learner' },
      { id: 'submit', action: 'click', target: { role: 'button', name: 'Sign in' } },
      { id: 'landed', action: 'expect', target: { role: 'heading', name: 'Welcome uat-learner' }, expect: { visible: true, text: 'Welcome' }, assertion: { caseId: 'entry', assertionId: 'entry', lane: 'ui' } },
      { id: 'path', action: 'expect', target: null, expect: { url: '/index.html' }, assertion: { caseId: 'entry', assertionId: 'terminal', lane: 'behavior' } },
      { id: 'shot', action: 'capture', target: null, capture: { name: 'entry' } },
    ];
    const walkFile = path.join(folder, 'walk.json');
    writeFileSync(walkFile, JSON.stringify(w, null, 2));
    const run = await runWalk(walkFile, response, { hostRoot: HOST_ROOT, root });
    assert.deepEqual(run.errors, []);
    assert.equal(run.code, 0);
    const files = walkFiles(w.id);
    for (const f of [files.walk, files.result, files.ledger, files.trace, 'artifacts/entry.png', 'artifacts/entry.ax.txt', 'artifacts/entry.dom.json', 'artifacts/entry.measurements.json', 'data/captures/entry.json']) assert.ok(existsSync(path.join(response, f.replace(/^response\//, ''))), `${f} written`);
    const result = JSON.parse(readFileSync(path.join(response, files.result.replace(/^response\//, '')), 'utf8'));
    assert.equal(result.outcome, 'pass');
    assert.equal(result.walkFingerprint, walkFingerprint(readFileSync(walkFile)));
    // The ledger names what each step itself named: the entry, the field, the button, the heading the
    // expectation read; nothing for the url-only expectation and nothing for the capture.
    assert.deepEqual(result.steps.map((s) => [s.id, s.outcome, s.control]), w.steps.map((s) => [s.id, 'pass', stepOwnControl(w, s.id)]));
    assert.deepEqual(result.steps.map((s) => s.control), [`entry ${route}`, 'textbox "Username"', 'button "Sign in"', 'heading "Welcome uat-learner"', null, null]);
    // A capture is also a measurement: the record beside the screenshot carries the numbers a
    // measurable lane judges, computed by the runner and never by the agent.
    assert.equal(result.captures[0].measurementsRef, 'response/artifacts/entry.measurements.json');
    const measurements = JSON.parse(readFileSync(path.join(response, 'artifacts', 'entry.measurements.json'), 'utf8'));
    assert.deepEqual(validateAgainst(loadMeasurementsSchema(root), measurements, 'entry.measurements.json'), []);
    assert.equal(measurements.capture, 'entry');
    assert.deepEqual([measurements.viewport, measurements.deviceScaleFactor, measurements.colorScheme], [[1280, 800], 1, 'light']);
    const heading = citedMeasurement(measurements, { ref: 'heading "Sign in"', property: 'computed.fontSize' });
    assert.ok(heading.found && /^\d+(\.\d+)?px$/.test(heading.recorded) && parseFloat(heading.recorded) >= 24 && parseFloat(heading.recorded) <= 40, `an h1 renders between 24 and 40px, recorded ${heading.recorded}`);
    assert.equal(heading.element.tag, 'h1');
    const button = citedMeasurement(measurements, { ref: 'button "Sign in"', property: 'bbox.height' });
    assert.ok(button.found && button.recorded >= 16 && button.recorded <= 48, `a default button stands between 16 and 48px tall, recorded ${button.recorded}`);
    assert.equal(citedMeasurement(measurements, { ref: 'button "Sign in"', property: 'computed.display' }).recorded, 'inline-block');
    const muted = citedMeasurement(measurements, { ref: 'p#muted', property: 'contrast' });
    assert.ok(muted.found && muted.recorded >= 4 && muted.recorded <= 5, `rgb(119,119,119) over white contrasts about 4.5:1, recorded ${muted.recorded}`);
    assert.equal(muted.element.computed.backgroundColor, 'rgb(255, 255, 255)', 'the effective background is the canvas when nothing paints one');
    assert.equal(muted.element.computed.color, 'rgb(119, 119, 119)');
    assert.ok(citedMeasurement(measurements, { ref: 'textbox "Username"', property: 'bbox.width' }).recorded > 0);
    assert.equal(citedMeasurement(measurements, { ref: 'textbox "Password"', property: 'text' }).recorded, '', 'a field carries no text, so no value can reach the record');
    assert.equal(citedMeasurement(measurements, { ref: 'heading "Welcome uat-learner"', property: 'computed.display' }).recorded, 'block', 'the heading the expectation read is rendered at capture time and enters the record');
    assert.equal(result.driver.browser, 'chromium');
    assert.deepEqual(result.driver.context, { fresh: true, viewport: [1280, 800], deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' });
    const capture = JSON.parse(readFileSync(path.join(response, 'data', 'captures', 'entry.json'), 'utf8'));
    assert.equal(capture.caseId, 'entry');
    assert.equal(capture.outcome, 'pass');
    assert.deepEqual(capture.driver, { mode: 'playwright', walkRef: files.walk, resultRef: files.result, measurementsRef: 'response/artifacts/entry.measurements.json' });
    assert.deepEqual(capture.assertions.map((a) => [a.assertionId, a.stepId, a.control, a.outcome]), [['entry', 'landed', 'heading "Welcome uat-learner"', 'pass'], ['terminal', 'path', 'heading "Welcome uat-learner"', 'pass']]);
    assert.match(readFileSync(path.join(response, 'artifacts', 'entry.ax.txt'), 'utf8'), /Welcome uat-learner/);
    assert.deepEqual(validateWalkFile(path.join(response, 'data', 'walks', w.id, 'walk.json'), response, { root }).errors, []);
    assert.ok(readFileSync(path.join(response, 'artifacts', 'entry.png')).subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'a PNG was written');
    // A run is written once: the same walk is not run again into the same folder.
    const again = await runWalk(walkFile, response, { hostRoot: HOST_ROOT, root });
    assert.equal(again.code, 2);
    assert.ok(again.errors[0].includes('a result already exists'));

    // The failing walk: the button it names does not exist; the run stops there, later steps are
    // skipped, the failure frame is captured for the case, and the exit is non-zero.
    const bad = { ...w, id: 'sign-in-wrong', steps: [w.steps[0], w.steps[1], { ...w.steps[2], target: { role: 'button', name: 'Continue' } }, w.steps[3], w.steps[5]], entry: { ...w.entry, stepTimeoutMs: 1000 } };
    const badFile = path.join(folder, 'bad.json');
    writeFileSync(badFile, JSON.stringify(bad, null, 2));
    const failed = await runWalk(badFile, response, { hostRoot: HOST_ROOT, root });
    assert.equal(failed.code, 1);
    assert.equal(failed.result.outcome, 'fail');
    assert.equal(failed.result.firstFailure.stepId, 'submit');
    assert.deepEqual(failed.result.steps.map((s) => s.outcome), ['pass', 'pass', 'fail', 'skipped', 'skipped']);
    assert.ok(!existsSync(path.join(response, 'data', 'captures', 'entry.json')) || JSON.parse(readFileSync(path.join(response, 'data', 'captures', 'entry.json'), 'utf8')).outcome === 'pass', 'a case the failed walk never evidenced writes no capture over the earlier one');
  } finally {
    served.stop();
    rmSync(folder, { recursive: true, force: true });
    rmSync(path.dirname(response), { recursive: true, force: true });
  }
});
