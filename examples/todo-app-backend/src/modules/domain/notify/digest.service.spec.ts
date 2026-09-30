import { Test } from "@nestjs/testing"
import { fakeIds, mockEntityManager } from "@starci/jest-preset"
import { IDS } from "@modules/platform/ids"
import { IsNull } from "typeorm"
import { NOTIFY_AT, admitIntoWindowInput, digestWindowRow, flushWindowInput } from "@tests/fixtures/builders/notify.builder"
import { DigestService } from "./digest.service"
import { NotifyDigestWindowEntity } from "./persistence/entities/digest-window.entity"

const AT = new Date(NOTIFY_AT)
const MINUTE = 60_000

const build = async () => {
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [DigestService, { provide: IDS, useValue: ids }],
    }).compile()
    return moduleRef.get(DigestService)
}

describe("DigestService", () => {
    describe("admit", () => {
        it("joins the open window of the person and the channel without writing", async () => {
            const service = await build()
            const open = digestWindowRow()
            const manager = mockEntityManager({ findOneBy: [NotifyDigestWindowEntity, open] })

            const admitted = await service.admit({ manager, ...admitIntoWindowInput() })

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
                save: [NotifyDigestWindowEntity, digestWindowRow({ id: "w-new", closesAt })],
            })

            const admitted = await service.admit({ manager, ...admitIntoWindowInput() })

            expect(admitted).toEqual({ windowId: "w-new", opened: true, closesAt })
            expect(manager.save).toHaveBeenCalledWith(NotifyDigestWindowEntity, {
                id: "00000000-0000-4000-8000-000000000001",
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
                findOneBy: [NotifyDigestWindowEntity, digestWindowRow({ closesAt: AT })],
                save: [NotifyDigestWindowEntity, digestWindowRow({ id: "w2", closesAt })],
            })

            const admitted = await service.admit({ manager, ...admitIntoWindowInput({ windowMinutes: 3 }) })

            expect(admitted).toEqual({ windowId: "w2", opened: true, closesAt })
            expect(manager.save).toHaveBeenCalledWith(
                NotifyDigestWindowEntity,
                expect.objectContaining({ closesAt }),
            )
        })

        it("opens a new window when the open one closed before the admission instant", async () => {
            const service = await build()
            const stale = digestWindowRow({ closesAt: new Date(AT.getTime() - MINUTE) })
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, stale],
                save: [NotifyDigestWindowEntity, digestWindowRow({ id: "w3" })],
            })

            const admitted = await service.admit({ manager, ...admitIntoWindowInput() })

            expect(admitted.opened).toBe(true)
            expect(admitted.windowId).toBe("w3")
        })
    })

    describe("flush", () => {
        it("answers null and writes nothing when the window does not exist", async () => {
            const service = await build()
            const manager = mockEntityManager({ findOneBy: [NotifyDigestWindowEntity, null] })

            await expect(service.flush({ manager, ...flushWindowInput() })).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("answers null and writes nothing when the window was flushed already", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, digestWindowRow({ closesAt: AT, flushedAt: AT })],
            })

            await expect(service.flush({ manager, ...flushWindowInput() })).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("answers null and writes nothing when the window has not closed yet", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, digestWindowRow({ closesAt: new Date(AT.getTime() + 1) })],
            })

            await expect(service.flush({ manager, ...flushWindowInput() })).resolves.toBeNull()
            expect(manager.update).not.toHaveBeenCalled()
        })

        it("marks a window flushed at the instant it closes and names its owner", async () => {
            const service = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyDigestWindowEntity, digestWindowRow({ closesAt: AT })],
                update: [NotifyDigestWindowEntity, { affected: 1 }],
            })

            await expect(service.flush({ manager, ...flushWindowInput() })).resolves.toEqual({
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
                findOneBy: [NotifyDigestWindowEntity, digestWindowRow({ closesAt: AT })],
                update: [NotifyDigestWindowEntity, { affected: 0 }],
            })

            await expect(service.flush({ manager, ...flushWindowInput() })).resolves.toBeNull()
        })
    })
})
