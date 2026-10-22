import "server-only"
import * as fileSystem from "node:fs"
import * as nodePath from "node:path"

/**
 * The resolved port projection reader, mirroring the back end's AppConfigService bargain: there is
 * one runtime projection - `.starcistacks/dev/infra/metadata.json` at the app root - and consumers READ
 * it instead of keeping a second copy that agrees only until somebody moves the offset.
 *
 * The projection lives in the app root's `.starcistacks`, so the upward walk from the process cwd looks
 * for `.starcistacks/dev/infra/metadata.json` per ancestor (the app root holds it). The caller's config
 * module passes the file outright when a deployment or a test injects it; a missing or malformed
 * projection throws rather than guessing.
 */
const PROJECTION_REL = [".starcistacks", "dev", "infra", "metadata.json"]

/** True for a plain JSON object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The origin of each service and app of the product, as the projection allocates them. */
interface ProjectedOrigins {
    readonly identityApi: string
    readonly orderApi: string
    readonly landing: string
    readonly app: string
}

/** The metadata file: the injected path when there is one, else the projection of the nearest app root. */
const findMetadataFile = (injected: string | undefined): string => {
    if (injected) {
        if (!fileSystem.existsSync(injected)) throw new Error(`the injected projection ${injected} does not exist.`)
        return nodePath.resolve(injected)
    }
    let dir = nodePath.resolve(process.cwd())
    for (;;) {
        const candidate = nodePath.join(dir, ...PROJECTION_REL)
        if (fileSystem.existsSync(candidate)) return candidate
        const parent = nodePath.dirname(dir)
        if (parent === dir) {
            throw new Error(`no ${PROJECTION_REL.join("/")} found from ${process.cwd()} upward; inject its path.`)
        }
        dir = parent
    }
}

/** One projected port as a local origin, or `null` when the projection does not carry it as a number. */
const originOf = (ports: Readonly<Record<string, unknown>>, key: keyof ProjectedOrigins): string | null => {
    const value = ports[key]
    return typeof value === "number" ? `http://localhost:${value}` : null
}

/**
 * The projected origins of the product, read from `injected` (or the app root's metadata.json); a
 * partial projection is a broken projection. A caller's environment override is applied in its own config
 * module, never here.
 */
const readProjectedOrigins = (injected: string | undefined): ProjectedOrigins => {
    const file = findMetadataFile(injected)
    let parsed: unknown
    try {
        parsed = JSON.parse(fileSystem.readFileSync(file, "utf8"))
    } catch {
        throw new Error(`${file} is not readable JSON.`)
    }
    const ports = isRecord(parsed) && isRecord(parsed.ports) ? parsed.ports : {}
    const identityApi = originOf(ports, "identityApi")
    const orderApi = originOf(ports, "orderApi")
    const landing = originOf(ports, "landing")
    const app = originOf(ports, "app")
    if (identityApi === null || orderApi === null || landing === null || app === null) {
        throw new Error(`${file} does not carry the resolved ports this app reads.`)
    }
    return { identityApi, orderApi, landing, app }
}

/**
 * Deployment facts the landing site reads but does not decide, mirroring `apps/app`'s config module: a
 * component never touches `process.env` directly, so pointing the teaser's "Enter shop" link at a different
 * host is one edit here.
 *
 * The shop is this example's *own* second app, not a backend service, and its port is read from the
 * product's resolved projection (`.starcistacks/dev/infra/metadata.json`, `ports.app`)
 * exactly the way the backend services read theirs - `NEXT_PUBLIC_SHOP_URL` names it outright, the
 * projection (`FULL_APP_METADATA` injects its path) decides otherwise. No literal port exists in
 * this repository to drift against the allocation.
 */

/** Origin of the authenticated shop app this site hands visitors off to; read per call, never when the module loads (an image build has no projection). */
export const shopUrl = (): string =>
    process.env.NEXT_PUBLIC_SHOP_URL ?? readProjectedOrigins(process.env.FULL_APP_METADATA).app
