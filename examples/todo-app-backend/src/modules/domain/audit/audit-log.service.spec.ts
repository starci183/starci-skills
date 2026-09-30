import { randomBytes } from "node:crypto"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { GENESIS_HASH, hashLine } from "./audit-chain.policy"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditLogService } from "./audit-log.service"
import { AuditAction } from "./audit.contracts"
import type { VerifyChainResult } from "./audit.contracts"
import { LOCK_AUDIT_CHAIN } from "./persistence/audit.sql"
import { AuditLogLineEntity } from "./persistence/entities/audit-log-line.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")

const chainOf = (count: number, from = 1, start = GENESIS_HASH): Array<AuditLogLineEntity> => {
    const rows: Array<AuditLogLineEntity> = []
    let prevHash = start
    for (let position = 0; position < count; position += 1) {
        const line = { prevHash, at: AT, action: "task.created", target: `t${from + position}`, keyId: "k1", actor: "sealed" }
        const hash = hashLine(line)
        rows.push({ id: String(from + position), ...line, hash })
        prevHash = hash
    }
    return rows
}

const walk = (rows: Array<AuditLogLineEntity>): Promise<VerifyChainResult> =>
    new AuditLogService(
        mockEntityManager({ find: jest.fn().mockResolvedValueOnce(rows).mockResolvedValue([]) }),
        new AuditKeystoreService(mockEntityManager()),
    ).verifyChain()

interface AppendRig {
    readonly store: AuditKeystoreService
    readonly manager: ReturnType<typeof mockEntityManager>
    readonly saved: Array<AuditLogLineEntity>
    readonly key: Buffer
}

describe("AuditLogService.append", () => {
    const setup = (existing: Array<AuditLogLineEntity>): AppendRig => {
        const key = randomBytes(32)
        const store = new AuditKeystoreService(mockEntityManager())
        jest.spyOn(store, "getOrCreateKey").mockResolvedValue({ keyId: "k1", key })
        const saved: Array<AuditLogLineEntity> = []
        const manager = mockEntityManager({
            query: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue(existing.slice(-1)),
            save: jest.fn().mockImplementation((_target: unknown, entity: AuditLogLineEntity) => {
                saved.push(entity)
                return Promise.resolve({ ...entity, id: "9" })
            }),
        })
        return { store, manager, saved, key }
    }

    it("takes the chain lock, seals the actor under the person key and chains onto the last hash", async () => {
        const existing = chainOf(2)
        const { store, manager, saved, key } = setup(existing)
        const result = await new AuditLogService(mockEntityManager(), store).append({
            manager,
            actorId: "p1",
            action: AuditAction.TaskCompleted,
            target: "t1",
            at: AT,
        })
        expect(result).toEqual({ lineId: "9" })
        expect(manager.query).toHaveBeenCalledWith(LOCK_AUDIT_CHAIN, [])
        expect(manager.find).toHaveBeenCalledWith(AuditLogLineEntity, { order: { id: "DESC" }, take: 1 })
        const line = saved[0]
        expect(line).toMatchObject({ at: AT, action: "task.completed", target: "t1", keyId: "k1", prevHash: existing[1]?.hash })
        expect(line?.actor).not.toContain("p1")
        expect(store.unseal(key, line?.actor ?? "")).toEqual({ opened: true, plaintext: "p1" })
        expect(line?.hash).toBe(line ? hashLine(line) : "")
    })

    it("starts the chain from the genesis marker when the log is empty", async () => {
        const { store, manager, saved } = setup([])
        await new AuditLogService(mockEntityManager(), store).append({
            manager,
            actorId: "p1",
            action: AuditAction.SignedIn,
            target: null,
            at: AT,
        })
        expect(saved[0]).toMatchObject({ prevHash: GENESIS_HASH, target: null })
    })
})

