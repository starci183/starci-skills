/**
 * The resolved port projection reader, mirroring the back end's AppConfigService bargain:
 * there is one runtime projection - `.starcistacks/dev/infra/metadata.json` at this app's root - and
 * consumers READ it instead of keeping a second copy that agrees only until somebody moves the offset.
 *
 * The projection lives in the app root's .starcistacks (its metadata.json is the whole product's resolved
 * projection - its own README states the front end's ports are "declared here, consumed there").
 * Resolution order:
 *
 *   1. `ECOMMERCE_APP_METADATA` names the file outright (deployment/tests inject it).
 *   2. Otherwise the app root and each ancestor of it is searched for
 *      `.starcistacks/dev/infra/metadata.json`.
 *
 * A missing or malformed projection throws naming the env var; nothing here invents a number.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const METADATA_FILE_ENV = "ECOMMERCE_APP_METADATA"
const PROJECTION_REL = [".starcistacks", "dev", "infra", "metadata.json"]
const REQUIRED_PORT_KEYS = ["identityApi", "orderApi", "landing", "shop"]

const repoRoot = () => resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const findMetadataFile = (startDir = repoRoot()) => {
    const fromEnv = process.env[METADATA_FILE_ENV]
    if (fromEnv) {
        if (!existsSync(fromEnv)) {
            throw new Error(`${METADATA_FILE_ENV} points at ${fromEnv}, which does not exist.`)
        }
        return resolve(fromEnv)
    }
    let dir = resolve(startDir)
    for (;;) {
        const candidate = join(dir, ...PROJECTION_REL)
        if (existsSync(candidate)) return candidate
        const parent = dirname(dir)
        if (parent === dir) {
            throw new Error(
                `no ${PROJECTION_REL.join("/")} found from ${startDir} upward; set ${METADATA_FILE_ENV} to its path.`,
            )
        }
        dir = parent
    }
}

/**
 * Read the resolved `ports` map the frontend consumes. Throws unless every key this lane serves
 * or calls is a number - a partial projection is a broken projection, not a reason to guess.
 */
export const readPorts = (startDir) => {
    const file = findMetadataFile(startDir)
    let parsed
    try {
        parsed = JSON.parse(readFileSync(file, "utf8"))
    } catch {
        throw new Error(`${file} is not readable JSON.`)
    }
    const ports = parsed?.ports
    const missing = REQUIRED_PORT_KEYS.filter((key) => typeof ports?.[key] !== "number")
    if (missing.length > 0) {
        throw new Error(`${file} does not carry the resolved ports this app reads (${missing.join(", ")}).`)
    }
    return ports
}
