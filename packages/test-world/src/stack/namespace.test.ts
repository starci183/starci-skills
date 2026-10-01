import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { containerName, imageKey } from "./naming"
import { namespaceOf, runToken } from "./namespace"

mkdirSync("D:/starci-tmp/hfs/devin/tw-a1", { recursive: true })
const scratch = mkdtempSync(join("D:/starci-tmp/hfs/devin/tw-a1", "ns-"))

const checkout = (name: string, packageName: string | null): string => {
    const root = join(scratch, name)
    mkdirSync(root, { recursive: true })
    if (packageName !== null) writeFileSync(join(root, "package.json"), JSON.stringify({ name: packageName }))
    return root
}

describe("namespaceOf", () => {
    it("slugs the unscoped package name and appends 6 hex of the root hash", () => {
        const namespace = namespaceOf(checkout("a", "@starci/Nivo-Backend"))
        assert.match(namespace.snake, /^nivo_backend_[0-9a-f]{6}$/)
        assert.equal(namespace.kebab, namespace.snake.replace(/_/g, "-"))
    })

    it("differs per checkout of the same package and is stable per root", () => {
        const one = namespaceOf(checkout("b1", "shop"))
        const two = namespaceOf(checkout("b2", "shop"))
        assert.notEqual(one.snake, two.snake)
        assert.equal(namespaceOf(one.root).snake, one.snake)
    })

    it("keeps the snake form within 40 characters so <snake>_<connection> fits a Postgres identifier", () => {
        const namespace = namespaceOf(checkout("c", "a-very-long-package-name-that-goes-on-and-on-forever-and-ever"))
        assert.ok(namespace.snake.length <= 40)
        assert.ok(`${namespace.snake}_expert_academy`.length <= 63)
    })

    it("falls back to the directory name and never starts with a digit", () => {
        assert.match(namespaceOf(checkout("plain", null)).snake, /^plain_/)
        assert.match(namespaceOf(checkout("d", "2fa")).snake, /^r_2fa_/)
    })
})

describe("naming", () => {
    it("keys containers by image: same image shares, another version gets its own", () => {
        assert.equal(containerName("postgresql", "pgvector/pgvector:pg16"), containerName("postgresql", "pgvector/pgvector:pg16"))
        assert.notEqual(containerName("postgresql", "pgvector/pgvector:pg16"), containerName("postgresql", "pgvector/pgvector:pg17"))
        assert.match(containerName("redis", "redis:7"), /^starci-ts-redis-[0-9a-f]{8}$/)
        assert.equal(imageKey("x").length, 8)
    })

    it("makes run tokens of the requested size", () => {
        assert.match(runToken(), /^[0-9a-f]{8}$/)
        assert.match(runToken(2), /^[0-9a-f]{4}$/)
    })
})
