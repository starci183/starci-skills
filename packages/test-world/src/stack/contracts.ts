/**
 * Layer (a), the stack: the contract between the docker lifecycle and the rest of the library. The shared warm stack is one
 * set of containers for ALL repositories on the machine, keyed by image: two repositories on the same Postgres image share
 * one container, a different image version gets its own. Per-repository isolation is enforced here, never left to a spec:
 * database names, Keycloak realm, Redis DB index, MinIO bucket prefix, Qdrant collection prefix, Kafka topic prefix, k3d
 * namespace prefix and toxiproxy proxies are all derived from the {@link Namespace}.
 */
import type { InfraName } from "../config/types"

/** The isolation identity of one repository checkout. Everything a repository owns in the shared stack is named from it. */
export interface Namespace {
    /** `<package-name-slug>_<6 hex of the checkout root hash>` in snake case, e.g. `shop_be_a1b2c3`; safe as a Postgres identifier prefix. */
    readonly snake: string
    /** The same in kebab case (`shop-be-a1b2c3`); safe for realm, bucket, namespace and container names. */
    readonly kebab: string
    /** The absolute repository root. */
    readonly root: string
}

/** How the machine-wide state of the stack is stored: one directory under the home of the user (`~/.starci/test-stack/`). */
export interface StackHome {
    /** The directory. */
    readonly dir: string
}

/** One infrastructure image to keep warm. */
export interface StackImageRequest {
    readonly service: InfraName
    /** The full image reference including the tag (`pgvector/pgvector:pg16`). */
    readonly image: string
}

/** One Postgres connection as the stack provisions it: a database of its own, or a schema (with its own login) of a shared one. */
export interface PostgresConnectionRequest {
    readonly name: string
    readonly extensions?: ReadonlyArray<string>
    /** The logical database (default: `name`); connections naming one share it. */
    readonly database?: string
    /** The schema of a schema-per-context connection. */
    readonly schema?: string
}

/** What one run asks of the stack. */
export interface AttachRequest {
    /** The isolation identity. */
    readonly namespace: Namespace
    /** The run token; leases and toxiproxy proxies of the run carry it. */
    readonly runId: string
    /** The services to attach to (starting them when the stack is not warm), each with its image. */
    readonly services: ReadonlyArray<StackImageRequest>
    /** Postgres: the connections (logical names) to give a database each; `extensions` are created in each database. */
    readonly postgresql?: { readonly connections: ReadonlyArray<PostgresConnectionRequest> }
    /** Keycloak: the realm import file (absolute) and the public client id for the password grant (default: detected in the file). */
    readonly keycloak?: { readonly realmFile: string; readonly clientId?: string }
    /** MinIO: logical bucket names to create (each stored as `<namespace.kebab>-<name>`). */
    readonly minio?: { readonly buckets: ReadonlyArray<string> }
    /** Kafka: logical topic names to create (each stored as `<namespace.kebab>.<name>`). */
    readonly kafka?: { readonly topics: ReadonlyArray<string> }
    /** The k3d cluster; absent when the repository does not use it. */
    readonly k3d?: K3dRequest
}

/** One own image built by content hash. */
export interface OwnImageRequest {
    /** The logical name (`api`, `worker`); the repository is `<registry>/<namespace.kebab>-<name>`. */
    readonly name: string
    /** The Dockerfile path relative to the repository root; its build context is the repository root. */
    readonly dockerfile: string
}

/** What the cluster layer is asked for. */
export interface K3dRequest {
    readonly images: ReadonlyArray<OwnImageRequest>
}

/** A published endpoint: the direct container port and the toxiproxy port a run uses. */
export interface ProxiedEndpoint {
    /** The host the app and specs connect to (always `127.0.0.1`). */
    readonly host: string
    /** The toxiproxy listen port published on the host: this is what apps connect to. */
    readonly port: number
    /** The container's own published port, bypassing toxiproxy (admin work of the library only). */
    readonly directPort: number
    /** The toxiproxy proxy name (`<runId>-<service>`), the handle of `latency/cut/restore`. */
    readonly proxy: string
    /** The image of the shared container the run attached to. */
    readonly image: string
    /** The docker container name of the shared container. */
    readonly container: string
}

