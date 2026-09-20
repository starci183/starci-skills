import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AuditErasureRequestEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-erasure-request.entity"
import {
    AuditLogLineEntity 
} from "@modules/platform/databases/postgresql/primary/entities/audit-log-line.entity"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakeAuditEntityManager 
} from "./testing/fake-audit-entity-manager"
import {
    AuditKeystoreService, SYSTEM_ACTOR_ID 
} from "./audit-keystore.service"
import {
    AuditLogService 
} from "./audit-log.service"
import {
    AuditErasureService 
} from "./audit-erasure.service"

const build = async () => {
    const manager = createFakeAuditEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuditKeystoreService,
            AuditLogService,
            AuditErasureService,
            {
                provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: manager 
            },
        ],
    }).compile()
    return {
        moduleRef,
        manager,
        keystore: moduleRef.get(AuditKeystoreService),
        log: moduleRef.get(AuditLogService),
        erasure: moduleRef.get(AuditErasureService),
    }
}

describe("AuditErasureService",
    () => {
        let moduleRef: TestingModule | undefined

        afterEach(async () => {
            await moduleRef?.close()
            moduleRef = undefined
        })

        it("sds.audit.erasure-request t-request/t-verify: request() creates the row directly verified, since the caller is always the subject",
            async () => {
                const built = await build()
                moduleRef = built.moduleRef

                const record = await built.erasure.request("person-1")

                expect(record.state).toBe("verified")
                expect(record.personId).toBe("person-1")
                expect(record.verifiedAt).not.toBeNull()
            })

        it("sds.audit.erasure-request t-verify as its own second round: confirm() on the still-pending request verifies it for its subject",
            async () => {
                const built = await build()
                moduleRef = built.moduleRef
                await built.log.append("person-1",
                    "sign-in",
                    null) // a line first, so the subject has a key to keep
                const requested = await (built.erasure as unknown as {
      tRequest(personId: string): Promise<{ requestId: string }>;
    }).tRequest("person-1") // the state tRequest leaves behind, before chained verification

                const verified = await built.erasure.confirm(requested.requestId,
                    "person-1")

                expect(verified.state).toBe("verified")
                expect(verified.personId).toBe("person-1")
                expect(verified.verifiedAt).not.toBeNull()
                expect(await built.keystore.getKeyIdForPerson("person-1")).not.toBeNull() // t-verify touches no keys
            })

        it("sds.audit.erasure-request t-verify: confirm() by a stranger of a still-pending request refuses it (t-refuse), and nothing about the subject's keys is touched",
            async () => {
                const built = await build()
                moduleRef = built.moduleRef
                await built.log.append("person-1",
                    "sign-in",
                    null)
                const requested = await (built.erasure as unknown as {
      tRequest(personId: string): Promise<{ requestId: string }>;
    }).tRequest("person-1")
                const keyIdBefore = await built.keystore.getKeyIdForPerson("person-1")

                await expect(built.erasure.confirm(requested.requestId,
                    "someone-else")).rejects.toMatchObject({
                    code: "ERASURE_REQUEST_FORBIDDEN_EXCEPTION",
                })
                expect(await built.keystore.getKeyIdForPerson("person-1")).toBe(keyIdBefore)
            })

        it("ac.audit.erasure.logged.request-and-completion-are-lines: an erasure-requested line and an erasure-completed line both exist, in that order, and neither names the erased person",
            async () => {
                const built = await build()
                moduleRef = built.moduleRef
                await built.log.append("person-1",
                    "sign-in",
                    null) // some ordinary activity first

                const requested = await built.erasure.request("person-1")
                await built.erasure.execute(requested.requestId,
                    "person-1")

                const systemLines = await built.log.findLinesForPerson(SYSTEM_ACTOR_ID)
                expect(systemLines.map(line => line.action)).toEqual(["audit.erasure.requested",
                    "audit.erasure.completed"])
                expect(systemLines.every(line => line.target === requested.requestId)).toBe(true)
                expect(systemLines.every(line => line.actor === SYSTEM_ACTOR_ID)).toBe(true)

                // Neither line's actor resolves to the erased person.
                const personLines = await built.log.findLinesForPerson("person-1")
                expect(personLines.some(line => line.action.startsWith("audit.erasure"))).toBe(false)
            })

        describe("br.audit.erasure.right / fr.audit.erasure.complete",
            () => {
                it("ac.audit.erasure.right.identifying-fields-unreadable: after completion, no reader (including export) resolves the subject's identity from any line they produced, and every line's bytes, position and hash stay unchanged",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        await built.log.append("person-1",
                            "task.created",
                            "task-1")
                        await built.log.append("person-1",
                            "task.completed",
                            "task-1")
                        const beforeChain = await built.log.verifyChain()
                        const rowsBefore = built.manager._rowsFor(AuditLogLineEntity)
                            .filter(row => row.action === "task.created" || row.action === "task.completed")
                            .map(row => ({
                                ...row 
                            }))

                        const requested = await built.erasure.request("person-1")
                        await built.erasure.execute(requested.requestId,
                            "person-1")

                        expect(await built.log.findLinesForPerson("person-1")).toEqual([])
                        expect(await built.log.exportForPerson("person-1")).toEqual([])

                        const rowsAfter = built.manager._rowsFor(AuditLogLineEntity)
                            .filter(row => row.action === "task.created" || row.action === "task.completed")
                        expect(rowsAfter).toEqual(rowsBefore)
                        const afterChain = await built.log.verifyChain()
                        expect(afterChain.valid).toBe(true)
                        expect(afterChain.totalLines).toBeGreaterThanOrEqual(beforeChain.totalLines)
                    })

                it("data.audit.erasure-request invariant: personId is dropped from the request row once state reaches complete",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        const requested = await built.erasure.request("person-1")

                        const completed = await built.erasure.execute(requested.requestId,
                            "person-1")

                        expect(completed.state).toBe("complete")
                        expect(completed.personId).toBeNull()
                    })

                it("a caller who is not the request's own subject is forbidden from completing it",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        const requested = await built.erasure.request("person-1")

                        await expect(built.erasure.execute(requested.requestId,
                            "someone-else")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_FORBIDDEN_EXCEPTION",
                        })
                    })

                it("completing an unknown requestId is refused as not found",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef

                        await expect(built.erasure.execute("does-not-exist",
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_NOT_FOUND_EXCEPTION",
                        })
                    })

                it("a request already complete cannot be completed again",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        const requested = await built.erasure.request("person-1")
                        await built.erasure.execute(requested.requestId,
                            "person-1")

                        await expect(built.erasure.execute(requested.requestId,
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
                        })
                    })
            })

        it("t-refuse: a mismatched requester at verification time is refused, and nothing about the subject's keys is touched",
            async () => {
                const built = await build()
                moduleRef = built.moduleRef
                await built.keystore.getOrCreateKey("person-1")

                // Simulate a request row created for person-1 but "verified" by a different caller by writing
                // directly to the store (the only way to reach t-verify's mismatch branch without a second
                // identity channel this example does not have).
                const row = built.manager._rowsFor(AuditErasureRequestEntity)
                row.push({
                    requestId: "req-mismatch",
                    personId: "person-1",
                    state: "requested",
                    requestedAt: new Date(),
                    verifiedAt: null,
                    refusedAt: null,
                    executingAt: null,
                    completedAt: null,
                })

                await expect((built.erasure as unknown as { tVerify(id: string, caller: string): Promise<unknown> }).tVerify("req-mismatch",
                    "someone-else"))
                    .rejects.toMatchObject({
                        code: "ERASURE_REQUEST_FORBIDDEN_EXCEPTION" 
                    })

                const refused = row.find(r => r.requestId === "req-mismatch")
                expect(refused?.state).toBe("refused")
                expect(await built.keystore.getKeyIdForPerson("person-1")).not.toBeNull() // key untouched
            })

        describe("state-machine guard arms (w8 branch depth)",
            () => {
                const seedRow = (manager: ReturnType<typeof createFakeAuditEntityManager>,
                    requestId: string,
                    state: string,
                    personId: string | null = "person-1") => {
                    manager._rowsFor(AuditErasureRequestEntity).push({
                        requestId,
                        personId,
                        state,
                        requestedAt: new Date(),
                        verifiedAt: state === "verified" ? new Date() : null,
                        refusedAt: state === "refused" ? new Date() : null,
                        executingAt: null,
                        completedAt: state === "complete" ? new Date() : null,
                    })
                }

                it("execute() on a still-requested (unverified) request refuses, naming the expected state",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        seedRow(built.manager,
                            "req-unverified",
                            "requested")

                        await expect(built.erasure.execute("req-unverified",
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
                            metadata: {
                                state: "requested", expected: "verified" 
                            },
                        })
                    })

                it("execute() on a refused request refuses the same way - refused is terminal",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        seedRow(built.manager,
                            "req-refused",
                            "refused")

                        await expect(built.erasure.execute("req-refused",
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
                            metadata: {
                                state: "refused" 
                            },
                        })
                    })

                it("confirm() on an already-verified request refuses - t-verify only runs once",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef
                        seedRow(built.manager,
                            "req-verified",
                            "verified")

                        await expect(built.erasure.confirm("req-verified",
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
                            metadata: {
                                state: "verified", expected: "requested" 
                            },
                        })
                    })

                it("confirm() on an unknown request id is not found before any state check",
                    async () => {
                        const built = await build()
                        moduleRef = built.moduleRef

                        await expect(built.erasure.confirm("missing",
                            "person-1")).rejects.toMatchObject({
                            code: "ERASURE_REQUEST_NOT_FOUND_EXCEPTION",
                        })
                    })
            })
    })
