import { GENESIS_HASH, hashLine } from "./audit-chain.policy"

const line = {
    prevHash: GENESIS_HASH,
    at: new Date("2026-09-30T10:00:00.000Z"),
    action: "task.created",
    target: "t1",
    keyId: "k1",
    actor: "sealed",
}

describe("audit chain policy", () => {
    it("hashes the same line to the same 64-hex digest", () => {
        expect(hashLine(line)).toMatch(/^[0-9a-f]{64}$/)
        expect(hashLine({ ...line })).toBe(hashLine(line))
    })

    it("changes the hash when any covered field changes", () => {
        const base = hashLine(line)
        const variants = [
            { ...line, prevHash: "other" },
            { ...line, at: new Date("2026-09-30T10:00:00.001Z") },
            { ...line, action: "task.deleted" },
            { ...line, target: null },
            { ...line, keyId: "k2" },
            { ...line, actor: "other" },
        ]
        for (const variant of variants) expect(hashLine(variant)).not.toBe(base)
    })
})
