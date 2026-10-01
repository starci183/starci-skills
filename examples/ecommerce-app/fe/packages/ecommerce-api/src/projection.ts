import { isRecord } from "./client"

/**
 * Node built-ins are taken from `process.getBuiltinModule` when the reader runs, not imported at module
 * scope: this module rides in the package entry that client components also import, and a top-level
 * `node:fs` import would put the file system into the browser bundle. Only a server config module calls
 * `readProjectedOrigins`, so the built-ins are only ever asked for on the server.
 */
const fs = () => process.getBuiltinModule("node:fs")
const path = () => process.getBuiltinModule("node:path")

/**
 * The resolved port projection reader, mirroring the back end's AppConfigService bargain: there is
 * one runtime projection - `be/.starcistacks/dev/infra/metadata.json` of the app - and consumers READ
 * it instead of keeping a second copy that agrees only until somebody moves the offset.
 *
 * The projection lives in the back-end side of the app, so the upward walk from the process cwd looks
 * for `be/.starcistacks/dev/infra/metadata.json` per ancestor (the app root holds it) - the same walk as the
 * BE's own `findMetadataFile`. The caller's config module passes the file outright when a deployment or a
 * test injects it; a missing or malformed projection throws rather than guessing.
 */
const BACK_END_SIDE = "be"
const PROJECTION_REL = [".starcistacks", "dev", "infra", "metadata.json"]

/** The origin of each service and app of the product, as the projection allocates them. */
export interface ProjectedOrigins {
    readonly identityApi: string
    readonly orderApi: string
    readonly landing: string
    readonly shop: string
}

/** The metadata file: the injected path when there is one, else the projection of the nearest app's back end. */
const findMetadataFile = (injected: string | undefined): string => {
    if (injected) {
        if (!fs().existsSync(injected)) throw new Error(`the injected projection ${injected} does not exist.`)
        return path().resolve(injected)
    }
    let dir = path().resolve(process.cwd())
    for (;;) {
        const candidate = path().join(dir, BACK_END_SIDE, ...PROJECTION_REL)
        if (fs().existsSync(candidate)) return candidate
        const parent = path().dirname(dir)
        if (parent === dir) {
            throw new Error(
                `no ${BACK_END_SIDE}/${PROJECTION_REL.join("/")} found from ${process.cwd()} upward; inject its path.`,
            )
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
 * The projected origins of the product, read from `injected` (or the back end's metadata.json); a
 * partial projection is a broken projection. A caller's environment override is applied in its own config
 * module, never here.
 */
export const readProjectedOrigins = (injected: string | undefined): ProjectedOrigins => {
    const file = findMetadataFile(injected)
    let parsed: unknown
    try {
        parsed = JSON.parse(fs().readFileSync(file, "utf8"))
    } catch {
        throw new Error(`${file} is not readable JSON.`)
    }
    const ports = isRecord(parsed) && isRecord(parsed.ports) ? parsed.ports : {}
    const identityApi = originOf(ports, "identityApi")
    const orderApi = originOf(ports, "orderApi")
    const landing = originOf(ports, "landing")
    const shop = originOf(ports, "shop")
    if (identityApi === null || orderApi === null || landing === null || shop === null) {
        throw new Error(`${file} does not carry the resolved ports this app reads.`)
    }
    return { identityApi, orderApi, landing, shop }
}
