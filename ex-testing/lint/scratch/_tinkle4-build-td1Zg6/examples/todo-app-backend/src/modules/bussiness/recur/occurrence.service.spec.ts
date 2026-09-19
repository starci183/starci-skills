import {
    Test 
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

describe("OccurrenceService (sds.recur.occurrence-lifecycle)",
    () => {
        const buildWithTask = async (taskId: string, owner: string, title = "Task") => {
            const entityManager = createFakeRecurEntityManager()
            await entityManager.save(TaskEntity,
                {
                    id: taskId, owner, title, complete: false, completedAt: null 
                })
            const moduleRef = await Test.createTestingModule({
                providers: [
                    OccurrenceService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                    },
                ],
            }).compile()
            return {
                moduleRef, service: moduleRef.get(OccurrenceService), entityManager 
            }
        }

        it("t-materialise: writes one row keyed by windowKey, joined with the task row it was created alongside",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1",
                    "Morning routine")
                try {
                    const occurrence = await service.materialise({
                        id: "task-1",
                        ruleId: "rule-1",
                        windowKey: "rule-1:2026-09-14",
                        localDate: "2026-09-14",
                        dueAtUtc: new Date("2026-09-14T07:00:00.000Z"),
                    })
                    expect(occurrence.status).toBe("materialised")
                    expect(occurrence.owner).toBe("owner-1")
                    expect(occurrence.title).toBe("Morning routine")
                    expect(occurrence.complete).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })

        it("br.recur.generation.once / ac.is-idempotent-on-rerun: a second materialise for the same windowKey changes nothing",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1")
                try {
                    const first = await service.materialise({
                        id: "task-1",
                        ruleId: "r1",
                        windowKey: "r1:2026-09-14",
                        localDate: "2026-09-14",
                        dueAtUtc: new Date("2026-09-14T07:00:00.000Z"),
                    })
                    const second = await service.materialise({
                        id: "task-1",
                        ruleId: "r1",
                        windowKey: "r1:2026-09-14",
                        localDate: "2026-09-14",
                        dueAtUtc: new Date("2026-09-14T07:00:00.000Z"),
                    })
                    expect(second.id).toBe(first.id)
                    expect(second.dueAtUtc.toISOString()).toBe(first.dueAtUtc.toISOString())
                    expect(second.status).toBe(first.status)
                } finally {
                    await moduleRef.close()
                }
            })

        it("t-complete: the owner can complete a materialised occurrence, which also completes the underlying task",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1")
                try {
                    await service.materialise({
                        id: "task-1", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
                    })
                    const completed = await service.complete("task-1",
                        "owner-1")
                    expect(completed.status).toBe("completed")
                    expect(completed.complete).toBe(true)
                    expect(completed.completedAt).not.toBeNull()
                } finally {
                    await moduleRef.close()
                }
            })

        it("completing an already-completed occurrence again is a no-op, not a second write",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1")
                try {
                    await service.materialise({
                        id: "task-1", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
                    })
                    const first = await service.complete("task-1",
                        "owner-1")
                    const second = await service.complete("task-1",
                        "owner-1")
                    expect(second.completedAt?.toISOString()).toBe(first.completedAt?.toISOString())
                } finally {
                    await moduleRef.close()
                }
            })

        it("t-skip: the owner can skip a materialised occurrence without marking the task complete",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1")
                try {
                    await service.materialise({
                        id: "task-1", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
                    })
                    const skipped = await service.skip("task-1",
                        "owner-1")
                    expect(skipped.status).toBe("skipped")
                    expect(skipped.complete).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })

        it("ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner: a stranger's complete/skip attempt is refused and nothing changes",
            async () => {
                const { moduleRef, service } = await buildWithTask("task-1",
                    "owner-1")
                try {
                    await service.materialise({
                        id: "task-1", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
                    })

                    await expect(service.complete("task-1",
                        "owner-2")).rejects.toMatchObject({
                        code: "RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION" 
                    })
                    await expect(service.skip("task-1",
                        "owner-2")).rejects.toMatchObject({
                        code: "RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION" 
                    })

                    const unchanged = await service.findById("task-1")
                    expect(unchanged.status).toBe("materialised")
                    expect(unchanged.complete).toBe(false)
                    expect(unchanged.completedAt).toBeNull()
                } finally {
                    await moduleRef.close()
                }
            })

        it("t-orphan / br.recur.ending.preserves-history: orphanEndedOccurrences flips only materialised occurrences dated on/after endedAt, and never deletes any row",
            async () => {
                const entityManager = createFakeRecurEntityManager()
                await entityManager.save(TaskEntity,
                    {
                        id: "task-14", owner: "owner-1", title: "x", complete: true, completedAt: new Date() 
                    })
                await entityManager.save(TaskEntity,
                    {
                        id: "task-15", owner: "owner-1", title: "x", complete: false, completedAt: null 
                    })
                const moduleRef = await Test.createTestingModule({
                    providers: [
                        OccurrenceService,
                        {
                            provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                        },
                    ],
                }).compile()
                const service = moduleRef.get(OccurrenceService)
                try {
                    await service.materialise({
                        id: "task-14", ruleId: "r1", windowKey: "r1:2026-09-14", localDate: "2026-09-14", dueAtUtc: new Date() 
                    })
                    await service.complete("task-14",
                        "owner-1")
                    await service.materialise({
                        id: "task-15", ruleId: "r1", windowKey: "r1:2026-09-15", localDate: "2026-09-15", dueAtUtc: new Date() 
                    })

                    const orphanedCount = await service.orphanEndedOccurrences("r1",
                        "2026-09-15")

                    expect(orphanedCount).toBe(1)
                    const day14 = await service.findById("task-14")
                    const day15 = await service.findById("task-15")
                    expect(day14.status).toBe("completed")
                    expect(day15.status).toBe("orphaned")
                } finally {
                    await moduleRef.close()
                }
            })
    })