/** The provisioned Postgres of a run. */
export interface RunPostgres extends ProxiedEndpoint {
    readonly user: string
    readonly password: string
    /** Logical connection name to the stored database name (`<namespace.snake>_<database>`; shared by the connections of one database). */
    readonly databases: Readonly<Record<string, string>>
    /**
     * The schema-per-context connections: their schema and their own login role (`<namespace.snake>_<connection>`, whose
     * `search_path` is the schema). A connection absent here owns its database and uses the stack user.
     */
    readonly schemas: Readonly<Record<string, PostgresSchemaLogin>>
}

/** The login of one schema-per-context connection. */
export interface PostgresSchemaLogin {
    readonly schema: string
    readonly user: string
    readonly password: string
}

/** The provisioned Redis of a run. */
export interface RunRedis extends ProxiedEndpoint {
    /** The DB index leased to the repository. */
    readonly db: number
}

/** The provisioned MinIO of a run. */
export interface RunMinio extends ProxiedEndpoint {
    readonly accessKey: string
    readonly secretKey: string
    readonly bucketPrefix: string
    /** Logical bucket name to stored bucket name. */
    readonly buckets: Readonly<Record<string, string>>
}

/** The provisioned Qdrant of a run. */
export interface RunQdrant extends ProxiedEndpoint {
    readonly collectionPrefix: string
}

/**
 * The provisioned Kafka of a data slot. The broker has one listener per slot, each advertising its own proxied address, so
 * the slot's proxy (`proxy`, `port`) carries every byte its clients exchange with the broker and an outage of it reaches this
 * slot alone.
 */
export interface RunKafka extends ProxiedEndpoint {
    /** The slot listener (1-based) leased to the namespace. */
    readonly listener: number
    /** Prefix of the slot's consumer groups and client ids (`<namespace.kebab>.`). */
    readonly groupPrefix: string
    readonly topicPrefix: string
    /** Logical topic name to stored topic name. */
    readonly topics: Readonly<Record<string, string>>
}

/** The provisioned Keycloak realm of a run. */
export interface RunKeycloak extends ProxiedEndpoint {
    /** The realm imported for the repository (`<namespace.kebab>-<realm>`). */
    readonly realm: string
    readonly clientId: string
    readonly adminUser: string
    readonly adminPassword: string
    /** The secret the realm import gave each confidential client, by clientId (absent for a run provisioned before 1.0.5). */
    readonly clientSecrets?: Readonly<Record<string, string>>
    /**
     * Each user id the realm file pins, to the id this namespace's realm stores it under (Keycloak ids are unique per server,
     * so every slot's realm gets its own); the seeds of the slot are applied with the same rewrite.
     */
    readonly userIds: Readonly<Record<string, string>>
}

/** The cluster of a run. */
export interface RunCluster {
    /** The k3d cluster name (keyed by the k3s image). */
    readonly cluster: string
    /** The name of the server container (`docker exec <it> kubectl ...`). */
    readonly serverContainer: string
    /** The local registry as the host reaches it (`localhost:<port>`). */
    readonly registry: string
    /** The registry as pods reach it (`k3d-<name>:5000`). */
    readonly registryInCluster: string
    /** Namespace prefix of the repository (`<namespace.kebab>-`). */
    readonly namespacePrefix: string
    /** Logical image name to the pushed reference as pods pull it. */
    readonly images: Readonly<Record<string, string>>
}

/** What `attachStack` answers: the run's provisioned endpoints; serializable (goes into the state file). */
export interface RunInfra {
    /** The toxiproxy REST API (`http://127.0.0.1:<port>`); one shared toxiproxy container serves every run. */
    readonly toxiproxyApi: string
    readonly postgresql?: RunPostgres
    readonly redis?: RunRedis
    readonly minio?: RunMinio
    readonly qdrant?: RunQdrant
    readonly kafka?: RunKafka
    readonly keycloak?: RunKeycloak
    readonly cluster?: RunCluster
}

/** One shared container of the stack as `status` reports it. */
export interface StackContainerStatus {
    readonly service: InfraName | "toxiproxy" | "registry" | "k3d"
    readonly image: string
    readonly container: string
    readonly state: "running" | "exited" | "missing" | "unhealthy"
    /** Published host port of the service itself. */
    readonly port: number | null
}

/** One live lease: a run attached to the stack. */
export interface StackLease {
    readonly namespace: string
    readonly runId: string
    readonly pid: number
    readonly since: string
}

/** What `starci app stack status` prints. */
export interface StackStatus {
    readonly home: string
    readonly containers: ReadonlyArray<StackContainerStatus>
    readonly leases: ReadonlyArray<StackLease>
}

