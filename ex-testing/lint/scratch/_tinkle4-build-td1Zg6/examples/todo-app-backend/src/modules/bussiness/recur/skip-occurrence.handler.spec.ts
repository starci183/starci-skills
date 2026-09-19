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
    createFakeRecurEntityManager 
} from "./testing/fake-recur-entity-manager"
import {
    OccurrenceService 
} from "./occurrence.service"
import {
    SkipOccurrenceCommand 
} from "./skip-occurrence.command"
import {
    SkipOccurrenceHandler 
} from "./skip-occurrence.handler"

describe("SkipOccurrenceHandler (sds.recur.occurrence-lifecycle t-skip)",
    () => {
        let moduleRef: TestingModule
        let occurrenceService: OccurrenceService
        let handler: SkipOccurrenceHandler

        beforeEach(async () => {
            const entityManager = createFakeRecurEntityManager()
            await entityManager.save(TaskEntity,
                {
                    id: "task-1", owner: "owner-1", title: "x", complete: false, completedAt: null 
                })
            moduleRef = await Test.createTestingModule({
                providers: [
                    SkipOccurrenceHandler,
                    OccurrenceService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                ],
            }).compile()
            occurrenceService = moduleRef.get(OccurrenceService)
            handler = moduleRef.get(SkipOccurrenceHandler)
            await occurrenceService.materialise({
                id: "task-1", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
            })
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("skips a materialised occurrence for its owner without completing the task",
            async () => {
                const result = await handler.execute(new SkipOccurrenceCommand({
                    occurrenceId: "task-1", actorId: "owner-1" 
                }))

                expect(result.status).toBe("skipped")
            })

        it("ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner",
            async () => {
                await expect(handler.execute(new SkipOccurrenceCommand({
                    occurrenceId: "task-1", actorId: "owner-2" 
                }))).rejects.toMatchObject({
                    code: "RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION",
                })
            })
    })