describe("AuditLogService.verifyChain", () => {
    it("reads an untouched chain as valid", async () => {
        await expect(walk(chainOf(4))).resolves.toEqual({ valid: true, totalLines: 4, break: null })
    })

    it("reads an empty log as valid", async () => {
        await expect(walk([])).resolves.toEqual({ valid: true, totalLines: 0, break: null })
    })

    it("reports a content mismatch at the position of a changed field", async () => {
        const rows = chainOf(4)
        const changed = rows.map((row, index) => (index === 2 ? { ...row, action: "task.deleted" } : row))
        await expect(walk(changed)).resolves.toMatchObject({ valid: false, break: { index: 2, reason: "content-mismatch" } })
    })

    it("reports a broken link at the line that followed a removed one", async () => {
        const rows = chainOf(4)
        const removed = rows.filter((_row, index) => index !== 1)
        await expect(walk(removed)).resolves.toMatchObject({ valid: false, break: { index: 1, reason: "broken-prev-hash" } })
    })

    it("walks the chain in bounded batches, carrying the link across a batch", async () => {
        const first = chainOf(LIST_ROWS_MAX)
        const tail = first.at(-1)?.hash ?? GENESIS_HASH
        const second = chainOf(3, LIST_ROWS_MAX + 1, tail)
        const find = jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
        const result = await new AuditLogService(mockEntityManager({ find }), new AuditKeystoreService(mockEntityManager())).verifyChain()
        expect(result).toEqual({ valid: true, totalLines: LIST_ROWS_MAX + 3, break: null })
        expect(find).toHaveBeenCalledTimes(2)
        expect(find).toHaveBeenNthCalledWith(1, AuditLogLineEntity, expect.objectContaining({ take: LIST_ROWS_MAX }))
    })
})

describe("AuditLogService reads", () => {
    const sealedRows = (store: AuditKeystoreService, key: Buffer, actors: ReadonlyArray<string>): Array<AuditLogLineEntity> =>
        actors.map((actor, index) => ({
            id: String(index + 1),
            at: AT,
            action: "task.created",
            target: `t${index}`,
            keyId: "k1",
            actor: store.seal(key, actor),
            prevHash: GENESIS_HASH,
            hash: "h",
        }))

    it("reads a person own lines oldest first through their key id, resolved and without the key id", async () => {
        const key = randomBytes(32)
        const store = new AuditKeystoreService(mockEntityManager())
        jest.spyOn(store, "getKeyIdForPerson").mockResolvedValue("k1")
        jest.spyOn(store, "getKeyMaterials").mockResolvedValue(new Map([["k1", key]]))
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue(sealedRows(store, key, ["p1", "p1"])) })
        const lines = await new AuditLogService(entityManager, store).findLinesForPerson("p1")
        expect(entityManager.find).toHaveBeenCalledWith(AuditLogLineEntity, {
            where: { keyId: "k1" },
            order: { id: "ASC" },
            take: LIST_ROWS_MAX,
        })
        expect(lines).toEqual([
            { at: AT, action: "task.created", target: "t0", actor: "p1", tombstoned: false },
            { at: AT, action: "task.created", target: "t1", actor: "p1", tombstoned: false },
        ])
    })

    it("reads nothing for a person without a key, and never touches the log", async () => {
        const store = new AuditKeystoreService(mockEntityManager())
        jest.spyOn(store, "getKeyIdForPerson").mockResolvedValue(null)
        const entityManager = mockEntityManager()
        await expect(new AuditLogService(entityManager, store).findLinesForPerson("p1")).resolves.toEqual([])
        expect(entityManager.find).not.toHaveBeenCalled()
    })

    it("tombstones a line whose key is gone and a line the live key no longer opens", async () => {
        const key = randomBytes(32)
        const store = new AuditKeystoreService(mockEntityManager())
        const rows = sealedRows(store, key, ["p1", "p2"])
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue(rows) })
        const service = new AuditLogService(entityManager, store)
        jest.spyOn(store, "getKeyMaterials").mockResolvedValueOnce(new Map())
        const gone = await service.readChain({ action: null, target: null })
        expect(gone.map((line) => [line.actor, line.tombstoned])).toEqual([[null, true], [null, true]])
        jest.spyOn(store, "getKeyMaterials").mockResolvedValueOnce(new Map([["k1", randomBytes(32)]]))
        const wrongKey = await service.readChain({ action: null, target: null })
        expect(wrongKey.every((line) => line.tombstoned)).toBe(true)
    })

    it("reads the whole chain with one key lookup, narrowed by action and target in the query", async () => {
        const key = randomBytes(32)
        const store = new AuditKeystoreService(mockEntityManager())
        const materials = jest.spyOn(store, "getKeyMaterials").mockResolvedValue(new Map([["k1", key]]))
        const entityManager = mockEntityManager({ find: jest.fn().mockResolvedValue(sealedRows(store, key, ["p1", "p2"])) })
        const service = new AuditLogService(entityManager, store)
        const lines = await service.readChain({ action: "task.created", target: "t1" })
        expect(entityManager.find).toHaveBeenCalledWith(AuditLogLineEntity, {
            where: { action: "task.created", target: "t1" },
            order: { id: "ASC" },
            take: LIST_ROWS_MAX,
        })
        expect(lines.map((line) => line.actor)).toEqual(["p1", "p2"])
        expect(materials).toHaveBeenCalledTimes(1)
        expect(materials).toHaveBeenCalledWith({ keyIds: ["k1"] })
    })
})
