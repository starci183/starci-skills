import { rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const target = resolve(packageRoot, "dist")

if (dirname(target) !== packageRoot) {
    throw new Error(`Refusing to clean unexpected path: ${target}`)
}

await rm(target, { recursive: true, force: true })
