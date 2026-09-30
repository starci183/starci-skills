import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { RecurError, RecurErrorCode } from "@modules/domain/recur"
import type { Principal } from "@modules/platform/cqrs"
import { UpcomingOccurrencesQuery } from "../../application/upcoming-occurrences.query"
import { UpcomingOccurrencesResolver } from "./upcoming-occurrences.resolver"

const principal: Principal = { id: "o1", roles: ["member"] }

describe("UpcomingOccurrencesResolver", () => {
    it("dispatches one upcoming query carrying the principal and answers the occurrence picture", async () => {
        const value = { ruleId: "r1", materialised: [], previewDates: ["2026-09-18"] }
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value }) })
        await expect(new UpcomingOccurrencesResolver(queryBus).upcomingOccurrences(principal, { ruleId: "r1" })).resolves.toEqual(value)
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new UpcomingOccurrencesQuery({ request: { ruleId: "r1" }, principal }))
    })

    it("turns the refusal for a stranger into the recur error", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: RecurErrorCode.RuleForbidden }),
        })
        const call = new UpcomingOccurrencesResolver(queryBus).upcomingOccurrences(principal, { ruleId: "r1" })
        await expect(call).rejects.toBeInstanceOf(RecurError)
        await expect(call).rejects.toMatchObject({ code: RecurErrorCode.RuleForbidden })
    })
})
