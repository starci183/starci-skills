#!/usr/bin/env node
// layout-render.mjs — the one way an op gets a real browser render of a product layout.
//
//   starci work layout-render --work <.starciwork> [--app <name>] --node <id> --breakpoint <bp> --theme <t>
//        [--route </path>] [--slot <css selector>] [--locale <l>] [--out <dir>] [--write] [--json]
//
// The runtime serves the app itself (scripts/work/layout-render-serve.mjs: `next dev` on a free port with no host pin, every
// URL on `localhost`, because the app's shared i18n proxy rewrites to localhost), loads the layout's route at the tree's
// breakpoint size, empties the page slot (default selector `main`, exactly one match) and fills it #FF00FF, screenshots the
// viewport, stops the server it started, and with --write records the capture in the layout tree exactly as
// `layout-tree capture` does. A render that cannot be produced exits 1 with code SHELL_RENDER_UNAVAILABLE, a typed `cause`, the
// failing URL and the redirect chain, so the report names what failed. Starting the app by hand is refused by the command guard.
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';
import { isMain } from '../lib/is-main.mjs';
import { findPackage, requirePackage } from '../lib/package-at.mjs';
import { RenderRefusal, captureViewport } from './layout-render-page.mjs';
import { RENDER_HOST, freePort, logTail, nextBinOf, serverErrors, startDevServer, stopDevServer, waitReady } from './layout-render-serve.mjs';
import { appNamesOf, appsOf, frontendOf, layoutTreeMain, nodeById, readShellRecord, treeOf } from './layout-tree.mjs';
import { flag } from './work-io.mjs';

export const REFUSAL_CODE = 'SHELL_RENDER_UNAVAILABLE';
const DEFAULT_SLOT = 'main';
const USAGE = 'Usage: starci work layout-render --work <.starciwork> [--app <name>] --node <id> --breakpoint <bp> --theme <light|dark> [--route </path>] [--slot <selector>] [--out <dir>] [--write] [--json]\n';

const flagName = (key) => `--${key}`;
const recordedText = (result) => (result.recorded ? `\n${result.recorded}` : '');
const successText = (result, json) => (json ? `${JSON.stringify(result, null, 2)}\n` : `rendered ${result.url} -> ${result.file}${recordedText(result)}\n`);

/** The request the arguments describe, or throws a RenderRefusal('usage'). */
export function requestOf(args) {
  const request = { work: flag(args, '--work'), node: flag(args, '--node'), breakpoint: flag(args, '--breakpoint'), theme: flag(args, '--theme'), app: flag(args, '--app'), route: flag(args, '--route'), slot: flag(args, '--slot') ?? DEFAULT_SLOT, locale: flag(args, '--locale'), out: flag(args, '--out'), write: args.includes('--write'), json: args.includes('--json') };
  const missing = ['work', 'node', 'breakpoint', 'theme'].filter((key) => !request[key]);
  if (missing.length) throw new RenderRefusal('usage', `missing ${missing.map((key) => flagName(key)).join(', ')}`);
  return request;
}

/** The app of the layout tree the request names: {name, root, tree}. */
function appOfRequest(record, asked) {
  const names = appNamesOf(record);
  const name = asked ?? (names.length === 1 ? names[0] : null);
  if (!name || !names.includes(name)) throw new RenderRefusal('usage', `name the app with --app (the layout tree declares ${names.join(', ') || 'none'})`);
  return { name, root: appsOf(record).find((app) => app.name === name).root, tree: treeOf(record, name) };
}

/** The route path of a layout node: its url with the locale segment filled by the product locale; --route overrides. */
export function routeOf({ node, tree, route, locale }) {
  if (route) return route.startsWith('/') ? route : `/${route}`;
  const chosen = locale ?? tree.productLocale?.default ?? '';
  const filled = String(node.url ?? '/').replaceAll('[locale]', chosen);
  if (filled.includes('[')) throw new RenderRefusal('route-dynamic', `${node.id}: the url ${node.url} has a dynamic segment other than the locale, name a concrete path with --route`);
  return filled.replace(/\/{2,}/g, '/') || '/';
}

const viewportOf = (tree, breakpoint) => {
  const found = (tree.breakpoints ?? []).find((entry) => entry.name === breakpoint);
  if (!found) throw new RenderRefusal('usage', `${breakpoint}: not one of the tree's breakpoints`);
  return { width: found.width, height: found.height };
};

