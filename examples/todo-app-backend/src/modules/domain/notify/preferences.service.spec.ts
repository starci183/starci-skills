import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    changePreferenceInput,
    findPreferenceInput,
    preferenceRow,
    unsubscribeInput,
    updatePreferenceInput,
} from "@tests/fixtures/builders/notify.builder"
import { NotifyErrorCode } from "./errors/notify.error"
import { NotifyPreferenceEntity } from "./persistence/entities/preference.entity"
import { PreferencesService } from "./preferences.service"

const build = async (stored = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [PreferencesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: stored }],
    }).compile()
    return { service: moduleRef.get(PreferencesService), stored }
}

describe("PreferencesService", () => {
    describe("get", () => {
        it("reads the stored preference of the pair", async () => {
            const { service, stored } = await build(
                mockEntityManager({ findOneBy: [NotifyPreferenceEntity, preferenceRow({ unsubscribed: true, digestWindowMinutes: 30 })] }),
            )

            await expect(service.get(findPreferenceInput())).resolves.toEqual({
                personId: "p1",
                channel: "email",
                unsubscribed: true,
                digestWindowMinutes: 30,
            })
            expect(stored.findOneBy).toHaveBeenCalledWith(NotifyPreferenceEntity, { personId: "p1", channel: "email" })
        })

        it("reads the default when nothing was ever written", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [NotifyPreferenceEntity, null] }))

            await expect(service.get(findPreferenceInput())).resolves.toEqual({
                personId: "p1",
                channel: "email",
                unsubscribed: false,
                digestWindowMinutes: null,
            })
        })
    })

    describe("read", () => {
        it("answers the stored preference without the person id", async () => {
            const { service } = await build(
                mockEntityManager({ findOneBy: [NotifyPreferenceEntity, preferenceRow({ digestWindowMinutes: 15 })] }),
            )

            await expect(service.read(findPreferenceInput())).resolves.toEqual({
                channel: "email",
                unsubscribed: false,
                digestWindowMinutes: 15,
            })
        })

        it("answers the defaults when nothing was ever written", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [NotifyPreferenceEntity, null] }))

            await expect(service.read(findPreferenceInput({ channel: "sms" }))).resolves.toEqual({
                channel: "sms",
                unsubscribed: false,
                digestWindowMinutes: null,
            })
        })
    })

    describe("update", () => {
        it("refuses a blank channel and touches nothing", async () => {
            const { service } = await build()
            const manager = mockEntityManager()

            await expect(
                service.update({ manager, ...updatePreferenceInput({ channel: "   ", patch: { unsubscribed: true } }) }),
            ).resolves.toBeRefused(NotifyErrorCode.ChannelRequired)
        })

        it.each([0, -5, 1.5])("refuses the digest window of %s minutes and touches nothing", async (minutes) => {
            const { service } = await build()
            const manager = mockEntityManager()

            await expect(
                service.update({ manager, ...updatePreferenceInput({ patch: { digestWindowMinutes: minutes } }) }),
            ).resolves.toBeRefused({ code: NotifyErrorCode.DigestWindowInvalid, params: { minutes } })
        })

        it("writes the defaults for a pair with no row and an empty patch", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyPreferenceEntity, null],
                save: [NotifyPreferenceEntity, preferenceRow()],
            })

            await expect(service.update({ manager, ...updatePreferenceInput() })).resolves.toSucceedWith({
                personId: "p1",
                channel: "email",
                unsubscribed: false,
                digestWindowMinutes: null,
            })
            expect(manager.save).toHaveBeenCalledWith(NotifyPreferenceEntity, {
                personId: "p1",
                channel: "email",
                unsubscribed: false,
                digestWindowMinutes: null,
            })
        })

        it("keeps the stored values of the fields the patch omits", async () => {
            const { service } = await build()
            const existing = preferenceRow({ unsubscribed: true, digestWindowMinutes: 20 })
            const manager = mockEntityManager({
                findOneBy: [NotifyPreferenceEntity, existing],
                save: [NotifyPreferenceEntity, existing],
            })

            await service.update({ manager, ...updatePreferenceInput() })

            expect(manager.save).toHaveBeenCalledWith(NotifyPreferenceEntity, {
                personId: "p1",
                channel: "email",
                unsubscribed: true,
                digestWindowMinutes: 20,
            })
        })

        it("replaces both fields when the patch names them", async () => {
            const { service } = await build()
            const saved = preferenceRow({ unsubscribed: true, digestWindowMinutes: 5 })
            const manager = mockEntityManager({
                findOneBy: [NotifyPreferenceEntity, preferenceRow({ digestWindowMinutes: 20 })],
                save: [NotifyPreferenceEntity, saved],
            })

            await expect(
                service.update({ manager, ...updatePreferenceInput({ patch: { unsubscribed: true, digestWindowMinutes: 5 } }) }),
            ).resolves.toSucceedWith({ personId: "p1", channel: "email", unsubscribed: true, digestWindowMinutes: 5 })
            expect(manager.save).toHaveBeenCalledWith(
                NotifyPreferenceEntity,
                expect.objectContaining({ unsubscribed: true, digestWindowMinutes: 5 }),
            )
        })

        it("clears the window override when the patch names null", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                findOneBy: [NotifyPreferenceEntity, preferenceRow({ digestWindowMinutes: 20 })],
                save: [NotifyPreferenceEntity, preferenceRow()],
            })

            await service.update({ manager, ...updatePreferenceInput({ patch: { digestWindowMinutes: null } }) })

            expect(manager.save).toHaveBeenCalledWith(
                NotifyPreferenceEntity,
                expect.objectContaining({ digestWindowMinutes: null }),
            )
        })
    })

    describe("change", () => {
        it("writes the changed fields in one committed transaction and answers the stored preference", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneBy: [NotifyPreferenceEntity, null],
                    save: [NotifyPreferenceEntity, preferenceRow({ unsubscribed: true, digestWindowMinutes: 12 })],
                }),
            )
            const { service } = await build(tx.em)

            await expect(
                service.change(changePreferenceInput({ unsubscribed: true, digestWindowMinutes: 12 })),
            ).resolves.toSucceedWith({ channel: "email", unsubscribed: true, digestWindowMinutes: 12 })

            expect(tx.commits).toBe(1)
            expect(tx.committedWrites).toEqual([
                {
                    method: "save",
                    args: [
                        NotifyPreferenceEntity,
                        { personId: "p1", channel: "email", unsubscribed: true, digestWindowMinutes: 12 },
                    ],
                },
            ])
        })

        it("refuses an invalid window and commits nothing written", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service } = await build(tx.em)

            await expect(
                service.change(changePreferenceInput({ digestWindowMinutes: 0 })),
            ).resolves.toBeRefused(NotifyErrorCode.DigestWindowInvalid)

            expect(tx.committedWrites).toEqual([])
        })
    })

    describe("unsubscribe", () => {
        it("saves the opt-out in one committed transaction and answers the channel", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    findOneBy: [NotifyPreferenceEntity, preferenceRow({ digestWindowMinutes: 9 })],
                    save: [NotifyPreferenceEntity, preferenceRow({ unsubscribed: true, digestWindowMinutes: 9 })],
                }),
            )
            const { service } = await build(tx.em)

            await expect(service.unsubscribe(unsubscribeInput())).resolves.toSucceedWith({
                channel: "email",
                unsubscribed: true,
            })

            expect(tx.commits).toBe(1)
            expect(tx.committedWrites).toEqual([
                {
                    method: "save",
                    args: [
                        NotifyPreferenceEntity,
                        { personId: "p1", channel: "email", unsubscribed: true, digestWindowMinutes: 9 },
                    ],
                },
            ])
        })

        it("refuses a blank channel and writes nothing", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { service } = await build(tx.em)

            await expect(service.unsubscribe(unsubscribeInput({ channel: "" }))).resolves.toBeRefused(
                NotifyErrorCode.ChannelRequired,
            )

            expect(tx.committedWrites).toEqual([])
        })
    })
})
