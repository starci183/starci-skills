import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, test } from "node:test"
import { TestWorldError, TestWorldErrorCode } from "../errors"
import { readStackDefinition, resolveImageString, resolveInfraImages, resolveSiblingImage, selectedInfraServices } from "./stack-file"
import { KAFKA_IMAGE } from "../stack/naming"

const roots: string[] = []

const fixture = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "tw-a3-"))
    roots.push(root)
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true })
        writeFileSync(join(root, path), content)
    }
    return root
}

afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const COMPOSE = ".starcistacks/dev/infra/compose"

describe("resolveImageString", () => {
    test("uses the default of ${VAR:-x} and ${VAR-x}", () => {
        assert.equal(resolveImageString("${NIVO_CORE_IMAGE:-nivo/core-dev:local}"), "nivo/core-dev:local")
        assert.equal(resolveImageString("repo/${NAME-app}:${TAG:-1}"), "repo/app:1")
        assert.equal(resolveImageString("redis:7"), "redis:7")
    })
    test("gives up on a variable without a default", () => {
        assert.equal(resolveImageString("${IMAGE}"), undefined)
    })
})

describe("readStackDefinition", () => {
    test("reads compose images, resolves defaults and skips build-only services", () => {
        const root = fixture({
            [`${COMPOSE}/postgres.yaml`]: "services:\n  postgres:\n    image: postgres:16-alpine\n",
            [`${COMPOSE}/application.yml`]: "services:\n  core:\n    image: ${NIVO_CORE_IMAGE:-nivo/core-dev:local}\n  migrate:\n    build:\n      context: .\n",
            [`${COMPOSE}/notes.txt`]: "not yaml",
        })
        const definition = readStackDefinition(root, ".starcistacks/dev")
        assert.deepEqual(Object.keys(definition.services).sort(), ["core", "postgres"])
        assert.equal(definition.services.postgres?.image, "postgres:16-alpine")
        assert.equal(definition.services.core?.image, "nivo/core-dev:local")
        assert.equal(definition.services.postgres?.source, `${COMPOSE}/postgres.yaml`)
    })
    test("falls back to application-stacks components only for names no compose file gave", () => {
        const root = fixture({
            [`${COMPOSE}/redis.yaml`]: "services:\n  redis:\n    image: redis:7-alpine\n",
            ".starcistacks/application-stacks.yaml": "components:\n  redis:\n    image: redis:6\n  qdrant:\n    image: qdrant/qdrant:v1.10.1\n",
        })
        const definition = readStackDefinition(root, ".starcistacks/dev")
        assert.equal(definition.services.redis?.image, "redis:7-alpine")
        assert.equal(definition.services.qdrant?.image, "qdrant/qdrant:v1.10.1")
        assert.equal(definition.services.qdrant?.source, ".starcistacks/application-stacks.yaml")
    })
    test("an absent stack yields no services and broken YAML is a StackDefinition error", () => {
        assert.deepEqual(readStackDefinition(fixture({}), ".starcistacks/dev").services, {})
        const root = fixture({ [`${COMPOSE}/bad.yaml`]: "services: [unclosed\n" })
        assert.throws(() => readStackDefinition(root, ".starcistacks/dev"), (error: unknown) => error instanceof TestWorldError && error.code === TestWorldErrorCode.StackDefinition)
    })
})

const definitionOf = (images: Readonly<Record<string, string>>): { services: Record<string, { image: string; source: string }> } => ({
    services: Object.fromEntries(Object.entries(images).map(([name, image]) => [name, { image, source: "x" }])),
})

