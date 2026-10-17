import { Test } from "@nestjs/testing"
import { BookingReminderCli } from "./booking-reminder.cli"

describe("BookingReminderCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [BookingReminderCli] }).compile()
        const group = moduleRef.get(BookingReminderCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
