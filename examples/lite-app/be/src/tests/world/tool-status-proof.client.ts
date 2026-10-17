import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import { GetToolStatusQuery, StatusController } from "@features/api/tool-status"

/** Arranges the status transport collaborator and its expected typed query. */
export const createToolStatusProof = () => {
    const queryBus = mock<QueryBus>()
    return {
        queryBus,
        controller: new StatusController(queryBus),
        query: (id: string) => new GetToolStatusQuery({ request: { id } }),
    }
}
