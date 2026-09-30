import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { NotifyError, NotifyErrorCode } from "@modules/domain/notify"
import type { Principal } from "@modules/platform/cqrs"
import { UnsubscribeCommand } from "../../application/unsubscribe.command"
import { UnsubscribeResolver } from "./unsubscribe.resolver"

const principal: Principal = { id: "person-1", roles: ["member"] }

describe("UnsubscribeResolver", () => {
    it("dispatches one unsubscribe command for the caller on the requested channel", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { channel: "push", unsubscribed: true } }),
        })
        const result = await new UnsubscribeResolver(commandBus).unsubscribe(principal, { channel: "push" })
        expect(result).toEqual({ channel: "push", unsubscribed: true })
        expect(commandBus.execute).toHaveBeenCalledWith(
            new UnsubscribeCommand({ request: { channel: "push" }, principal }),
        )
    })

    it("turns a refusal into the notify error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: NotifyErrorCode.ChannelRequired }),
        })
        await expect(new UnsubscribeResolver(commandBus).unsubscribe(principal, { channel: " " })).rejects.toBeInstanceOf(
            NotifyError,
        )
    })
})
