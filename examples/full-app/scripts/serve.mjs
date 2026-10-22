/**
 * Launch one app on its projected port - the only way `dev`/`start` learn a port number.
 *
 *   node examples/full-app/scripts/serve.mjs <landing|app> <dev|start|build> [extra next args...]
 *
 * The port is read from the product's runtime projection (`examples/full-app/scripts/projection.mjs`), never from a
 * literal in this repository, and handed to the app's own `next` binary as `-p <port>`. The same
 * projection also fills the public env the apps' config modules fall back to, so the listener and
 * the URLs the pages render always come from one resolution. Any `NEXT_PUBLIC_*`/`PORT` the caller
 * already set wins - env override first, projection as the fallback, the BE's own precedence. `build` runs `next build` with
 * the same public env: the browser's NEXT_PUBLIC_* values are inlined at build time, so a build for the local stack (the
 * browser journey, the UAT walks) must see them - a plain `npm run build:fe` has none and its shop calls no api.
 */
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readPorts } from "./projection.mjs"

const APPS = new Set(["landing", "app"])
const [, , app, command, ...rest] = process.argv

if (!APPS.has(app) || !["dev", "start", "build"].includes(command ?? "")) {
    console.error("usage: node scripts/serve.mjs <landing|app> <dev|start|build> [extra next args...]")
    process.exit(2)
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const appDir = join(appRoot, "fe", "apps", app)
const ports = readPorts()

const env = {
    ...process.env,
    NEXT_PUBLIC_ORDER_API_URL: process.env.NEXT_PUBLIC_ORDER_API_URL ?? `http://localhost:${ports.orderApi}`,
    NEXT_PUBLIC_IDENTITY_API_URL: process.env.NEXT_PUBLIC_IDENTITY_API_URL ?? `http://localhost:${ports.identityApi}`,
    NEXT_PUBLIC_SHOP_URL: process.env.NEXT_PUBLIC_SHOP_URL ?? `http://localhost:${ports.app}`,
}

const require = createRequire(join(appDir, "package.json"))
const nextBin = join(dirname(require.resolve("next/package.json")), "dist", "bin", "next")
const port = ports[app]

const args = command === "build" ? [nextBin, "build", ...rest] : [nextBin, command, "-p", String(port), ...rest]
const child = spawn(process.execPath, args, {
    cwd: appDir,
    env,
    stdio: "inherit",
})
child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 1)
})
