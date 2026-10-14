import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { TickCli } from "./tick.cli"

describe("TickCli", () => {
    it("delegates one reminder tick to its owning capability", async () => {
        const reminders = mock<BookingRemindersService>()
        const moduleRef = await Test.createTestingModule({
            providers: [TickCli, { provide: BookingRemindersService, useValue: reminders }],
        }).compile()

        await expect(moduleRef.get(TickCli).run()).resolves.toBeUndefined()

        expect(reminders.enqueueTick).toHaveBeenCalledTimes(1)
    })
})
