import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { ExportMyDataQuery } from "../../application/export-my-data.query"
import { ExportMyDataResolver } from "./export-my-data.resolver"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "p1", roles: ["member"] }

describe("ExportMyDataResolver", () => {
    it("dispatches one export query carrying the principal and answers the lines", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({ lines: [{ at: AT, action: "task.created", target: "t1" }] }),
        })
        const result = await new ExportMyDataResolver(queryBus).exportMyData(principal)
        expect(result).toEqual([{ at: AT, action: "task.created", target: "t1" }])
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new ExportMyDataQuery({ request: {}, principal }))
    })
})