describe("resolveInfraImages", () => {
    test("matches every service kind by image repository or compose name", () => {
        const definition = definitionOf({
            db: "pgvector/pgvector:pg16",
            cache: "redis:7-alpine",
            objects: "minio/minio:RELEASE.2024-06-13T22-53-53Z",
            mc: "minio/mc:RELEASE.2024-06-12T14-34-03Z",
            vectors: "qdrant/qdrant:v1.10.1",
            broker: KAFKA_IMAGE,
            idp: "quay.io/keycloak/keycloak:26.0",
        })
        const images = resolveInfraImages({ postgresql: { connections: [] }, redis: {}, minio: {}, qdrant: {}, kafka: {}, keycloak: { realm: "r.json" } }, definition)
        assert.deepEqual(images, [
            { service: "postgresql", image: "pgvector/pgvector:pg16" },
            { service: "redis", image: "redis:7-alpine" },
            { service: "minio", image: "minio/minio:RELEASE.2024-06-13T22-53-53Z" },
            { service: "qdrant", image: "qdrant/qdrant:v1.10.1" },
            { service: "kafka", image: KAFKA_IMAGE },
            { service: "keycloak", image: "quay.io/keycloak/keycloak:26.0" },
        ])
    })
    test("matches by compose service name when the image is a custom build", () => {
        const images = resolveInfraImages({ keycloak: { realm: "r.json" } }, definitionOf({ keycloak: "nivo/keycloak-dev:local" }))
        assert.deepEqual(images, [{ service: "keycloak", image: "nivo/keycloak-dev:local" }])
    })
    test("the declaration image overrides the definition", () => {
        const images = resolveInfraImages({ redis: { image: "valkey/valkey:8" } }, definitionOf({ redis: "redis:7" }))
        assert.deepEqual(images, [{ service: "redis", image: "valkey/valkey:8" }])
    })
    test("faked services are not resolved", () => {
        const stacks = { redis: {}, qdrant: { fakedBy: "qdrant", reason: "no image" } }
        assert.deepEqual(selectedInfraServices(stacks), ["redis"])
        assert.deepEqual(resolveInfraImages(stacks, definitionOf({ redis: "redis:7" })), [{ service: "redis", image: "redis:7" }])
    })
    test("kafka is the ONE pinned Apache Kafka KRaft image: redpanda, cp-kafka and an undigested tag are refused", () => {
        for (const image of ["redpandadata/redpanda:v24.1.1", "confluentinc/cp-kafka:7.6.0", "apache/kafka:4.2.2", "apache/kafka:4.1.0@sha256:" + "0".repeat(64)]) {
            assert.throws(
                () => resolveInfraImages({ kafka: {} }, definitionOf({ kafka: image })),
                (error: unknown) => error instanceof TestWorldError && error.code === TestWorldErrorCode.StackDefinition && error.message.includes(KAFKA_IMAGE) && error.message.includes(image),
                image,
            )
        }
        assert.throws(() => resolveInfraImages({ kafka: { image: "apache/kafka:latest" } }, definitionOf({ kafka: KAFKA_IMAGE })), /pinned by digest/)
        assert.match(KAFKA_IMAGE, /^apache\/kafka:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/)
    })
    test("a missing service names the key, the stack dir and what was found", () => {
        assert.throws(
            () => resolveInfraImages({ kafka: {} }, definitionOf({ redis: "redis:7", "minio-mc": "minio/mc:1" }), ".starcistacks/dev"),
            (error: unknown) =>
                error instanceof TestWorldError &&
                error.code === TestWorldErrorCode.StackDefinition &&
                error.message.includes("stacks.kafka") &&
                error.message.includes(".starcistacks/dev") &&
                error.message.includes("redis (redis:7)") &&
                error.message.includes("minio-mc (minio/mc:1)"),
        )
    })
})

describe("resolveSiblingImage", () => {
    test("declaration image first, then the compose service of that name, else an error", () => {
        const definition = definitionOf({ api: "shop/api" })
        assert.equal(resolveSiblingImage("api", { image: "own/api:2" }, definition), "own/api:2")
        assert.equal(resolveSiblingImage("api", {}, definition), "shop/api")
        assert.throws(() => resolveSiblingImage("billing", {}, definition), /services\.billing.*api/)
    })
})