const playwrightOf = (appRoot) => {
  const found = findPackage([skillRoot, appRoot], ['playwright']);
  if (!found) throw new RenderRefusal('browser-unavailable', 'the runtime has no Playwright to take the render with');
  return requirePackage(found);
};

/** Serve the app, capture, stop: the PNG bytes and the URL they came from. */
async function renderServed({ appRoot, path: routePath, viewport, theme, slot, logFile }) {
  const next = nextBinOf(appRoot);
  if (!next) throw new RenderRefusal('app-not-installed', `next is not installed for ${appRoot}: the workflow tree's dependency install is incomplete, it is the runtime's to complete before the render`);
  const port = await freePort();
  const url = `http://${RENDER_HOST}:${port}${routePath}`;
  const server = startDevServer({ appRoot, bin: next.bin, port, logFile });
  try {
    if (!await waitReady(url, server.child)) throw new RenderRefusal('server-not-ready', `${url}: the app did not answer`, { url, log: logTail(logFile) });
    const shot = await captureViewport({ chromium: playwrightOf(appRoot).chromium, url, viewport, theme, slot });
    const errors = serverErrors(logFile);
    if (errors.length) throw new RenderRefusal('app-error', `${url}: the app logged an error while rendering: ${errors[0]}`, { url, errors, log: logTail(logFile) });
    return { ...shot, url, next: next.version };
  } finally {
    await stopDevServer(server.child);
  }
}

/** The captured PNG recorded in the layout tree, through the same code `layout-tree capture` runs. */
function recordCapture(request, file, url) {
  const result = layoutTreeMain(['capture', '--work', request.work, ...(request.app ? ['--app', request.app] : []), '--node', request.node, '--breakpoint', request.breakpoint, '--theme', request.theme,
    '--file', file, '--url', url, '--provenance', 'starci work layout-render: next dev on localhost, slot keyed #FF00FF', '--write']);
  if (result.exitCode !== 0) throw new RenderRefusal('record-refused', result.text.trim());
  return result.text.trim();
}

/** Run one render request: {ok:true, file, url, ...} or throws a RenderRefusal. */
async function renderLayout(request) {
  const workRoot = path.resolve(request.work);
  const shell = readShellRecord(workRoot);
  if (!shell?.record) throw new RenderRefusal('usage', `${workRoot}: no layout tree to render (scan first)`);
  const app = appOfRequest(shell.record, request.app);
  const node = nodeById(app.tree, request.node);
  if (!node?.layout) throw new RenderRefusal('usage', `${request.node}: not a layout node of the tree`);
  const out = request.out ? path.resolve(request.out) : makeTempDir('starci-layout-render-');
  fs.mkdirSync(out, { recursive: true });
  const base = `${app.name}--${request.node.replace(/[^\w]+/g, '_')}--${request.breakpoint}--${request.theme}`;
  const appRoot = path.join(frontendOf(workRoot).repoRoot, app.root);
  const shot = await renderServed({ appRoot, path: routeOf({ node, tree: app.tree, route: request.route, locale: request.locale }), viewport: viewportOf(app.tree, request.breakpoint), theme: request.theme, slot: request.slot, logFile: path.join(out, `${base}.server.log`) });
  const file = path.join(out, `${base}.png`);
  fs.writeFileSync(file, shot.png);
  const recorded = request.write ? recordCapture({ ...request, app: request.app ?? app.name }, file, shot.url) : null;
  return { ok: true, file, url: shot.url, finalUrl: shot.finalUrl, next: shot.next, recorded };
}

/** argv -> {exitCode, text}. */
export async function layoutRenderMain(argv = []) {
  let request;
  try { request = requestOf(argv); } catch (error) { return { exitCode: 2, text: `layout-render: ${error.message}\n${USAGE}` }; }
  try {
    const result = await renderLayout(request);
    return { exitCode: 0, text: successText(result, request.json) };
  } catch (error) {
    if (!(error instanceof RenderRefusal)) throw error;
    const refusal = { ok: false, code: REFUSAL_CODE, cause: error.cause, message: error.message, blocker: 'environment', ...error.detail };
    return { exitCode: error.cause === 'usage' ? 2 : 1, text: request.json ? `${JSON.stringify(refusal, null, 2)}\n` : `${REFUSAL_CODE} (${error.cause}): ${error.message}\n` };
  }
}

if (isMain(import.meta.url)) {
  const result = await layoutRenderMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
