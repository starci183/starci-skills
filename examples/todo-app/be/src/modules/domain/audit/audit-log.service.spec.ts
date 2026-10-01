import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { MoreThan } from "typeorm"
import { GENESIS_HASH, hashLine } from "./audit-chain.policy"
import {
    AUDIT_AT,
    appendDeliveredInput,
    appendLineInput,
    auditLogLineRow,
    readAuditLogInput,
} from "@tests/fixtures/builders/audit.builder"
import { AuditKeystoreService } from "./audit-keystore.service"
import { AuditLogService } from "./audit-log.service"
import { AuditAction } from "./audit.contracts"
import { AuditErrorCode } from "./errors/audit.error"
import { LOCK_AUDIT_CHAIN } from "./persistence/audit.sql"
import { AuditLogLineEntity } from "./persistence/entities/audit-log-line.entity"

const AT = new Date(AUDIT_AT)
const KEY = Buffer.alloc(32, 7)
const SAVED_LINE = auditLogLineRow({ id: "9", action: "task.completed", hash: "h9" })

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const keystore = mock<AuditKeystoreService>()
    const inbox = mock<Inbox>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuditLogService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AuditKeystoreService, useValue: keystore },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { service: moduleRef.get(AuditLogService), em, keystore, inbox }
}

/** A chain of `count` linked rows; row ids start at `from`, and the first row links to `start`. */
const chainOf = (count: number, from = 1, start = GENESIS_HASH): Array<AuditLogLineEntity> => {
    const rows: Array<AuditLogLineEntity> = []
    let prevHash = start
    for (let position = 0; position < count; position += 1) {
        const line = {
            prevHash,
            at: AT,
            action: "task.created",
            target: `t${from + position}`,
            keyId: "k1",
            actor: "sealed",
        }
        const hash = hashLine(line)
        rows.push(auditLogLineRow({ id: String(from + position), ...line, hash }))
        prevHash = hash
    }
    return rows
}

/** Rows as stored, whose actor is `sealed:<person>`; the keystore double opens them for key k1 only. */
const sealedRows = (actors: ReadonlyArray<string>, keyId = "k1"): Array<AuditLogLineEntity> =>
    actors.map((actor, index) =>
        auditLogLineRow({ id: String(index + 1), target: `t${index}`, keyId, actor: `sealed:${actor}`, hash: "h" }),
    )

const opensSealedActors = (keystore: ReturnType<typeof mock<AuditKeystoreService>>): void => {
    keystore.unseal.mockImplementation((_key, sealed) =>
        sealed.startsWith("sealed:")
            ? { opened: true, plaintext: sealed.slice("sealed:".length) }
            : { opened: false, cause: new Error("bad") },
    )
}

