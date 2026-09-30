import { mockEntityManager } from "@tests/fixtures/database"
import { IsNull } from "typeorm"
import { DigestService } from "./digest.service"
import { NotifyDigestWindowEntity } from "./persistence/entities/digest-window.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const MINUTE = 60_000

const windowRow = (overrides: Partial<NotifyDigestWindowEntity> = {}): NotifyDigestWindowEntity =>
    Object.assign(new NotifyDigestWindowEntity(), {
        id: "w1",
        personId: "p1",
        channel: "email",
        opensAt: new Date(AT.getTime() - MINUTE),
        closesAt: new Date(AT.getTime() + 9 * MINUTE),
        flushedAt: null,
        ...overrides,
    })

const echoSave = jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))
const updated = (affected: number) => jest.fn().mockResolvedValue({ affected, raw: [], generatedMaps: [] })

describe("DigestService", () => {
    it("joins the open window without opening a second one", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(windowRow()), save: jest.fn() })
        const joined = await new DigestService().admit({ manager, personId: "p1", channel: "email", at: AT, windowMinutes: 10 })
        expect(joined).toEqual({ windowId: "w1", opened: false, closesAt: new Date(AT.getTime() + 9 * MINUTE) })
        expect(manager.findOneBy).toHaveBeenCalledWith(NotifyDigestWindowEntity, {
            personId: "p1",
            channel: "email",
            flushedAt: IsNull(),
        })
        expect(manager.save).not.toHaveBeenCalled()
    })

    it("opens a new window of the asked length when none is open", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), save: echoSave })
        const opened = await new DigestService().admit({ manager, personId: "p1", channel: "email", at: AT, windowMinutes: 5 })
        expect(opened.opened).toBe(true)
        expect(opened.closesAt).toEqual(new Date(AT.getTime() + 5 * MINUTE))
        expect(manager.save).toHaveBeenCalledWith(
            NotifyDigestWindowEntity,
            expect.objectContaining({ personId: "p1", channel: "email", opensAt: AT, flushedAt: null }),
        )
    })

    it("never joins a window that has already closed", async () => {
        const closed = windowRow({ closesAt: new Date(AT.getTime() - 1) })
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(closed), save: echoSave })
        const result = await new DigestService().admit({ manager, personId: "p1", channel: "email", at: AT, windowMinutes: 10 })
        expect(result.opened).toBe(true)
        expect(result.windowId).not.toBe("w1")
    })

    it("flushes a closed window once", async () => {
        const closed = windowRow({ closesAt: new Date(AT.getTime() - 1) })
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(closed), update: updated(1) })
        await expect(new DigestService().flush({ manager, windowId: "w1", at: AT })).resolves.toEqual({
            windowId: "w1",
            personId: "p1",
            channel: "email",
        })
        expect(manager.update).toHaveBeenCalledWith(
            NotifyDigestWindowEntity,
            { id: "w1", flushedAt: IsNull() },
            { flushedAt: AT },
        )
    })

    it("answers null and writes nothing before the window closes", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(windowRow()), update: updated(1) })
        await expect(new DigestService().flush({ manager, windowId: "w1", at: AT })).resolves.toBeNull()
        expect(manager.update).not.toHaveBeenCalled()
    })

    it("answers null for an unknown window and for one that was flushed already", async () => {
        const unknown = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), update: updated(1) })
        await expect(new DigestService().flush({ manager: unknown, windowId: "nope", at: AT })).resolves.toBeNull()
        const flushed = mockEntityManager({
            findOneBy: jest.fn().mockResolvedValue(windowRow({ closesAt: AT, flushedAt: AT })),
            update: updated(1),
        })
        await expect(new DigestService().flush({ manager: flushed, windowId: "w1", at: AT })).resolves.toBeNull()
        expect(unknown.update).not.toHaveBeenCalled()
        expect(flushed.update).not.toHaveBeenCalled()
    })

    it("answers null when a concurrent flush won the row", async () => {
        const manager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(windowRow({ closesAt: AT })), update: updated(0) })
        await expect(new DigestService().flush({ manager, windowId: "w1", at: AT })).resolves.toBeNull()
    })
})
