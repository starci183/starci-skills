import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { NoteErrorCode } from "./errors/note.error"
import { NoteService } from "./note.service"
import { NoteEntity } from "./persistence/entities/note.entity"
import { INSERT_NOTE } from "./persistence/note.sql"

const NOW = "2026-01-01T00:00:00.000Z"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            NoteService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(NoteService)
}

describe("NoteService", () => {
    describe("list", () => {
        it("returns the newest notes first, capped at the list maximum", async () => {
            const em = mockEntityManager({
                find: [
                    NoteEntity,
                    [
                        { id: "n-2", body: "second", createdAt: new Date("2026-01-02T00:00:00.000Z") },
                        { id: "n-1", body: "first", createdAt: new Date("2026-01-01T00:00:00.000Z") },
                    ],
                ],
            })
            const service = await build(em)

            const notes = await service.list()

            expect(notes).toEqual([
                { id: "n-2", body: "second", createdAt: "2026-01-02T00:00:00.000Z" },
                { id: "n-1", body: "first", createdAt: "2026-01-01T00:00:00.000Z" },
            ])
            expect(em.find).toHaveBeenCalledWith(NoteEntity, { order: { createdAt: "DESC" }, take: LIST_ROWS_MAX })
        })

        it("returns no note when none was written", async () => {
            const service = await build(mockEntityManager({ find: [NoteEntity, []] }))

            await expect(service.list()).resolves.toEqual([])
        })
    })

    describe("create", () => {
        it("writes through the caller transaction manager, stamped by the clock, and returns the stored note", async () => {
            const manager = mockEntityManager({
                query: [INSERT_NOTE, [{ id: "n-1", body: "hello", created_at: new Date(NOW) }]],
            })
            const service = await build(mockEntityManager())

            const note = await service.create({ manager, body: "hello" })

            expect(note).toEqual({ id: "n-1", body: "hello", createdAt: NOW })
            expect(manager.query).toHaveBeenCalledWith(INSERT_NOTE, ["hello", new Date(NOW)])
        })

        it("throws the note missing error when the insert answers no row", async () => {
            const manager = mockEntityManager({ query: [INSERT_NOTE, []] })
            const service = await build(mockEntityManager())

            await expect(service.create({ manager, body: "hello" })).rejects.toMatchObject({
                code: NoteErrorCode.NoteMissing,
            })
        })
    })
})
