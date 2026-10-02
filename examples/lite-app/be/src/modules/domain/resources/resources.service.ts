import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { acceptRowDelivery, findRowIdentity, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ResourcesRow } from "./persistence/resources.rows"
import { FIND_RESOURCES } from "./persistence/resources.sql"

interface ResourcesRequest {
    readonly id: string
}

interface ResourcesResult {
    readonly id: string
}

@Injectable()
/** The resources rows reached only through the shared primary EntityManager. */
export class ResourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    resources(request: ResourcesRequest): Promise<ResourcesResult> {
        return findRowIdentity<ResourcesRow>(this.entityManager, FIND_RESOURCES, request.id)
    }

    /** Accepts one resource delivery idempotently at the database boundary. */
    async acceptResourceDelivery(delivery: ResourcesRequest): Promise<void> {
        await acceptRowDelivery(this.entityManager, FIND_RESOURCES, delivery.id)
    }
}
