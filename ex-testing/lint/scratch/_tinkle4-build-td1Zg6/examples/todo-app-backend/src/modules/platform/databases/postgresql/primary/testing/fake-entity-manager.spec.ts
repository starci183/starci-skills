import {
    createFakeEntityManager 
} from "./fake-entity-manager"

interface TaskRow {
  id: string;
  owner: string;
  deletedAt: Date | null;
}

interface PreferenceRow {
  personId: string;
  channel: string;
  enabled: boolean;
}

/**
 * The shared spec double every capability spec injects in place of the real EntityManager - if it
 * drifts from TypeORM semantics (keyed lookups, criteria matching, delete by key), every consumer spec
 * drifts with it, so the helper is covered directly.
 */
describe("createFakeEntityManager",
    () => {
        it("round-trips rows saved by their single-column key",
            async () => {
                const em = createFakeEntityManager<TaskRow>("id")
                const row: TaskRow = {
                    id: "task-1", owner: "owner-1", deletedAt: null 
                }

                await em.save(null,
                    row)

                await expect(em.findOneBy(null,
                    {
                        id: "task-1" 
                    })).resolves.toBe(row)
                await expect(em.findOneBy(null,
                    {
                        id: "missing" 
                    })).resolves.toBeNull()
            })

        it("findOneBy falls back to criteria matching when the where clause is not the key",
            async () => {
                const em = createFakeEntityManager<TaskRow>("id")
                const row: TaskRow = {
                    id: "task-1", owner: "owner-1", deletedAt: null 
                }
                await em.save(null,
                    row)
                await em.save(null,
                    {
                        id: "task-2", owner: "owner-2", deletedAt: null 
                    })

                await expect(em.findOneBy(null,
                    {
                        owner: "owner-1" 
                    })).resolves.toBe(row)
                await expect(em.findOneBy(null,
                    {
                        owner: "nobody" 
                    })).resolves.toBeNull()
            })

        it("findBy returns every row matching all criteria and nothing else",
            async () => {
                const em = createFakeEntityManager<TaskRow>("id")
                await em.save(null,
                    {
                        id: "task-1", owner: "owner-1", deletedAt: null 
                    })
                await em.save(null,
                    {
                        id: "task-2", owner: "owner-1", deletedAt: new Date("2026-09-01T00:00:00Z") 
                    })
                await em.save(null,
                    {
                        id: "task-3", owner: "owner-2", deletedAt: null 
                    })

                await expect(em.findBy(null,
                    {
                        owner: "owner-1" 
                    })).resolves.toHaveLength(2)
                await expect(em.findBy(null,
                    {
                        owner: "owner-1", deletedAt: null 
                    })).resolves.toEqual([
                    {
                        id: "task-1", owner: "owner-1", deletedAt: null 
                    },
                ])
            })

        it("treats an IsNull()-shaped find operator as matching null or undefined fields",
            async () => {
                const em = createFakeEntityManager<TaskRow>("id")
                await em.save(null,
                    {
                        id: "task-1", owner: "owner-1", deletedAt: null 
                    })
                await em.save(null,
                    {
                        id: "task-2", owner: "owner-1", deletedAt: new Date("2026-09-01T00:00:00Z") 
                    })
                const isNull = {
                    _type: "isNull" 
                } as unknown as Date | null

                await expect(em.findBy(null,
                    {
                        deletedAt: isNull 
                    })).resolves.toEqual([
                    {
                        id: "task-1", owner: "owner-1", deletedAt: null 
                    },
                ])
            })

        it("supports a composite key function for multi-column primary keys",
            async () => {
                const em = createFakeEntityManager<PreferenceRow>(row => `${row.personId}:${row.channel}`)
                const row: PreferenceRow = {
                    personId: "person-1", channel: "email", enabled: true 
                }
                await em.save(null,
                    row)

                await expect(em.findOneBy(null,
                    {
                        personId: "person-1", channel: "email" 
                    })).resolves.toBe(row)
                await expect(em.findOneBy(null,
                    {
                        personId: "person-1", channel: "sms" 
                    })).resolves.toBeNull()
            })

        it("save throws when the entity does not carry enough fields to derive a key",
            async () => {
                const em = createFakeEntityManager<TaskRow>("id")

                await expect(em.save(null,
                    {
                        owner: "owner-1" 
                    })).rejects.toMatchObject({
                    code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
                    metadata: {
                        reason: "createFakeEntityManager: save() called without enough fields to derive a key" 
                    },
                })
            })

        it("delete removes by scalar key or by composite-key criteria",
            async () => {
                const byId = createFakeEntityManager<TaskRow>("id")
                await byId.save(null,
                    {
                        id: "task-1", owner: "o", deletedAt: null 
                    })
                await byId.delete(null,
                    "task-1")
                await expect(byId.findOneBy(null,
                    {
                        id: "task-1" 
                    })).resolves.toBeNull()

                const byComposite = createFakeEntityManager<PreferenceRow>(row => `${row.personId}:${row.channel}`)
                await byComposite.save(null,
                    {
                        personId: "person-1", channel: "email", enabled: true 
                    })
                await byComposite.delete(null,
                    {
                        personId: "person-1", channel: "email" 
                    })
                await expect(
                    byComposite.findOneBy(null,
                        {
                            personId: "person-1", channel: "email" 
                        }),
                ).resolves.toBeNull()
            })
    })
