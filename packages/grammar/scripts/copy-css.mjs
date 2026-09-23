import { copyFile, mkdir, readdir, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const entries = ["common", "core", "heritage", "offset-pop"]

for (const entry of entries) { const dir = resolve(packageRoot, "src", entry); const main = resolve(dir, "styles.css"); const s = await stat(main).catch(() => null); if (s === null || !s.isFile()) throw new Error(`Missing required CSS entry: src/${entry}/styles.css`); await mkdir(resolve(packageRoot, "dist", entry), { recursive: true }); for (const f of (await readdir(dir)).filter((n) => n.endsWith(".css"))) await copyFile(resolve(dir, f), resolve(packageRoot, "dist", entry, f)) }
