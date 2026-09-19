import { copyFile, mkdir, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const entries = ["common", "core", "heritage", "offset-pop"]

for (const entry of entries) {
    const source = resolve(packageRoot, "src", entry, "styles.css")
    const target = resolve(packageRoot, "dist", entry, "styles.css")
    const sourceStat = await stat(source).catch(() => null)
    if (sourceStat === null || !sourceStat.isFile()) {
        throw new Error(`Missing required CSS entry: src/${entry}/styles.css`)
    }
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
}
