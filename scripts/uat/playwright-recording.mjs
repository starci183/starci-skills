// playwright-recording.mjs — every browser UAT the runtime launches records by default: a video, a trace and a
// closing screenshot per test (job-artifacts.mjs indexes them as the job's visual proof). A project Playwright
// `test` command is re-pointed at a generated config that imports the project's own config unchanged and
// only turns use.video / use.trace / use.screenshot on and sends outputDir to `outputDir`. Any other command
// is returned as it was. A leaf module (node builtins only): uat-slots.mjs and assisted-runner.mjs both use it.
import fs from 'node:fs';
import path from 'node:path';

const CONFIG_NAMES = ['playwright.config.ts', 'playwright.config.mts', 'playwright.config.cts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'];
const CONFIG_FLAGS = new Set(['--config', '-c']);

/** True when `command` runs the Playwright test runner. */
export const isPlaywrightTest = (command) => {
  const joined = command.join(' ').toLowerCase();
  return /playwright/.test(joined) && /(^|\s)test(\s|$)/.test(joined);
};

/** The project config a Playwright command names (--config / -c / --config=), else the default one in `cwd`. */
export function projectConfigOf(command, cwd) {
  for (let i = 0; i < command.length; i++) {
    const arg = String(command[i]);
    if (CONFIG_FLAGS.has(arg) && command[i + 1]) return path.resolve(cwd, command[i + 1]);
    const eq = /^--config=(.+)$/.exec(arg);
    if (eq) return path.resolve(cwd, eq[1]);
  }
  return CONFIG_NAMES.map((name) => path.join(cwd, name)).find((file) => fs.existsSync(file)) ?? null;
}

const specifier = (file) => file.replace(/\\/g, '/').replace(/\.(ts|mts|cts)$/, '');

/** The wrapper config's source: the project config with recording on. */
export function recordingConfigSource({ projectConfig, cwd, outputDir }) {
  const dir = projectConfig ? path.dirname(projectConfig) : cwd;
  return [
    "import path from 'node:path';",
    projectConfig ? `import base from ${JSON.stringify(specifier(projectConfig))};` : 'const base = {};',
    'const cfg: any = (base as any)?.default ?? base ?? {};',
    `const dir = ${JSON.stringify(dir.replace(/\\/g, '/'))};`,
    `const out = ${JSON.stringify(outputDir.replace(/\\/g, '/'))};`,
    "const rec = (use: any = {}) => ({ ...use, video: 'on', trace: 'on', screenshot: 'on' });",
    "const at = (p: any) => (typeof p === 'string' ? path.resolve(dir, p) : p);",
    'const hooks = (key: string) => (cfg[key] ? { [key]: Array.isArray(cfg[key]) ? cfg[key].map(at) : at(cfg[key]) } : {});',
    'export default {',
    '  ...cfg, ...hooks(\'globalSetup\'), ...hooks(\'globalTeardown\'),',
    "  testDir: path.resolve(dir, cfg.testDir ?? '.'), outputDir: out, use: rec(cfg.use),",
    "  ...(cfg.webServer ? { webServer: [cfg.webServer].flat().map((w: any) => ({ ...w, cwd: path.resolve(dir, w.cwd ?? '.') })) } : {}),",
    '  ...(Array.isArray(cfg.projects) ? { projects: cfg.projects.map((p: any) => ({ ...p, ...(p.testDir ? { testDir: path.resolve(dir, p.testDir) } : {}),',
    "    ...(p.outputDir ? { outputDir: path.join(out, path.basename(p.outputDir)) } : {}), use: rec(p.use) })) } : {}),",
    '};',
    '',
  ].join('\n');
}

/**
 * `command` with recording on: {command, outputDir, config} for a Playwright test command (the wrapper config
 * is written beside `outputDir`), else {command} unchanged. `outputDir` is fresh per run: Playwright empties
 * its outputDir when a run starts.
 */
export function withRecording(command, { cwd, outputDir }) {
  if (!isPlaywrightTest(command)) return { command };
  const projectConfig = projectConfigOf(command, cwd);
  const config = `${outputDir}.playwright.config.ts`;
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, recordingConfigSource({ projectConfig, cwd, outputDir }));
  const rest = [];
  for (let i = 0; i < command.length; i++) {
    const arg = String(command[i]);
    if (CONFIG_FLAGS.has(arg)) { i += 1; continue; }
    if (/^--config=/.test(arg)) continue;
    rest.push(command[i]);
  }
  return { command: [...rest, '--config', config], outputDir, config };
}

/** A fresh per-run output directory under `root`. */
export const recordingDirUnder = (root, now = new Date()) => path.join(root, `playwright-${now.toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 17)}-${process.pid}`);
