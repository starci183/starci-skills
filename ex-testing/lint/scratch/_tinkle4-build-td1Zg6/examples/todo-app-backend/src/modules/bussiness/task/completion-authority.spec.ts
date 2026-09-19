import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    TaskEntity 
} from "@modules/platform/databases/postgresql/primary/entities/task.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    CompletionAuthority 
} from "./completion-authority.contracts"
import {
    CompletionAuthorityRegistry 
} from "./completion-authority.providers"
import {
    TaskRecord 
} from "./types/task-record"
import {
    TaskService 
} from "./task.service"

/** A future `share` feature's widened authority: any registered collaborator, not only the owner, may complete/reopen. */
class WidenedCompletionAuthority extends CompletionAuthority {
    constructor(private readonly collaborators: Set<string>) {
        super()
    }

    assertMayTransition(record: TaskRecord, actorId: string): void {
        if (record.owner === actorId || this.collaborators.has(actorId)) return
        throw new Error("not authorized")
    }
}

describe("CompletionAuthorityRegistry",
    () => {
        let moduleRef: TestingModule
        let registry: CompletionAuthorityRegistry
        let service: TaskService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    TaskService,
                    CompletionAuthorityRegistry,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<TaskEntity>("id"),
                    },
                ],
            }).compile()
            registry = moduleRef.get(CompletionAuthorityRegistry)
            service = moduleRef.get(TaskService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("br.task.single-owner (default): only the owner may complete or reopen; a stranger is refused",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                await expect(service.complete(record.id,
                    "owner-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                await expect(service.reopen(record.id,
                    "owner-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
            })

        it("a registered widened authority lets a non-owner complete/reopen once registered",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                registry.register(new WidenedCompletionAuthority(new Set(["collaborator-1"])))

                const completed = await service.complete(record.id,
                    "collaborator-1")
                expect(completed.complete).toBe(true)
                const reopened = await service.reopen(record.id,
                    "collaborator-1")
                expect(reopened.complete).toBe(false)
            })

        it("delete stays owner-only through OwnershipGuard even after a widened CompletionAuthority is registered",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")
                registry.register(new WidenedCompletionAuthority(new Set(["collaborator-1"])))

                await expect(service.delete(record.id,
                    "collaborator-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
            })

        it("sds.task.ownership-guard.t-owner: with the default authority the owner passes the completion authority and the delete guard",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                const completed = await service.complete(record.id,
                    "owner-1")
                expect(completed.complete).toBe(true)
                const deleted = await service.delete(record.id,
                    "owner-1")
                expect(deleted.id).toBe(record.id)
            })

        it("sds.task.ownership-guard.t-collaborator: a widened authority proceeds with complete and reopen, while delete is still refused",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")
                registry.register(new WidenedCompletionAuthority(new Set(["collaborator-1"])))

                const completed = await service.complete(record.id,
                    "collaborator-1")
                expect(completed.complete).toBe(true)
                const reopened = await service.reopen(record.id,
                    "collaborator-1")
                expect(reopened.complete).toBe(false)
                await expect(service.delete(record.id,
                    "collaborator-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                await expect(service.findById(record.id)).resolves.toMatchObject({
                    id: record.id 
                })
            })

        it("sds.task.ownership-guard.t-stranger: a stranger is refused on both paths before anything is written",
            async () => {
                const record = await service.create("owner-1",
                    "Ship it")

                await expect(service.complete(record.id,
                    "actor-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                await expect(service.delete(record.id,
                    "actor-2")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                const stored = await service.findById(record.id)
                expect(stored.complete).toBe(false)
                expect(stored.title).toBe("Ship it")
            })
    })
