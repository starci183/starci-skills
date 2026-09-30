import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { ListTasksQuery } from "../../application/list-tasks.query"
import { ListTasksResolver } from "./list-tasks.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("ListTasksResolver", () => {
    it("dispatches one list query carrying the principal and answers the tasks", async () => {
        const queryBus = mock<QueryBus>({
            execute: jest.fn().mockResolvedValue({ tasks: [{ taskId: "t1", title: "A", complete: false }] }),
        })
        const result = await new ListTasksResolver(queryBus).tasks(principal)
        expect(result).toEqual([{ taskId: "t1", title: "A", complete: false }])
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new ListTasksQuery({ request: {}, principal }))
    })
})
