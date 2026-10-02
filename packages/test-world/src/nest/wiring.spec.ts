import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { RunContext } from "../jest/context"
import { buildWiring, secretOf } from "./wiring"

const context = (overrides: Partial<RunContext["infra"]> = {}): RunContext => ({
    slot: 1,
    runId: "ab12",
    namespace: { snake: "shop_a1b2c3", kebab: "shop-a1b2c3", root: "/repo" },
    secretSeed: "seed",
    infra: {
        toxiproxyApi: "http://127.0.0.1:8474",
        postgresql: {
            host: "127.0.0.1",
            port: 30100,
            directPort: 55000,
            proxy: "ab12-postgresql",
            image: "postgres:16",
            container: "starci-ts-postgresql-x",
            user: "postgres",
            password: "p@ss/word",
            databases: { primary: "shop_a1b2c3_primary", order: "shop_a1b2c3_order" },
            schemas: {},
        },
        keycloak: {
            host: "127.0.0.1",
            port: 30101,
            directPort: 55001,
            proxy: "ab12-keycloak",
            image: "quay.io/keycloak/keycloak:26.0",
            container: "starci-ts-keycloak-x",
            realm: "shop-a1b2c3-shop",
            clientId: "shop-api",
            adminUser: "admin",
            adminPassword: "admin",
            userIds: {},
            clientSecrets: { "admin-reader": "generated-secret" },
        },
        ...overrides,
    },
    fakes: {
        controlUrl: "http://127.0.0.1:1/control",
        entries: {
            sepay: { url: "http://127.0.0.1:4000", host: "127.0.0.1", port: 4000, values: { apiKey: "k" }, endpoints: { webhook: "http://127.0.0.1:4000/w" } },
        },
    },
    services: {},
    directories: { run: mkdtempSync(join(tmpdir(), "tw-wiring-")) },
    keepTables: {},
    root: "/repo",
})

test("databases are wired through the proxy port with the namespaced database names and an escaped url", () => {
    const wiring = buildWiring(context())
    assert.equal(wiring.db["primary"]?.database, "shop_a1b2c3_primary")
    assert.equal(wiring.db["primary"]?.port, 30100)
    assert.equal(wiring.db["primary"]?.url, "postgres://postgres:p%40ss%2Fword@127.0.0.1:30100/shop_a1b2c3_primary")
    assert.equal(Object.keys(wiring.db).length, 2)
})

test("a schema-per-context connection is wired with its own login and schema in the shared database; the others use public", () => {
    const base = context()
    const postgresql = base.infra.postgresql
    assert.ok(postgresql !== undefined)
    const wiring = buildWiring({
        ...base,
        infra: {
            ...base.infra,
            postgresql: {
                ...postgresql,
                databases: { identity: "shop_a1b2c3_core", order: "shop_a1b2c3_core", primary: "shop_a1b2c3_primary" },
                schemas: { identity: { schema: "identity", user: "shop_a1b2c3_identity", password: "s3cr/t" }, order: { schema: "ordering", user: "shop_a1b2c3_order", password: "x" } },
            },
        },
    })
    assert.equal(wiring.db["identity"]?.database, "shop_a1b2c3_core")
    assert.equal(wiring.db["identity"]?.schema, "identity")
    assert.equal(wiring.db["identity"]?.user, "shop_a1b2c3_identity")
    assert.equal(wiring.db["identity"]?.url, "postgres://shop_a1b2c3_identity:s3cr%2Ft@127.0.0.1:30100/shop_a1b2c3_core")
    assert.equal(wiring.db["order"]?.schema, "ordering")
    assert.equal(wiring.db["primary"]?.schema, "public")
    assert.equal(wiring.db["primary"]?.user, "postgres")
})

test("kafka wires the slot's topics, consumer groups and client ids under one prefix", () => {
    const base = context()
    const wiring = buildWiring({
        ...base,
        infra: {
            ...base.infra,
            kafka: { host: "127.0.0.1", port: 30105, directPort: 9092, proxy: "kafka-k-s2", image: "apache/kafka", container: "c", listener: 2, topicPrefix: "shop-a1b2c3-w2.", groupPrefix: "shop-a1b2c3-w2.", topics: { orders: "shop-a1b2c3-w2.orders" } },
        },
    })
    assert.deepEqual(wiring.kafka.brokers, ["127.0.0.1:30105"])
    assert.equal(wiring.kafka.topic("orders"), "shop-a1b2c3-w2.orders")
    assert.equal(wiring.kafka.topic("audit"), "shop-a1b2c3-w2.audit")
    assert.equal(wiring.kafka.group("billing"), "shop-a1b2c3-w2.billing")
    assert.equal(wiring.kafka.clientId("api"), "shop-a1b2c3-w2.api")
})

