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
    RuleService 
} from "./rule.service"
import {
    OccurrenceService 
} from "./occurrence.service"
import {
    EndRecurrenceCommand 
} from "./end-recurrence.command"
import {
    EndRecurrenceHandler 
} from "./end-recurrence.handler"

describe("EndRecurrenceHandler (fr.recur.end-rule, br.recur.ending.preserves-history)",
    () => {
        let moduleRef: TestingModule
        let entityManager: ReturnType<typeof createFakeRecurEntityManager>
        let ruleService: RuleService
        let occurrenceService: OccurrenceService
        let handler: EndRecurrenceHandler

        beforeEach(async () => {
            entityManager = createFakeRecurEntityManager()
            moduleRef = await Test.createTestingModule({
                providers: [
                    EndRecurrenceHandler,
                    RuleService,
                    OccurrenceService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                ],
            }).compile()
            ruleService = moduleRef.get(RuleService)
            occurrenceService = moduleRef.get(OccurrenceService)
            handler = moduleRef.get(EndRecurrenceHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.recur.ending.preserves-history.ended-rule-keeps-past-occurrences",
            async () => {
                const rule = await ruleService.create({
                    owner: "owner-1",
                    title: "Morning routine",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-09-14",
                })

                await entityManager.save(TaskEntity,
                    {
                        id: "task-14", owner: "owner-1", title: "x", complete: false, completedAt: null 
                    })
                await entityManager.save(TaskEntity,
                    {
                        id: "task-15", owner: "owner-1", title: "x", complete: false, completedAt: null 
                    })
                await occurrenceService.materialise({
                    id: "task-14", ruleId: rule.id, windowKey: `${rule.id}:2026-09-14`, localDate: "2026-09-14", dueAtUtc: new Date() 
                })
                await occurrenceService.materialise({
                    id: "task-15", ruleId: rule.id, windowKey: `${rule.id}:2026-09-15`, localDate: "2026-09-15", dueAtUtc: new Date() 
                })
                await occurrenceService.complete("task-14",
                    "owner-1")

                const result = await handler.execute(new EndRecurrenceCommand({
                    ruleId: rule.id, actorId: "owner-1", endedAt: "2026-09-15" 
                }))

                expect(result.orphanedCount).toBe(1)

                const day14 = await occurrenceService.findById("task-14")
                const day15 = await occurrenceService.findById("task-15")
                // "The 2026-09-14 occurrence's status stays completed; it is not touched."
                expect(day14.status).toBe("completed")
                // "The 2026-09-15 occurrence's status becomes orphaned."
                expect(day15.status).toBe("orphaned")
                // "No row for either occurrence is deleted." - both are still findable, above, without throwing.
            })

        it("exceptionFlows-equivalent: a stranger may not end someone else's rule",
            async () => {
                const rule = await ruleService.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })

                await expect(handler.execute(new EndRecurrenceCommand({
                    ruleId: rule.id, actorId: "owner-2", endedAt: "2026-02-01" 
                }))).rejects.toMatchObject({
                    code: "RECUR_RULE_FORBIDDEN_EXCEPTION",
                })
            })
    })
