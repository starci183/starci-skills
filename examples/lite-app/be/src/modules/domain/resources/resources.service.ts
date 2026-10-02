import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ResourcesRow } from "./persistence/resources.rows"
import { FIND_RESOURCES } from "./persistence/resources.sql"

interface ResourcesRequest {
    readonly id: string
}

@Injectable()
/** The resources rows reached only through the shared primary EntityManager. */
export class ResourcesService {
    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    async resources(request: ResourcesRequest): Promise<{ readonly id: string }> {
        const rows: Array<Pick<ResourcesRow, "id">> = await this.manager.query(FIND_RESOURCES, [request.id])
        return { id: rows[0]?.id ?? request.id }
    }

    /** Accepts one resource delivery idempotently at the database boundary. */
    async acceptResourceDelivery(delivery: ResourcesRequest): Promise<void> {
        await this.manager.query(FIND_RESOURCES, [delivery.id])
    }
}
