"use strict"

/**
 * The three viewports of a ui-screen record. desktop and mobile are the layout-tree DEFAULT_BREAKPOINTS
 * (scripts/work/layout-tree.mjs), the sizes interface.draw shots are taken at; tablet is the third breakpoint.
 * One Playwright project per viewport, so a flow is asserted at every size the design was drawn at.
 */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
}

/**
 * The whole Playwright config of a front-end repository.
 *
 * @param {object} [options]
 * @param {string} [options.testDir]     default `./e2e`
 * @param {string} [options.baseURL]     default `E2E_BASE_URL`, else `http://127.0.0.1:3000`
 * @param {string} [options.outputDir]   default `test-results`
 * @param {Array}  [options.reporter]    default list
 * @param {object} [options.webServer]   Playwright webServer entry, when the suite owns its server
 * @param {number} [options.timeout]     per-test timeout, default 60_000
 * @param {object} [options.use]         extra `use` options
 */
function starciPlaywrightConfig(options = {}) {
  const config = {
    testDir: options.testDir ?? "./e2e",
    testMatch: "**/*.e2e-spec.ts",
    outputDir: options.outputDir ?? "test-results",
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    timeout: options.timeout ?? 60_000,
    reporter: options.reporter ?? "list",
    use: {
      baseURL: options.baseURL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
      colorScheme: "light",
      reducedMotion: "reduce",
      trace: "retain-on-failure",
      ...options.use,
    },
    projects: Object.entries(VIEWPORTS).map(([name, viewport]) => ({
      name,
      use: { browserName: "chromium", viewport: { ...viewport } },
    })),
  }
  if (options.webServer) config.webServer = options.webServer
  return config
}

module.exports = { starciPlaywrightConfig, VIEWPORTS }
