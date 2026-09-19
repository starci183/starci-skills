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
    createFakeRecurEntityManager 
} from "./testing/fake-recur-entity-manager"
import {
    RuleService 
} from "./rule.service"
import {
    EditRecurrenceCommand 
} from "./edit-recurrence.command"
import {
    EditRecurrenceHandler 
} from "./edit-recurrence.handler"

describe("EditRecurrenceHandler (fr.recur.edit-rule)",
    () => {
        let moduleRef: TestingModule
        let ruleService: RuleService
        let handler: EditRecurrenceHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    EditRecurrenceHandler,
                    RuleService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeRecurEntityManager() 
                    },
                ],
            }).compile()
            ruleService = moduleRef.get(RuleService)
            handler = moduleRef.get(EditRecurrenceHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.recur.edit-rule: the owner can change the schedule",
            async () => {
                const rule = await ruleService.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })

                const result = await handler.execute(new EditRecurrenceCommand({
                    ruleId: rule.id, actorId: "owner-1", time: "10:00" 
                }))

                expect(result.time).toBe("10:00")
            })

        it("exceptionFlows: someone who is not the rule's owner may not edit it",
            async () => {
                const rule = await ruleService.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })

                await expect(handler.execute(new EditRecurrenceCommand({
                    ruleId: rule.id, actorId: "owner-2", time: "10:00" 
                }))).rejects.toMatchObject({
                    code: "RECUR_RULE_FORBIDDEN_EXCEPTION",
                })
            })
    })
