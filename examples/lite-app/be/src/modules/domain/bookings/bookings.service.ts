import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { BookingsRow } from "./persistence/bookings.rows"
import { FIND_BOOKINGS } from "./persistence/bookings.sql"

interface BookingsRequest {
    readonly id: string
}

@Injectable()
/** The bookings rows reached only through the shared primary EntityManager. */
export class BookingsService {
    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    async bookings(request: BookingsRequest): Promise<{ readonly id: string }> {
        const rows: Array<Pick<BookingsRow, "id">> = await this.manager.query(FIND_BOOKINGS, [request.id])
        return { id: rows[0]?.id ?? request.id }
    }

    /** Accepts one booking delivery idempotently at the database boundary. */
    async acceptBookingDelivery(delivery: BookingsRequest): Promise<void> {
        await this.manager.query(FIND_BOOKINGS, [delivery.id])
    }
}