test("keycloak urls derive from the proxied base and the namespaced realm", () => {
    const { keycloak } = buildWiring(context())
    assert.equal(keycloak.issuer, "http://127.0.0.1:30101/realms/shop-a1b2c3-shop")
    assert.equal(keycloak.tokenUrl, "http://127.0.0.1:30101/realms/shop-a1b2c3-shop/protocol/openid-connect/token")
    assert.equal(keycloak.jwksUrl, "http://127.0.0.1:30101/realms/shop-a1b2c3-shop/protocol/openid-connect/certs")
    assert.equal(keycloak.clientId, "shop-api")
    assert.equal(keycloak.clientSecret("admin-reader"), "generated-secret")
    assert.throws(() => keycloak.clientSecret("shop-api"), /TEST_WORLD_NOT_DECLARED.*no confidential client shop-api/)
})

test("a service the declaration does not run throws NotDeclared when read, never undefined", () => {
    const wiring = buildWiring(context())
    assert.throws(() => wiring.redis, /TEST_WORLD_NOT_DECLARED/)
    assert.throws(() => wiring.minio, /minio/)
    assert.throws(() => wiring.cluster, /k3d/)
})

test("apps get their reserved port and the host the caller names", () => {
    const inHost = buildWiring(context(), { appPorts: { api: 4001 } })
    assert.deepEqual(inHost.apps["api"], { port: 4001, url: "http://127.0.0.1:4001" })
    const inContainer = buildWiring(context(), { appPorts: { api: 4001 }, host: "host.docker.internal" })
    assert.equal(inContainer.apps["api"]?.url, "http://host.docker.internal:4001")
    assert.equal(inContainer.db["primary"]?.host, "host.docker.internal")
    assert.equal(inContainer.fake["sepay"]?.url, "http://host.docker.internal:4000")
    assert.equal(inContainer.fake["sepay"]?.endpoints["webhook"], "http://host.docker.internal:4000/w")
})

test("redis is leased its own db index and minio and qdrant carry their prefixes", () => {
    const wiring = buildWiring(
        context({
            redis: { host: "127.0.0.1", port: 30102, directPort: 55002, proxy: "p", image: "redis:7", container: "c", db: 7 },
            minio: { host: "127.0.0.1", port: 30103, directPort: 55003, proxy: "p", image: "m", container: "c", accessKey: "a", secretKey: "s", bucketPrefix: "shop-a1b2c3-", buckets: { uploads: "shop-a1b2c3-uploads" } },
            qdrant: { host: "127.0.0.1", port: 30104, directPort: 55004, proxy: "p", image: "q", container: "c", collectionPrefix: "shop_a1b2c3_" },
        }),
    )
    assert.equal(wiring.redis.url, "redis://127.0.0.1:30102/7")
    assert.equal(wiring.minio.bucket("uploads"), "shop-a1b2c3-uploads")
    assert.equal(wiring.minio.bucket("other"), "shop-a1b2c3-other")
    assert.equal(wiring.qdrant.collection("docs"), "shop_a1b2c3_docs")
})

test("secrets are stable per label within a run and differ across labels and seeds", () => {
    const wiring = buildWiring(context())
    assert.equal(wiring.secret("signing"), wiring.secret("signing"))
    assert.notEqual(wiring.secret("signing"), wiring.secret("other"))
    assert.equal(wiring.secret("signing"), secretOf("seed", "signing"))
    assert.notEqual(secretOf("seed-2", "signing"), wiring.secret("signing"))
})

test("run directories are created under the run directory and stable per name", () => {
    const wiring = buildWiring(context())
    const first = wiring.directory("uploads")
    assert.equal(wiring.directory("uploads"), first)
    assert.notEqual(wiring.directory("exports"), first)
})