/** The behaviors the rest of the library needs from layer (a). Implemented by `stack/index.ts`. */
export interface StackApi {
    /** Starts every missing shared container the images name (idempotent, serialised across processes by a lock), waits until healthy, and answers the status. The CLI `up`. */
    up(services: ReadonlyArray<StackImageRequest>, k3d?: K3dRequest & { readonly root: string }): Promise<StackStatus>
    /** Stops and removes the shared containers that no live lease uses; with `force`, all of them. The CLI `down`. */
    down(options?: { readonly force?: boolean }): Promise<StackStatus>
    /** Reports containers and leases. The CLI `status`. */
    status(): Promise<StackStatus>
    /** Attaches a run: `up` for what is missing, provisions the namespace's databases, realm, prefixes and proxies, registers a lease. */
    attach(request: AttachRequest): Promise<RunInfra>
    /** Detaches a run: drops its databases, realm, redis DB, buckets, collections, topics, namespaces and proxies; removes the lease. Shared containers stay warm. */
    detach(request: { readonly namespace: Namespace; readonly runId: string; readonly infra: RunInfra }): Promise<void>
    /** Empties what a spec may have written, keeping the schema: called before every spec file by the world. */
    reset(request: { readonly namespace: Namespace; readonly infra: RunInfra; readonly keepTables: Readonly<Record<string, ReadonlyArray<string>>> }): Promise<void>
}

/** A toxiproxy client bound to one proxy; the handle behind `world.infra.<service>`. */
export interface ProxyToxics {
    /** Adds `ms` of latency (with optional jitter) to both directions until `restore`. */
    latency(ms: number, jitterMs?: number): Promise<void>
    /** Cuts the service off: the proxy stops accepting and drops live connections until `restore`. */
    cut(): Promise<void>
    /** Removes every toxic and re-enables the proxy. */
    restore(): Promise<void>
}

/** One pod of the cluster. */
export interface ClusterPod {
    readonly name: string
    readonly namespace: string
    /** Kubernetes pod phase (`Running`, `Pending`, `Succeeded`, `Failed`). */
    readonly phase: string
    /** Every container ready. */
    readonly ready: boolean
}

/** The handle behind `world.cluster`: only namespaces of this repository (prefixed) are visible and writable. */
export interface ClusterClient {
    /** Pods of one namespace (logical or stored name), or of every namespace of the repository. */
    pods(namespace?: string): Promise<ReadonlyArray<ClusterPod>>
    /** The stored names of the repository namespaces (all begin with the namespace prefix). */
    namespaces(): Promise<ReadonlyArray<string>>
    /** Creates the namespace `<prefix><name>` (idempotent) and answers the stored name. */
    createNamespace(name: string): Promise<string>
    /** Deletes the namespace `<prefix><name>` and waits until it is gone. */
    deleteNamespace(name: string): Promise<void>
    /** `kubectl apply -f -` of a manifest (YAML text) into a namespace of the repository. */
    apply(manifest: string, namespace: string): Promise<void>
    /** Waits until every pod of the namespace is ready; fails with the pod states at the deadline. */
    waitForPods(namespace: string, options?: { readonly timeoutMs?: number }): Promise<void>
}

/** The k3d cluster layer, implemented by `stack/cluster/index.ts` and driven by the stack. */
export interface ClusterApi {
    /** Starts (or finds) the shared cluster for the k3s image and the local pull-through registry. Idempotent, cross-process locked. */
    up(): Promise<void>
    /** Builds every own image by content hash (skipped when the tag exists), pushes it, garbage-collects `src-*` tags keeping the last 3 per image, and answers the run cluster facts. */
    attach(request: { readonly namespace: Namespace; readonly runId: string; readonly root: string; readonly images: ReadonlyArray<OwnImageRequest> }): Promise<RunCluster>
    /** Deletes every namespace of the repository (before a spec file). */
    reset(request: { readonly namespace: Namespace }): Promise<void>
    /** Deletes every namespace of the repository (run end). The cluster stays warm. */
    detach(request: { readonly namespace: Namespace; readonly runId: string }): Promise<void>
    /** Container status of the cluster and registry. */
    status(): Promise<ReadonlyArray<StackContainerStatus>>
    /** Removes the cluster and registry (the CLI `down`). */
    down(options?: { readonly force?: boolean }): Promise<void>
}
