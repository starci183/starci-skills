import { tmpdir } from "node:os"
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { containerName, imageKey } from "./naming"
import { namespaceOf, runToken } from "./namespace"

const scratch = mkdtempSync(join(tmpdir(), "starci-tw-ns-"))

const checkout = (name: string, packageName: string | null): string => {
    const root = join(scratch, name)
    mkdirSync(root, { recursive: true })
    if (packageName !== null) writeFileSync(join(root, "package.json"), JSON.stringify({ name: packageName }))
    return root
}

describe("namespaceOf", () => {
    it("slugs the unscoped package name and appends 6 hex of the root hash and the slot", () => {
        const namespace = namespaceOf(checkout("a", "@starci/Todo-App-Be"), 1)
        assert.match(namespace.snake, /^todo_app_be_[0-9a-f]{6}_w1$/)
        assert.equal(namespace.kebab, namespace.snake.replace(/_/g, "-"))
    })

    it("differs per checkout of the same package and is stable per root and slot", () => {
        const one = namespaceOf(checkout("b1", "shop"), 1)
        const two = namespaceOf(checkout("b2", "shop"), 1)
        assert.notEqual(one.snake, two.snake)
        assert.equal(namespaceOf(one.root, 1).snake, one.snake)
    })

    it("gives every slot of one checkout its own namespace (each jest worker owns a slot)", () => {
        const root = checkout("slots", "shop")
        const names = [1, 2, 3, 10].map((slot) => namespaceOf(root, slot).snake)
        assert.equal(new Set(names).size, names.length)
        assert.equal(names[0]?.replace(/_w1$/, ""), names[1]?.replace(/_w2$/, ""))
    })

    it("refuses a slot that is not a positive integer", () => {
        assert.throws(() => namespaceOf(checkout("bad", "shop"), 0), RangeError)
        assert.throws(() => namespaceOf(checkout("bad", "shop"), 1.5), RangeError)
    })

    it("keeps the snake form within 40 characters so <snake>_<connection> fits a Postgres identifier", () => {
        for (const slot of [1, 99]) {
            const namespace = namespaceOf(checkout("c", "a-very-long-package-name-that-goes-on-and-on-forever-and-ever"), slot)
            assert.ok(namespace.snake.length <= 40, namespace.snake)
            assert.ok(namespace.snake.endsWith(`_w${slot}`))
            assert.ok(`${namespace.snake}_expert_portal`.length <= 63)
        }
    })

    it("falls back to the directory name and never starts with a digit", () => {
        assert.match(namespaceOf(checkout("plain", null), 1).snake, /^plain_/)
        assert.match(namespaceOf(checkout("d", "2fa"), 1).snake, /^r_2fa_/)
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
