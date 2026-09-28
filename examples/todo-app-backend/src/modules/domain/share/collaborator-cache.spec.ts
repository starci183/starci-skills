import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CollaboratorCache 
} from "./collaborator-cache"

/**
 * br.share.revoke.on-read's "immediately, not by a sweep" guarantee: the synchronous mirror of accepted
 * invitations that the completion authority consults. A revoked pair must read as absent on the very
 * next lookup.
 */
describe("CollaboratorCache (br.share.revoke.on-read)",
    () => {
        let moduleRef: TestingModule
        let cache: CollaboratorCache

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [CollaboratorCache] 
            }).compile()
            cache = moduleRef.get(CollaboratorCache)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("a pair never written reads as no role",
            () => {
                expect(cache.roleOf("task-1",
                    "person-1")).toEqual({
                    role: null 
                })
            })

        it("a written pair reads back its role, scoped to exactly that (taskId, personId)",
            () => {
                cache.set("task-1",
                    "person-1",
                    "editor")

                expect(cache.roleOf("task-1",
                    "person-1")).toEqual({
                    role: "editor" 
                })
                expect(cache.roleOf("task-1",
                    "person-2")).toEqual({
                    role: null 
                })
                expect(cache.roleOf("task-2",
                    "person-1")).toEqual({
                    role: null 
                })
            })

        it("a re-written pair reads its latest role",
            () => {
                cache.set("task-1",
                    "person-1",
                    "viewer")
                cache.set("task-1",
                    "person-1",
                    "editor")

                expect(cache.roleOf("task-1",
                    "person-1")).toEqual({
                    role: "editor" 
                })
            })

        it("a deleted pair reads as no role on the very next lookup - revocation takes effect immediately",
            () => {
                cache.set("task-1",
                    "person-1",
                    "editor")
                cache.delete("task-1",
                    "person-1")

                expect(cache.roleOf("task-1",
                    "person-1")).toEqual({
                    role: null 
                })
            })
    })
