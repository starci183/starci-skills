import { mock } from "@starci/jest-preset/mock"
import { AccountErrorCode } from "@modules/domain/account"
import type { AccountService } from "@modules/domain/account"
import type { OrderApiClient } from "@modules/integrations/order-api"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { GetAccountQuery } from "./get-account.query"
import { GetAccountHandler } from "./get-account.handler"

const principal: Principal = { id: "p-1", roles: ["member"] }
const query = new GetAccountQuery({ request: { sessionToken: "tok" }, principal })

describe("GetAccountHandler", () => {
    it("joins the account of the caller with the buyer status read through the forwarded token", async () => {
        const accounts = mock<AccountService>({
            getAccount: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1", email: "a@example.com" } }),
        })
        const orderApi = mock<OrderApiClient>({
            getBuyerStatus: jest.fn().mockResolvedValue({ personId: "p-1", hasOrders: true }),
        })
        await expect(new GetAccountHandler(mock<Logger>(), orderApi, accounts).execute(query)).resolves.toEqual({
            kind: "ok",
            value: { personId: "p-1", email: "a@example.com", hasOrders: true },
        })
        expect(accounts.getAccount).toHaveBeenCalledWith({ personId: "p-1" })
        expect(orderApi.getBuyerStatus).toHaveBeenCalledWith("tok")
    })

    it("refuses without calling the order service when the person is unknown", async () => {
        const accounts = mock<AccountService>({
            getAccount: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.PersonUnknown }),
        })
        const orderApi = mock<OrderApiClient>()
        await expect(new GetAccountHandler(mock<Logger>(), orderApi, accounts).execute(query)).resolves.toMatchObject({
            kind: "refused",
            code: AccountErrorCode.PersonUnknown,
        })
        expect(orderApi.getBuyerStatus).not.toHaveBeenCalled()
    })

    it("fails with the order api error instead of answering hasOrders false when the order service is down", async () => {
        const accounts = mock<AccountService>({
            getAccount: jest.fn().mockResolvedValue({ kind: "ok", value: { personId: "p-1", email: "a@example.com" } }),
        })
        const orderApi = mock<OrderApiClient>({ getBuyerStatus: jest.fn().mockRejectedValue(new TypeError("down")) })
        await expect(new GetAccountHandler(mock<Logger>(), orderApi, accounts).execute(query)).rejects.toThrow("down")
    })
})
