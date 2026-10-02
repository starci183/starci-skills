import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ResourcesService } from "@modules/domain/resources"
import { acceptRowDelivery, findRowIdentity, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingsRow } from "./persistence/bookings.rows"
import { FIND_BOOKINGS } from "./persistence/bookings.sql"

interface BookingsRequest {
    readonly id: string
}

interface BookingsResult {
    readonly id: string
}

@Injectable()
/** The bookings rows reached only through the shared primary EntityManager. */
export class BookingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly resources: ResourcesService,
    ) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    async bookings(request: BookingsRequest): Promise<BookingsResult> {
        const resource = await this.resources.resources(request)
        return findRowIdentity<BookingsRow>(this.entityManager, FIND_BOOKINGS, resource.id)
    }

    /** Accepts one booking delivery idempotently at the database boundary. */
    async acceptBookingDelivery(delivery: BookingsRequest): Promise<void> {
        await acceptRowDelivery(this.entityManager, FIND_BOOKINGS, delivery.id)
    }
}
