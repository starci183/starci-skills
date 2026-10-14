import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { ResourcesError, ResourcesErrorCode } from "./errors/resources.error"
import type { ResourcesRow } from "./persistence/resources.rows"
import { FIND_RESOURCES, INSERT_RESOURCES } from "./persistence/resources.sql"

/** What the capability answers for one row: its id. */
type ResourcesResult = Pick<ResourcesRow, "id">

/** Throws the typed not-found error of one id: absent and denied rows share it. */
const notFound = (id: string): never => {
    throw new ResourcesError({ code: ResourcesErrorCode.NotFound, params: { id } })
}

/** The row an insert answered; an insert that answered none throws the typed not-created error. */
const createdRow = ([row]: ReadonlyArray<ResourcesResult>): ResourcesResult => {
    if (row === undefined) throw new ResourcesError({ code: ResourcesErrorCode.NotCreated })
    return row
}

@Injectable()
/** The resources rows reached only through the shared primary EntityManager. */
export class ResourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    resources(principalId: string, id: string): Promise<ResourcesResult> {
        return requireOwnedRow<ResourcesResult>(this.entityManager, FIND_RESOURCES, id, principalId, notFound)
    }

    /** Creates one row owned by the authenticated principal and answers its id. */
    createResource(principalId: string): Promise<ResourcesResult> {
        return this.entityManager.query<Array<ResourcesResult>>(INSERT_RESOURCES, [principalId]).then(createdRow)
    }
}