describe("AuditLogService", () => {
    describe("append", () => {
        it("takes the chain lock, seals the actor under the person key and chains onto the last hash", async () => {
            const { service, keystore } = await build()
            const tail = chainOf(2).slice(-1)
            const lastHash = tail[0]?.hash ?? ""
            const manager = mockEntityManager({
                query: [LOCK_AUDIT_CHAIN, []],
                find: [AuditLogLineEntity, tail],
                save: [AuditLogLineEntity, SAVED_LINE],
            })
            keystore.getOrCreateKey.mockResolvedValue({ keyId: "k1", key: KEY })
            keystore.seal.mockReturnValue("sealed-p1")

            await expect(service.append({ manager, ...appendLineInput() })).resolves.toEqual({ lineId: "9" })

            const line = {
                prevHash: lastHash,
                at: AT,
                action: "task.completed",
                target: "t1",
                keyId: "k1",
                actor: "sealed-p1",
            }
            expect(manager.query).toHaveBeenCalledWith(LOCK_AUDIT_CHAIN, [])
            expect(keystore.getOrCreateKey).toHaveBeenCalledWith({ manager, personId: "p1", at: AT })
            expect(keystore.seal).toHaveBeenCalledWith(KEY, "p1")
            expect(manager.find).toHaveBeenCalledWith(AuditLogLineEntity, { order: { id: "DESC" }, take: 1 })
            expect(manager.save).toHaveBeenCalledWith(AuditLogLineEntity, { ...line, hash: hashLine(line) })
        })

        it("starts the chain from the genesis marker when the log is empty", async () => {
            const { service, keystore } = await build()
            const manager = mockEntityManager({
                query: [LOCK_AUDIT_CHAIN, []],
                find: [AuditLogLineEntity, []],
                save: [AuditLogLineEntity, SAVED_LINE],
            })
            keystore.getOrCreateKey.mockResolvedValue({ keyId: "k1", key: KEY })
            keystore.seal.mockReturnValue("sealed-p1")

            await service.append({ manager, ...appendLineInput({ action: AuditAction.SignedIn, target: null }) })

            const line = {
                prevHash: GENESIS_HASH,
                at: AT,
                action: "login.signed-in",
                target: null,
                keyId: "k1",
                actor: "sealed-p1",
            }
            expect(manager.save).toHaveBeenCalledWith(AuditLogLineEntity, { ...line, hash: hashLine(line) })
        })
    })

    describe("appendDelivered", () => {
        const delivered = appendDeliveredInput()

        it("claims the event, then appends the line in its own committed transaction", async () => {
            const { service, em, keystore, inbox } = await build(
                mockEntityManager({
                    query: [LOCK_AUDIT_CHAIN, []],
                    find: [AuditLogLineEntity, []],
                    save: [AuditLogLineEntity, SAVED_LINE],
                }),
            )
            const tx = fakeTransaction(em)
            inbox.claim.mockResolvedValue(true)
            keystore.getOrCreateKey.mockResolvedValue({ keyId: "k1", key: KEY })
            keystore.seal.mockReturnValue("sealed-p1")

            await expect(service.appendDelivered(delivered)).resolves.toEqual({ lineId: "9" })

            expect(inbox.claim).toHaveBeenCalledWith("audit.append", "e1")
            expect(tx.outcomes).toEqual(["commit"])
            expect(tx.committedWrites).toEqual([
                {
                    method: "save",
                    args: [AuditLogLineEntity, expect.objectContaining({ actor: "sealed-p1", target: "t1" })],
                },
            ])
            expect(inbox.release).not.toHaveBeenCalled()
        })

        it("does nothing for an event that was already claimed", async () => {
            const { service, em, inbox } = await build()
            const tx = fakeTransaction(em)
            inbox.claim.mockResolvedValue(false)

            await expect(service.appendDelivered(delivered)).resolves.toEqual({ lineId: null })

            expect(tx.outcomes).toEqual([])
            expect(inbox.release).not.toHaveBeenCalled()
        })

        it("releases the claim, rolls back and rethrows when the append fails", async () => {
            const { service, em, keystore, inbox } = await build(
                mockEntityManager({
                    query: [LOCK_AUDIT_CHAIN, []],
                    find: [AuditLogLineEntity, []],
                    save: [AuditLogLineEntity, SAVED_LINE],
                }),
            )
            const tx = fakeTransaction(em)
            inbox.claim.mockResolvedValue(true)
            inbox.release.mockResolvedValue(undefined)
            keystore.getOrCreateKey.mockRejectedValue(new Error("database down"))

            await expect(service.appendDelivered(delivered)).rejects.toThrow("database down")

            expect(tx.outcomes).toEqual(["rollback"])
            expect(tx.committedWrites).toEqual([])
            expect(inbox.release).toHaveBeenCalledWith("audit.append", "e1")
        })
    })

    describe("verifyChain", () => {
        it("reads an untouched chain as valid", async () => {
            const { service } = await build(mockEntityManager({ find: [AuditLogLineEntity, chainOf(4)] }))

            await expect(service.verifyChain()).resolves.toEqual({ valid: true, totalLines: 4, break: null })
        })

        it("reads an empty log as valid", async () => {
            const { service } = await build(mockEntityManager({ find: [AuditLogLineEntity, []] }))

            await expect(service.verifyChain()).resolves.toEqual({ valid: true, totalLines: 0, break: null })
        })

        it("reports a content mismatch at the position of a changed field", async () => {
            const changed = chainOf(4).map((row, index) => (index === 2 ? { ...row, action: "task.deleted" } : row))
            const { service } = await build(mockEntityManager({ find: [AuditLogLineEntity, changed] }))

            await expect(service.verifyChain()).resolves.toEqual({
                valid: false,
                totalLines: 2,
                break: { index: 2, reason: "content-mismatch" },
            })
        })

        it("reports a broken link at the line that followed a removed one", async () => {
            const removed = chainOf(4).filter((_row, index) => index !== 1)
            const { service } = await build(mockEntityManager({ find: [AuditLogLineEntity, removed] }))

            await expect(service.verifyChain()).resolves.toEqual({
                valid: false,
                totalLines: 1,
                break: { index: 1, reason: "broken-prev-hash" },
            })
        })

        it("walks the chain in bounded batches, carrying the link across a batch", async () => {
            const first = chainOf(LIST_ROWS_MAX)
            const second = chainOf(3, LIST_ROWS_MAX + 1, first.at(-1)?.hash)
            const { service, em } = await build(
                mockEntityManager({
                    find: [
                        [AuditLogLineEntity, first],
                        [AuditLogLineEntity, second],
                    ],
                }),
            )

            await expect(service.verifyChain()).resolves.toEqual({
                valid: true,
                totalLines: LIST_ROWS_MAX + 3,
                break: null,
            })

            expect(em.find).toHaveBeenCalledTimes(2)
            expect(em.find).toHaveBeenNthCalledWith(1, AuditLogLineEntity, {
                where: {},
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
            expect(em.find).toHaveBeenNthCalledWith(2, AuditLogLineEntity, {
                where: { id: MoreThan(String(LIST_ROWS_MAX)) },
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })

        it("stops after a full batch that is followed by an empty one", async () => {
            const { service, em } = await build(
                mockEntityManager({
                    find: [
                        [AuditLogLineEntity, chainOf(LIST_ROWS_MAX)],
                        [AuditLogLineEntity, []],
                    ],
                }),
            )

            await expect(service.verifyChain()).resolves.toEqual({
                valid: true,
                totalLines: LIST_ROWS_MAX,
                break: null,
            })

            expect(em.find).toHaveBeenCalledTimes(2)
        })
    })

    describe("readChain", () => {
        it("reads the whole chain oldest first with one key lookup, narrowed by action and target in the query", async () => {
            const { service, em, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1", "p2"])] }),
            )
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            opensSealedActors(keystore)

            const lines = await service.readChain({ action: "task.created", target: "t1" })

            expect(em.find).toHaveBeenCalledWith(AuditLogLineEntity, {
                where: { action: "task.created", target: "t1" },
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
            expect(lines.map((line) => line.actor)).toEqual(["p1", "p2"])
            expect(keystore.getKeyMaterials).toHaveBeenCalledTimes(1)
            expect(keystore.getKeyMaterials).toHaveBeenCalledWith({ keyIds: ["k1"] })
        })

        it("does not narrow the query when no filter is set", async () => {
            const { service, em, keystore } = await build(mockEntityManager({ find: [AuditLogLineEntity, []] }))
            keystore.getKeyMaterials.mockResolvedValue(new Map())

            await expect(service.readChain({ action: null, target: null })).resolves.toEqual([])

            expect(em.find).toHaveBeenCalledWith(AuditLogLineEntity, {
                where: {},
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })

        it("tombstones a line whose key is gone", async () => {
            const { service, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1"])] }),
            )
            keystore.getKeyMaterials.mockResolvedValue(new Map())

            await expect(service.readChain({ action: null, target: null })).resolves.toEqual([
                { at: AT, action: "task.created", target: "t0", actor: null, tombstoned: true },
            ])
            expect(keystore.unseal).not.toHaveBeenCalled()
        })

        it("tombstones a line the live key no longer opens", async () => {
            const { service, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1"])] }),
            )
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            keystore.unseal.mockReturnValue({ opened: false, cause: new Error("wrong key") })

            await expect(service.readChain({ action: null, target: null })).resolves.toEqual([
                { at: AT, action: "task.created", target: "t0", actor: null, tombstoned: true },
            ])
        })
    })

    describe("findLinesForPerson", () => {
        it("reads the own lines oldest first through the key id, resolved and without the key id", async () => {
            const { service, em, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1", "p1"])] }),
            )
            keystore.getKeyIdForPerson.mockResolvedValue("k1")
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            opensSealedActors(keystore)

            const lines = await service.findLinesForPerson("p1")

            expect(keystore.getKeyIdForPerson).toHaveBeenCalledWith({ personId: "p1" })
            expect(em.find).toHaveBeenCalledWith(AuditLogLineEntity, {
                where: { keyId: "k1" },
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
            expect(lines).toEqual([
                { at: AT, action: "task.created", target: "t0", actor: "p1", tombstoned: false },
                { at: AT, action: "task.created", target: "t1", actor: "p1", tombstoned: false },
            ])
        })

        it("reads nothing for a person without a key and never touches the log", async () => {
            const { service, em, keystore } = await build()
            keystore.getKeyIdForPerson.mockResolvedValue(null)

            await expect(service.findLinesForPerson("p1")).resolves.toEqual([])

            expect(em.find).not.toHaveBeenCalled()
        })
    })

    describe("readAs", () => {
        it("refuses a reader without an identity before any line is touched", async () => {
            const { service, em, keystore } = await build()

            await expect(service.readAs(readAuditLogInput({ principalId: "", roles: ["admin"] }))).resolves.toBeRefused(
                AuditErrorCode.OperatorRoleNotAuthorized,
            )

            expect(em.find).not.toHaveBeenCalled()
            expect(keystore.getKeyIdForPerson).not.toHaveBeenCalled()
        })

        it("lets an administrator read the whole chain narrowed by the filter, without the actor", async () => {
            const { service, em, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1", "p2"])] }),
            )
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            opensSealedActors(keystore)

            await expect(
                service.readAs(
                    readAuditLogInput({ principalId: "boss", roles: ["admin"], action: "task.created", target: "t1" }),
                ),
            ).resolves.toSucceedWith({
                lines: [
                    { at: AT, action: "task.created", target: "t0" },
                    { at: AT, action: "task.created", target: "t1" },
                ],
            })

            expect(em.find).toHaveBeenCalledWith(
                AuditLogLineEntity,
                expect.objectContaining({ where: { action: "task.created", target: "t1" } }),
            )
            expect(keystore.getKeyIdForPerson).not.toHaveBeenCalled()
        })

        it("lets everyone else read exactly their own lines and ignores the filter", async () => {
            const { service, em, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1"])] }),
            )
            keystore.getKeyIdForPerson.mockResolvedValue("k1")
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            opensSealedActors(keystore)

            await expect(
                service.readAs(readAuditLogInput({ action: "task.deleted", target: "other" })),
            ).resolves.toSucceedWith({ lines: [{ at: AT, action: "task.created", target: "t0" }] })

            expect(keystore.getKeyIdForPerson).toHaveBeenCalledWith({ personId: "p1" })
            expect(em.find).toHaveBeenCalledWith(
                AuditLogLineEntity,
                expect.objectContaining({ where: { keyId: "k1" } }),
            )
        })
    })

    describe("exportFor", () => {
        it("exports the own lines without the actor", async () => {
            const { service, keystore } = await build(
                mockEntityManager({ find: [AuditLogLineEntity, sealedRows(["p1"])] }),
            )
            keystore.getKeyIdForPerson.mockResolvedValue("k1")
            keystore.getKeyMaterials.mockResolvedValue(new Map([["k1", KEY]]))
            opensSealedActors(keystore)

            await expect(service.exportFor("p1")).resolves.toEqual({
                lines: [{ at: AT, action: "task.created", target: "t0" }],
            })
        })

        it("exports nothing once the key was destroyed by a completed erasure", async () => {
            const { service, em, keystore } = await build()
            keystore.getKeyIdForPerson.mockResolvedValue(null)

            await expect(service.exportFor("p1")).resolves.toEqual({ lines: [] })

            expect(em.find).not.toHaveBeenCalled()
        })
    })
})
