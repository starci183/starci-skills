import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { AccountError, AccountErrorCode } from "@modules/domain/account"
import type { Principal } from "@modules/platform/cqrs"
import { GetAccountQuery } from "../../application/get-account.query"
import { AccountResolver } from "./account.resolver"

const principal: Principal = { id: "p-1", roles: ["member"] }

describe("AccountResolver", () => {
    it("dispatches one account query carrying the principal and the forwarded token", async () => {
        const overview = { personId: "p-1", email: "a@example.com", hasOrders: false }
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: overview }) })
        await expect(new AccountResolver(queryBus).account(principal, "tok")).resolves.toEqual(overview)
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new GetAccountQuery({ request: { sessionToken: "tok" }, principal }))
    })

    it("turns the refusal of an unknown person into the account error", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ kind: "refused", code: AccountErrorCode.PersonUnknown }) })
        await expect(new AccountResolver(queryBus).account(principal, "tok")).rejects.toBeInstanceOf(AccountError)
    })
})
