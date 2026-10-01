import { randomBytes } from "node:crypto"
import type { InfraName } from "../../config/types"
import type { AttachRequest, Namespace, ProxiedEndpoint } from "../contracts"
import type { Docker } from "../docker"
import type { FetchLike, Pause } from "../health"
import type { PgConnect } from "../pg"
import type { RedisRoundTrip } from "../resp"

/** Generated secrets of a container, by name. */
export type Secrets = Readonly<Record<string, string>>

/** The IO a service definition may use; all of it injectable so definitions are unit-tested without docker. */
export interface ServiceNet {
    readonly docker: Docker
    readonly fetch: FetchLike
    readonly pg: PgConnect
    readonly redis: RedisRoundTrip
    readonly pause: Pause
}

/** The shared container of a service on the host, reached directly (never through toxiproxy). */
export interface ServiceTarget {
    readonly container: string
    readonly image: string
    /** Always `127.0.0.1`. */
    readonly host: string
    /** The container's published host port. */
    readonly port: number
    /** The generated secrets of the container; empty when the target is rebuilt from a run (the run carries what it needs). */
    readonly secrets: Secrets
    readonly net: ServiceNet
}

/** What a container is started with, besides the parts the stack fixes (name, network, labels, restart policy, port publishing). */
export interface ServiceSpec {
    readonly env: Readonly<Record<string, string>>
    readonly command: ReadonlyArray<string>
}

/** Per-start hints for {@link ServiceDefinition.spec}. */
export interface SpecHints {
    /** The stack-wide proxy port a broker must advertise (Kafka only). */
    readonly advertisedPort: number | null
}

/** What a service is asked to provision for one run. */
export interface ProvisionInput {
    readonly namespace: Namespace
    readonly request: AttachRequest
    /** Leases a Redis DB index for the namespace from the registry. */
    leaseRedisDb(): Promise<number>
}

/** The service-specific part of a run's infra (`RunX` without the endpoint), plus notes to keep for `reset`. */
export interface ProvisionResult<TRun extends ProxiedEndpoint> {
    readonly run: Omit<TRun, keyof ProxiedEndpoint>
    readonly notes?: Readonly<Record<string, string>>
}

/** What a reset is given besides the run. */
export interface ResetInput {
    readonly namespace: Namespace
    readonly keepTables: Readonly<Record<string, ReadonlyArray<string>>>
    /** The notes {@link ProvisionResult.notes} stored for this namespace. */
    readonly notes: Readonly<Record<string, string>>
}

/** What a deprovision is given besides the run. */
export interface DeprovisionInput {
    readonly namespace: Namespace
    /** Frees the Redis DB index lease of the namespace. */
    releaseRedisDb(): Promise<void>
}

/** One infrastructure service: how to start it, when it is ready, and what a namespace owns in it. */
export interface ServiceDefinition<TRun extends ProxiedEndpoint> {
    readonly name: InfraName
    /** The container port the service listens on. */
    readonly port: number
    /** The generated secrets of a new container of this service. */
    newSecrets(): Record<string, string>
    /** The default container spec for an image. */
    spec(image: string, secrets: Secrets, hints: SpecHints): ServiceSpec
    /** A real protocol check: true when the service answers. */
    ready(target: ServiceTarget): Promise<boolean>
    /** Creates what the namespace owns (databases, realm, buckets, ...). Idempotent. */
    provision(target: ServiceTarget, input: ProvisionInput): Promise<ProvisionResult<TRun>>
    /** Empties what a spec may have written. */
    reset(target: ServiceTarget, run: TRun, input: ResetInput): Promise<void>
    /** Removes everything the namespace owns. */
    deprovision(target: ServiceTarget, run: TRun, input: DeprovisionInput): Promise<void>
}

/** A random URL-safe secret. */
export const randomSecret = (bytes = 12): string => randomBytes(bytes).toString("hex")

/** The `http://host:port` of a target. */
export const baseUrl = (target: Pick<ServiceTarget, "host" | "port">): string => `http://${target.host}:${target.port}`
