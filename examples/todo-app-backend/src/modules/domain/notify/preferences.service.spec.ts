import { mockEntityManager } from "@tests/fixtures/database"
import { NotifyErrorCode } from "./errors/notify.error"
import { NotifyPreferenceEntity } from "./persistence/entities/preference.entity"
import { PreferencesService } from "./preferences.service"

const echoSave = jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

const stored = Object.assign(new NotifyPreferenceEntity(), {
    personId: "p1",
    channel: "email",
    unsubscribed: true,
    digestWindowMinutes: 5,
})

describe("PreferencesService", () => {
    it("reads the default when no preference was ever written", async () => {
        const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
        await expect(new PreferencesService(own).get({ personId: "p1", channel: "email" })).resolves.toEqual({
            personId: "p1",
            channel: "email",
            unsubscribed: false,
            digestWindowMinutes: null,
        })
        expect(own.findOneBy).toHaveBeenCalledWith(NotifyPreferenceEntity, { personId: "p1", channel: "email" })
    })

    it("reads a stored preference", async () => {
        const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(stored) })
        await expect(new PreferencesService(own).get({ personId: "p1", channel: "email" })).resolves.toEqual({
            personId: "p1",
            channel: "email",
            unsubscribed: true,
            digestWindowMinutes: 5,
        })
    })

    it("writes a first preference on top of the defaults through the manager it was given", async () => {
        const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), save: echoSave })
        const outcome = await new PreferencesService(mockEntityManager()).update({
            manager: inTransaction,
            personId: "p1",
            channel: "email",
            patch: { unsubscribed: true },
        })
        expect(outcome).toEqual({
            kind: "ok",
            value: { personId: "p1", channel: "email", unsubscribed: true, digestWindowMinutes: null },
        })
        expect(inTransaction.save).toHaveBeenCalledWith(NotifyPreferenceEntity, {
            personId: "p1",
            channel: "email",
            unsubscribed: true,
            digestWindowMinutes: null,
        })
    })

    it("keeps the omitted fields of the stored preference", async () => {
        const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(stored), save: echoSave })
        const outcome = await new PreferencesService(mockEntityManager()).update({
            manager: inTransaction,
            personId: "p1",
            channel: "email",
            patch: { digestWindowMinutes: 20 },
        })
        expect(outcome).toMatchObject({ kind: "ok", value: { unsubscribed: true, digestWindowMinutes: 20 } })
    })

    it("clears the window override when the patch says null", async () => {
        const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(stored), save: echoSave })
        const outcome = await new PreferencesService(mockEntityManager()).update({
            manager: inTransaction,
            personId: "p1",
            channel: "email",
            patch: { digestWindowMinutes: null },
        })
        expect(outcome).toMatchObject({ kind: "ok", value: { unsubscribed: true, digestWindowMinutes: null } })
    })

    it("refuses a blank channel and writes nothing", async () => {
        const inTransaction = mockEntityManager({ save: jest.fn() })
        const outcome = await new PreferencesService(mockEntityManager()).update({
            manager: inTransaction,
            personId: "p1",
            channel: "  ",
            patch: { unsubscribed: true },
        })
        expect(outcome).toMatchObject({ kind: "refused", code: NotifyErrorCode.ChannelRequired })
        expect(inTransaction.save).not.toHaveBeenCalled()
    })

    it("refuses a window below one minute or a fractional one and writes nothing", async () => {
        const inTransaction = mockEntityManager({ save: jest.fn() })
        const service = new PreferencesService(mockEntityManager())
        for (const minutes of [0, -5, 1.5]) {
            const outcome = await service.update({
                manager: inTransaction,
                personId: "p1",
                channel: "email",
                patch: { digestWindowMinutes: minutes },
            })
            expect(outcome).toMatchObject({ kind: "refused", code: NotifyErrorCode.DigestWindowInvalid })
        }
        expect(inTransaction.save).not.toHaveBeenCalled()
    })
})
