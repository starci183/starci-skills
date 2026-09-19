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
    TaskService 
} from "../task/task.service"
import {
    CompletionAuthorityRegistry 
} from "../task/completion-authority.providers"
import {
    AccessService 
} from "./access.service"
import {
    CollaboratorCache 
} from "./collaborator-cache"
import {
    InvitationService 
} from "./invitation.service"
import {
    ShareCompletionAuthority 
} from "./completion-authority"
import {
    createFakeShareEntityManager 
} from "./testing/fake-share-entity-manager"

/**
 * contract.share.completion-guard-for-task's real proof: a real TaskService, wired to a real
 * CompletionAuthorityRegistry, with a real ShareCompletionAuthority registered into it by a real
 * InvitationService/AccessService/CollaboratorCache - the exact seam share.module.ts wires at boot,
 * exercised here through Nest's own TestingModule. This is the strongest available proof for
 * ac.share.role.permissions.editor-can-complete, ac.share.role.permissions.viewer-read-only,
 * ac.share.editor.no-delete.delete-refused-for-editor and
 * ac.share.revoke.on-read.removed-loses-access-next-read: it shows task's own code, unmodified, actually
 * refusing/allowing the way each acceptance criterion states.
 */
describe("ShareCompletionAuthority (contract.share.completion-guard-for-task)",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let invitationService: InvitationService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    TaskService,
                    CompletionAuthorityRegistry,
                    InvitationService,
                    CollaboratorCache,
                    AccessService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeShareEntityManager(),
                    },
                ],
            }).compile()
            taskService = moduleRef.get(TaskService)
            invitationService = moduleRef.get(InvitationService)
            moduleRef.get(CompletionAuthorityRegistry).register(new ShareCompletionAuthority(moduleRef.get(AccessService)))
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.share.role.permissions.editor-can-complete: an accepted editor collaborator may complete the task",
            async () => {
                const task = await taskService.create("owner-1",
                    "Ship it")
                const invited = await invitationService.invite("owner-1",
                    task.id,
                    "editor@example.com",
                    "editor")
                await invitationService.accept("editor-1",
                    invited.id,
                    "editor@example.com")

                const completed = await taskService.complete(task.id,
                    "editor-1")
                expect(completed.complete).toBe(true)
            })

        it("ac.share.role.permissions.viewer-read-only: an accepted viewer collaborator may not complete the task",
            async () => {
                const task = await taskService.create("owner-1",
                    "Ship it")
                const invited = await invitationService.invite("owner-1",
                    task.id,
                    "viewer@example.com",
                    "viewer")
                await invitationService.accept("viewer-1",
                    invited.id,
                    "viewer@example.com")

                await expect(taskService.complete(task.id,
                    "viewer-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                const stored = await taskService.findById(task.id)
                expect(stored.complete).toBe(false)
            })

        it("ac.share.editor.no-delete.delete-refused-for-editor: an accepted editor may never delete the task",
            async () => {
                const task = await taskService.create("owner-1",
                    "Ship it")
                const invited = await invitationService.invite("owner-1",
                    task.id,
                    "editor@example.com",
                    "editor")
                await invitationService.accept("editor-1",
                    invited.id,
                    "editor@example.com")

                await expect(taskService.delete(task.id,
                    "editor-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
                await expect(taskService.findById(task.id)).resolves.toMatchObject({
                    id: task.id 
                })
            })

        it("ac.share.revoke.on-read.removed-loses-access-next-read: a revoked editor is refused on the very next completion attempt",
            async () => {
                const task = await taskService.create("owner-1",
                    "Ship it")
                const invited = await invitationService.invite("owner-1",
                    task.id,
                    "editor@example.com",
                    "editor")
                await invitationService.accept("editor-1",
                    invited.id,
                    "editor@example.com")
                await taskService.complete(task.id,
                    "editor-1")
                await taskService.reopen(task.id,
                    "editor-1")

                await invitationService.revoke("owner-1",
                    invited.id)

                await expect(taskService.complete(task.id,
                    "editor-1")).rejects.toMatchObject({
                    code: "TASK_FORBIDDEN_EXCEPTION" 
                })
            })

        it("the owner may still complete and delete after an editor is registered",
            async () => {
                const task = await taskService.create("owner-1",
                    "Ship it")
                const invited = await invitationService.invite("owner-1",
                    task.id,
                    "editor@example.com",
                    "editor")
                await invitationService.accept("editor-1",
                    invited.id,
                    "editor@example.com")

                const completed = await taskService.complete(task.id,
                    "owner-1")
                expect(completed.complete).toBe(true)
                const deleted = await taskService.delete(task.id,
                    "owner-1")
                expect(deleted.id).toBe(task.id)
            })
    })
