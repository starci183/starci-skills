import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AccessService 
} from "./access.service"
import {
    CollaboratorCache 
} from "./collaborator-cache"

/**
 * contract.share.completion-guard-for-task's provider-side surface, in isolation: `mayComplete` honors
 * owner and accepted editor, `mayDelete` is owner-only unconditionally (br.share.editor.no-delete).
 */
describe("AccessService (contract.share.completion-guard-for-task)",
    () => {
        let moduleRef: TestingModule
        let service: AccessService
        let cache: CollaboratorCache

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [AccessService,
                    CollaboratorCache] 
            }).compile()
            service = moduleRef.get(AccessService)
            cache = moduleRef.get(CollaboratorCache)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        const task = {
            id: "task-1", owner: "owner-1" 
        }

        it("the owner may complete and may delete",
            () => {
                expect(service.mayComplete("owner-1",
                    task)).toEqual({
                    allowed: true 
                })
                expect(service.mayDelete("owner-1",
                    task)).toEqual({
                    allowed: true 
                })
            })

        it("an accepted editor may complete but may never delete",
            () => {
                cache.set("task-1",
                    "editor-1",
                    "editor")

                expect(service.mayComplete("editor-1",
                    task)).toEqual({
                    allowed: true 
                })
                expect(service.mayDelete("editor-1",
                    task)).toEqual({
                    allowed: false, reason: expect.any(String) 
                })
            })

        it("an accepted viewer may neither complete nor delete",
            () => {
                cache.set("task-1",
                    "viewer-1",
                    "viewer")

                expect(service.mayComplete("viewer-1",
                    task)).toEqual({
                    allowed: false, reason: expect.any(String) 
                })
                expect(service.mayDelete("viewer-1",
                    task)).toEqual({
                    allowed: false, reason: expect.any(String) 
                })
            })

        it("a stranger with no accepted invitation may neither complete nor delete",
            () => {
                expect(service.mayComplete("stranger",
                    task)).toEqual({
                    allowed: false, reason: expect.any(String) 
                })
                expect(service.mayDelete("stranger",
                    task)).toEqual({
                    allowed: false, reason: expect.any(String) 
                })
            })

        it("a collaborator on a different task holds no role on this one",
            () => {
                cache.set("task-2",
                    "editor-1",
                    "editor")

                expect(service.mayComplete("editor-1",
                    task).allowed).toBe(false)
            })
    })
