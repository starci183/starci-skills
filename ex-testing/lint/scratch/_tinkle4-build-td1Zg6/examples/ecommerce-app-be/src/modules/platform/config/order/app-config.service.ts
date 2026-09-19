import {
    Injectable 
} from "@nestjs/common"
import {
    existsSync, readFileSync 
} from "node:fs"
import {
    dirname, join, resolve 
} from "node:path"
import {
    env 
} from "node:process"
import {
    MetadataFileMissingException 
} from "@modules/platform/exceptions/errors/platform/metadata-file-missing"
import {
    MetadataUnreadableException 
} from "@modules/platform/exceptions/errors/platform/metadata-unreadable"
import {
    MetadataPortsMissingException 
} from "@modules/platform/exceptions/errors/platform/metadata-ports-missing"

/** Env var naming this checkout's metadata.json; the fallback walk searches upward from the process cwd. */
export const METADATA_FILE_ENV = "ECOMMERCE_APP_BE_METADATA"
/** Env vars that override a resolved value outright (deployment injects them; dev reads metadata). */
export const PORT_ENV = "ORDER_PORT"
export const DATABASE_URL_ENV = "ORDER_DATABASE_URL"
export const IDENTITY_API_URL_ENV = "IDENTITY_API_URL"

/** The slice of metadata.json this service reads. Extra keys the FE lane adds are ignored. */
interface PortsResult {
  orderApi: number;
  postgres: number;
  identityApi: number;
}

interface MetadataResult {
  project: string;
  ports: PortsResult;
}

/**
 * Narrowing the parsed metadata's ports slice: every cast below is guarded by the `typeof`/
 * null check on the same value immediately above it - an off-shape field answers null rather
 * than a trusted lie.
 */
function portsOf(parsed: unknown): PortsResult | null {
    if (typeof parsed !== "object" || parsed === null) return null
    const ports = (parsed as { ports?: unknown }).ports
    if (typeof ports !== "object" || ports === null) return null
    const candidate = ports as Record<string, unknown>
    if (typeof candidate.orderApi !== "number" || typeof candidate.postgres !== "number"
        || typeof candidate.identityApi !== "number") {
        return null
    }
    return {
        orderApi: candidate.orderApi,
        postgres: candidate.postgres,
        identityApi: candidate.identityApi,
    }
}

/** The project name when the parsed metadata is an object carrying one; "" otherwise. */
function projectOf(parsed: unknown): string {
    if (typeof parsed !== "object" || parsed === null) return ""
    return String((parsed as { project?: unknown }).project ?? "")
}

function findMetadataFile(): string {
    const fromEnv = env[METADATA_FILE_ENV]
    if (fromEnv) {
        if (!existsSync(fromEnv)) {
            throw new MetadataFileMissingException({
                message: `${METADATA_FILE_ENV} points at ${fromEnv}, which does not exist.` 
            })
        }
        return resolve(fromEnv)
    }
    let dir = resolve(process.cwd())
    for (;;) {
        const candidate = join(dir,
            "metadata.json")
        if (existsSync(candidate)) return candidate
        const parent = dirname(dir)
        if (parent === dir) {
            throw new MetadataFileMissingException({
                message: `no metadata.json found from ${process.cwd()} upward; set ${METADATA_FILE_ENV} to its path.` 
            })
        }
        dir = parent
    }
}

function readMetadata(): MetadataResult {
    const file = findMetadataFile()
    let parsed: unknown
    try {
        parsed = JSON.parse(readFileSync(file,
            "utf8"))
    } catch {
        throw new MetadataUnreadableException({
            message: `${file} is not readable JSON.` 
        })
    }
    const ports = portsOf(parsed)
    if (!ports) {
        throw new MetadataPortsMissingException({
            message: `${file} does not carry the resolved ports this service reads (orderApi, postgres, identityApi).` 
        })
    }
    return {
        project: projectOf(parsed), ports 
    }
}

@Injectable()
/**
 * The order service's whole view of "where everything lives". NOTHING here is a source-level
 * port literal: every number is read from the repository's metadata.json - the same file the
 * compose fragments and (later) the FE lane resolve from - and each value may be overridden by
 * its env var for a deployment that injects one. Every process env read lives behind this typed
 * surface - the only place config-and-env §8 allows them.
 */
export class AppConfigService {
    private readonly metadata: MetadataResult

    constructor() {
        this.metadata = readMetadata()
    }

    getProject(): string {
        return this.metadata.project
    }

    getPort(): number {
        const raw = env[PORT_ENV]
        return raw ? Number(raw) : this.metadata.ports.orderApi
    }

    /** The shared dev Postgres (component `postgres`); one database, one schema per service prefix. */
    getDatabaseUrl(): string {
        return env[DATABASE_URL_ENV] ?? `postgres://postgres@localhost:${this.metadata.ports.postgres}/ecommerce`
    }

    /** Base URL of the identity service - where every bearer token goes to be verified. */
    getIdentityApiBaseUrl(): string {
        return env[IDENTITY_API_URL_ENV] ?? `http://localhost:${this.metadata.ports.identityApi}`
    }
}
