// render-tools.mjs - the tools a capture needs (Playwright with a browser, esbuild) and where they come from.
//
// A product declares neither: a drawing is captured by the runtime, so the runtime pins and installs both (package.json devDependencies,
// the browser download Playwright keeps in its own cache). The product's own install, when it has one, comes first (its tailwindcss,
// React and tsconfig paths resolve from the product regardless); the runtime's install is always the last candidate. This is the same
// order layout-render.mjs uses for its capture. A host with neither a project install nor the runtime's, or with Playwright and no browser,
// is RENDER_TOOL_UNAVAILABLE: one typed host fact the dispatch of an op that needs a capture checks before it spends an attempt.
import fs from 'node:fs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { findPackage, requirePackage } from '../lib/package-at.mjs';

/** The catalogued code of a host that cannot take a capture (modules/kernel/failure-codes.yaml). */
export const RENDER_TOOL_UNAVAILABLE = 'RENDER_TOOL_UNAVAILABLE';
/** The hint an op manifest carries in route.riskHints when its steps capture a render. */
export const RENDER_CAPABILITY_HINT = 'host-capability-required:render';
const PLAYWRIGHT_PACKAGES = Object.freeze(['playwright', '@playwright/test', 'playwright-core']);

/** The directories a tool is looked up from: the caller's (project first), then the runtime. */
export const toolDirs = (dirs, runtime = skillRoot) => [...dirs.filter(Boolean), runtime].filter(Boolean);

/** The first install of `names` resolvable from each of `dirs` in turn, one per distinct package root. */
function installsOf(dirs, names) {
  const seen = new Set();
  const out = [];
  for (const dir of dirs) {
    const found = findPackage([dir], names);
    if (found && !seen.has(found.root)) { seen.add(found.root); out.push(found); }
  }
  return out;
}

/** Whether the browser a Playwright install would launch is on the disk. */
function browserOf(found) {
  try { return fs.existsSync(requirePackage(found).chromium.executablePath()); } catch { return false; }
}

/**
 * The Playwright install a capture launches: the first of the project's and the runtime's whose browser exists, else the first install
 * (its launch then names the missing browser). Null when no directory resolves one.
 */
export function playwrightInstall(dirs, { runtime = skillRoot } = {}) {
  const installs = installsOf(toolDirs(dirs, runtime), PLAYWRIGHT_PACKAGES);
  return installs.find(browserOf) ?? installs[0] ?? null;
}

/** The esbuild install a capture bundles with: the project's, else the runtime's; null when neither resolves one. */
export const esbuildInstall = (dirs, { runtime = skillRoot } = {}) => findPackage(toolDirs(dirs, runtime), ['esbuild']);

/**
 * What this host can capture with, from `dirs` (the tree the op runs in) and the runtime: {ok, missing: [{tool, why}], playwright, esbuild}.
 * `missing` names each absent tool with the one-line reason a Kernel and the owner read.
 */
export function renderToolStatus(dirs = [], { runtime = skillRoot } = {}) {
  const playwright = playwrightInstall(dirs, { runtime });
  const esbuild = esbuildInstall(dirs, { runtime });
  const missing = [];
  if (!playwright) missing.push({ tool: 'playwright', why: 'no Playwright install resolves from the project or the runtime' });
  else if (!browserOf(playwright)) missing.push({ tool: 'chromium', why: `Playwright ${playwright.version} resolves at ${playwright.root.split(/[\\/]/).slice(-2).join('/')} and its Chromium download is absent from the browser cache` });
  if (!esbuild) missing.push({ tool: 'esbuild', why: 'no esbuild install resolves from the project or the runtime' });
  return { ok: missing.length === 0, missing, playwright, esbuild };
}

/** The one-line instruction for a missing tool: what provisions it. */
export const renderToolFix = (missing) => missing.map((item) => (item.tool === 'chromium'
  ? 'run `npx playwright install chromium` once on the host (the browser cache is the owner\'s to fill)'
  : `install the runtime's dependencies (\`npm install\` in the runtime checkout) so ${item.tool} resolves`)).join('; ');
