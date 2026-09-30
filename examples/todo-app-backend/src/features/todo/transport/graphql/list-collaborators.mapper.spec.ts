import { toListCollaboratorsRequest, toListCollaboratorsType } from "./list-collaborators.mapper"

describe("list-collaborators mapper", () => {
    it("maps the input to the request and every invitation to a type", () => {
        expect(toListCollaboratorsRequest({ taskId: "t1" })).toEqual({ taskId: "t1" })
        const collaborator = { invitationId: "i1", email: "ann@example.com", role: "editor", status: "accepted" }
        expect(toListCollaboratorsType({ collaborators: [collaborator] })).toEqual([collaborator])
        expect(toListCollaboratorsType({ collaborators: [] })).toEqual([])
    })
})
