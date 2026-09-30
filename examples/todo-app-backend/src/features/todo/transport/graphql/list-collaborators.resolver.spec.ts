import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { ListCollaboratorsQuery } from "../../application/list-collaborators.query"
import { ListCollaboratorsResolver } from "./list-collaborators.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("ListCollaboratorsResolver", () => {
    it("dispatches one list query carrying the principal and answers the invitations", async () => {
        const collaborator = { invitationId: "i1", email: "ann@example.com", role: "editor", status: "accepted" }
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ collaborators: [collaborator] }) })
        const result = await new ListCollaboratorsResolver(queryBus).collaborators(principal, { taskId: "t1" })
        expect(result).toEqual([collaborator])
        expect(queryBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledWith(new ListCollaboratorsQuery({ request: { taskId: "t1" }, principal }))
    })
})
