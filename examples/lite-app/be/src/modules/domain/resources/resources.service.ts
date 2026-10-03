import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { ResourcesError, ResourcesErrorCode } from "./errors/resources.error"
import type { ResourcesRow } from "./persistence/resources.rows"
import { FIND_RESOURCES } from "./persistence/resources.sql"

interface ResourcesResult {
    readonly id: string
}

@Injectable()
/** The resources rows reached only through the shared primary EntityManager. */
export class ResourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    resources(principalId: string, id: string): Promise<ResourcesResult> {
        return requireOwnedRow<Pick<ResourcesRow, "id">>(this.entityManager, FIND_RESOURCES, id, principalId, () => {
            throw new ResourcesError({ code: ResourcesErrorCode.NotFound, params: { id } })
        })
    }
}
