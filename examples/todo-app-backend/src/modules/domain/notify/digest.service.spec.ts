import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { DigestService } from "./digest.service"
import { NotifyDigestWindowEntity } from "./persistence/entities/digest-window.entity"

const AT = new Date("2026-09-30T10:00:00.000Z")
const MINUTE = 60_000

const window = (overrides: Partial<NotifyDigestWindowEntity> = {}): NotifyDigestWindowEntity =>
    Object.assign(new NotifyDigestWindowEntity(), {
        id: "w1",
        personId: "p1",
        channel: "email",
        opensAt: new Date(AT.getTime() - 5 * MINUTE),
        closesAt: new Date(AT.getTime() + 5 * MINUTE),
        flushedAt: null,
        ...overrides,
    })

const admitParams = (manager: ReturnType<typeof mockEntityManager>) => ({
    manager,
    personId: "p1",
    channel: "email",
    at: AT,
    windowMinutes: 10,
})

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [DigestService] }).compile()
    return moduleRef.get(DigestService)
}

describe("DigestService", () => {
    describe("admit", () => {
        it("joins the open window of the person and the channel without writing", async () => {
            const service = await build()
            const open = window()
            const manager = mockEntityManager({ findOneBy: [NotifyDigestWindowEntity, open] })

            const admitted = await service.admit(admitParams(manager))

            expect(admitted).toEqual({ windowId: "w1", opened: false, closesAt: open.closesAt })
            expect(manager.findOneBy).toHaveBeenCalledWith(NotifyDigestWindowEntity, {
                personId: "p1",
                channel: "email",
                flushedAt: IsNull(),
            })
        })

        it("opens a new window of the requested length when none is open", async () => {
            const service = await build()
            const closesAt = new Date(AT.getTime() + 10 * MINUTE)
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, null],
                save: [NotifyDigestWindowEntity, window({ id: "w-new", closesAt })],
            })

            const admitted = await service.admit(admitParams(manager))

            expect(admitted).toEqual({ windowId: "w-new", opened: true, closesAt })
            expect(manager.save).toHaveBeenCalledWith(NotifyDigestWindowEntity, {
                id: expect.any(String),
                personId: "p1",
                channel: "email",
                opensAt: AT,
                closesAt,
                flushedAt: null,
            })
        })

        it("opens a new window when the open one closes exactly at the admission instant", async () => {
            const service = await build()
            const closesAt = new Date(AT.getTime() + 3 * MINUTE)
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, window({ closesAt: AT })],
                save: [NotifyDigestWindowEntity, window({ id: "w2", closesAt })],
            })

            const admitted = await service.admit({ ...admitParams(manager), windowMinutes: 3 })

            expect(admitted).toEqual({ windowId: "w2", opened: true, closesAt })
            expect(manager.save).toHaveBeenCalledWith(
                NotifyDigestWindowEntity,
                expect.objectContaining({ closesAt }),
            )
        })

        it("opens a new window when the open one closed before the admission instant", async () => {
            const service = await build()
            const stale = window({ closesAt: new Date(AT.getTime() - MINUTE) })
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, stale],
                save: [NotifyDigestWindowEntity, window({ id: "w3" })],
            })

            const admitted = await service.admit(admitParams(manager))

            expect(admitted.opened).toBe(true)
            expect(admitted.windowId).toBe("w3")
        })
    })

    describe("flush", () => {
        const flushParams = (manager: ReturnType<typeof mockEntityManager>) => ({ manager, windowId: "w1", at: AT })

        it("answers null and writes nothing when the window does not exist", async () => {
            const service = await build()
            const manager = mockEntityManager({ findOneBy: [NotifyDigestWindowEntity, null] })

            await expect(service.flush(flushParams(manager))).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("answers null and writes nothing when the window was flushed already", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, window({ closesAt: AT, flushedAt: AT })],
            })

            await expect(service.flush(flushParams(manager))).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("answers null and writes nothing when the window has not closed yet", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, window({ closesAt: new Date(AT.getTime() + 1) })],
            })

            await expect(service.flush(flushParams(manager))).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("marks a window flushed at the instant it closes and names its owner", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, window({ closesAt: AT })],
                update: [NotifyDigestWindowEntity, { affected: 1 }],
            })

            await expect(service.flush(flushParams(manager))).resolves.toEqual({
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

        it("answers null when a concurrent flush won the guarded update", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, window({ closesAt: AT })],
                update: [NotifyDigestWindowEntity, { affected: 0 }],
            })

            await expect(service.flush(flushParams(manager))).resolves.toBeNull()
        })
    })
})
