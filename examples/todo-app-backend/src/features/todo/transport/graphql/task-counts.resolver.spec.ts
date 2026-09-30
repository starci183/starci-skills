import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { TaskCountsQuery } from "../../application/task-counts.query"
import { TaskCountsResolver } from "./task-counts.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("TaskCountsResolver", () => {
    it("dispatches one counts query carrying the principal and answers the counts", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ open: 2, complete: 1 }) })
        const result = await new TaskCountsResolver(queryBus).taskCounts(principal)
        expect(result).toEqual({ open: 2, complete: 1 })
        expect(queryBus.execute).toHaveBeenCalledWith(new TaskCountsQuery({ request: {}, principal }))
    })
})
