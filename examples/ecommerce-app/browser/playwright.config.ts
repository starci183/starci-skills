import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

const BROWSER_DIR = path.dirname(fileURLToPath(import.meta.url))
/** The app root: the folder with the one package.json, next to browser/. */
const APP_ROOT = path.resolve(BROWSER_DIR, "..")

/**
 * The shop origin a browser run navigates: `SHOP_BASE_URL` wins (a deployment, another stack), else the
 * product's resolved port projection `.starcistacks/dev/infra/metadata.json` (`ports.app`) - the one file
 * every consumer of the allocation reads, so no literal port exists here to drift against it. A missing or
 * partial projection throws rather than guessing a number.
 */
const projectedShopOrigin = (): string => {
    let dir = BROWSER_DIR
    for (;;) {
        const file = path.join(dir, ".starcistacks", "dev", "infra", "metadata.json")
        if (fs.existsSync(file)) {
            const ports = (JSON.parse(fs.readFileSync(file, "utf8")) as { ports?: Record<string, unknown> }).ports
            if (typeof ports?.app === "number") return `http://localhost:${ports.app}`
            throw new Error(`${file} carries no numeric ports.app`)
        }
        const parent = path.dirname(dir)
        if (parent === dir) {
            throw new Error(
                `no .starcistacks/dev/infra/metadata.json found from ${BROWSER_DIR} upward; set SHOP_BASE_URL`,
            )
        }
        dir = parent
    }
}

const BASE_URL = process.env.SHOP_BASE_URL ?? projectedShopOrigin()
const IS_LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/.test(BASE_URL)
const SHOP_PORT = Number(new URL(BASE_URL).port || 80)

/**
 * The shop journey of the example: one spec, one project, one worker. A local run serves the built app itself
 * (`npm run start` on the projected port, reused when a server already answers); a run pointed at a remote
 * SHOP_BASE_URL starts nothing. The api stack the journey reads (identity, order, the dev compose infra) is
 * the run's environment, never this config: CI provisions it (scripts/browser-stack.mjs), a developer follows
 * the dev runbook.
 */
export default defineConfig({
    testDir: "./journeys",
    testMatch: "**/*.ts",
    timeout: 60_000,
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: [["list"]],
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: IS_LOCAL
        ? {
              command: "npm run start -w @ecommerce-app/app",
              cwd: APP_ROOT,
              url: `${BASE_URL}/en/browse`,
              env: { PORT: String(SHOP_PORT) },
              reuseExistingServer: true,
              timeout: 180_000,
          }
        : undefined,
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
