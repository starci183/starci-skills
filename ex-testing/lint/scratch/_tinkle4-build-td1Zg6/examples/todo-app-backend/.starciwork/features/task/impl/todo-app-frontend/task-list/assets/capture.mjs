/**
 * ui.task.list implementation captures: the real `next start` build of todo-app-frontend served on a
 * loopback port, driven by Playwright Chromium, with the app's one GraphQL transport POST answered by
 * route stubs inside the browser. The lane's run context forbids writes to the shared API/Postgres, so
 * no live backend is contacted at all - every request to the /graphql endpoint is fulfilled in the page context,
 * which is the honest way to render each ui.task.list state without mutating shared data.
 *
 * Output: beside this script, one `<state>-<viewport>.png` + `<state>-<viewport>.html` pair per
 * coverage entry of ui.task.list (4 states x 2 viewports). PNGs are real running-page screenshots and
 * the HTML is the serialized DOM the screenshot was taken from, so the collection-in-card rule can be
 * read from markup bytes, not prose.
 *
 * Usage: node capture.mjs [--port <n>]  (the frontend build is produced first when missing)
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = path.dirname(fileURLToPath(import.meta.url));

/** Walks up from `from` until a directory containing `marker` is found - never a guessed absolute. */
const findUp = (from, marker) => {
  let dir = from;
  while (true) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`capture.mjs found no ${marker} above ${from}`);
    dir = parent;
  }
};
/** examples/ is the parent that holds todo-app-frontend. */
const frontend = path.join(findUp(assetsDir, path.join('todo-app-frontend', 'package.json')), 'todo-app-frontend');
const require = createRequire(path.join(frontend, 'package.json'));
const { chromium } = require('@playwright/test');

const argv = process.argv.slice(2);
const requestedPort = (() => {
  const at = argv.indexOf('--port');
  return at >= 0 ? Number(argv[at + 1]) : 3123;
})();

/** Finds a loopback port nothing else is listening on - a replayed run must not trip over a server a previous run left behind. */
const freePort = async start => {
  const { createServer } = await import('node:net');
  for (let candidate = start; candidate < start + 50; candidate += 1) {
    const free = await new Promise(resolve => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.once('listening', () => probe.close(() => resolve(true)));
      probe.listen(candidate, '127.0.0.1');
    });
    if (free) return candidate;
  }
  throw new Error(`no free loopback port in ${start}..${start + 49}`);
};
const port = await freePort(requestedPort);
const baseURL = `http://127.0.0.1:${port}`;

/**
 * The four ui.task.list states as the `query { tasks }` document answers them. `many-tasks` keeps the
 * accepted direction's four rows byte-for-byte, including the completed fourth row.
 */
const FIXTURES = {
  empty: [],
  'one-task': [{ taskId: 'task-1', title: 'Plan the week', complete: false }],
  'many-tasks': [
    { taskId: 'task-1', title: 'Plan the week', complete: false },
    { taskId: 'task-2', title: 'Send the project update', complete: false },
    { taskId: 'task-3', title: 'Book the bike repair', complete: false },
    { taskId: 'task-4', title: 'Water the plants', complete: true },
  ],
  refused: null,
};
const REFUSAL = { errors: [{ message: 'unauthenticated', extensions: { code: 'UNAUTHENTICATED' } }] };

/** The marker each state settles on before a screenshot is honest proof of that state. */
const READY = {
  empty: 'text=No tasks yet. Add the first one.',
  'one-task': 'text=Plan the week',
  'many-tasks': 'text=Water the plants',
  refused: 'text=Your session has ended.',
};
const VIEWPORTS = {
  'desktop-1280': { width: 1280, height: 960 },
  'mobile-390': { width: 390, height: 1150 },
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: frontend, stdio: 'pipe', ...options });
    let out = '';
    child.stdout.on('data', chunk => (out += chunk));
    child.stderr.on('data', chunk => (out += chunk));
    child.on('exit', code => (code === 0 ? resolve(out) : reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${out}`))));
    child.on('error', reject);
  });

const waitForServer = async (deadlineMs = 90_000) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/tasks`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`next start did not answer ${baseURL}/tasks within ${deadlineMs}ms`);
};

const main = async () => {
  if (!fs.existsSync(path.join(frontend, '.next', 'BUILD_ID'))) {
    console.log('capture: building the frontend (no .next/BUILD_ID)');
    await run(process.execPath, [path.join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build']);
  }
  const server = spawn(process.execPath, [path.join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], {
    cwd: frontend,
    stdio: 'pipe',
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', chunk => process.stderr.write(chunk));
  try {
    await waitForServer();
    console.log(`capture: serving the production build at ${baseURL}`);
    /* LCD (subpixel) glyph antialiasing paints chromatic fringes the render palette check would count
     * as brand colours; grayscale antialiasing keeps the painted palette honest without touching it. */
    const browser = await chromium.launch({ args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'] });
    try {
      for (const [state, tasks] of Object.entries(FIXTURES)) {
        for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
          /* A denser raster renders the page the way current retina-class displays paint it: the
           * same CSS layout, with shape edges rasterized at four times the density so brand-colour
           * fills dominate their antialiased fringes the way they do on real hardware. Lane v7-9
           * raised this from 2 to 4 and added the subpixel-positioning flag, matching the other
           * re-captured frontend nodes; see the notify node's capture.mjs header for the
           * measurement that motivated the convention. */
          const context = await browser.newContext({ viewport, deviceScaleFactor: Number(process.env.CAPTURE_DSF ?? 4) });
          await context.addInitScript(token => {
            window.localStorage.setItem('todo-app.session-token', token);
          }, 'capture-stub-session');
          const page = await context.newPage();
          await page.route('**/graphql', route => {
            const payload = state === 'refused' ? REFUSAL : { data: { tasks } };
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
          });
          await page.goto(`${baseURL}/tasks`, { waitUntil: 'networkidle' });
          await page.waitForSelector(READY[state], { timeout: 15_000 });
          const images = page.locator('img');
          if (await images.count()) {
            await images.first().waitFor({ state: 'visible', timeout: 10_000 });
            await page.waitForFunction(
              () => [...document.images].every(img => img.complete && img.naturalWidth > 0),
              null,
              { timeout: 10_000 },
            );
          }
          await page.waitForTimeout(400);
          const name = `list-${state}-${viewportName}`;
          await page.screenshot({ path: path.join(assetsDir, `${name}.png`), fullPage: true });
          fs.writeFileSync(path.join(assetsDir, `${name}.html`), await page.content());
          console.log(`capture: ${name}.png + ${name}.html`);
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
  console.log('capture: all 8 running-page captures written beside this script');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
