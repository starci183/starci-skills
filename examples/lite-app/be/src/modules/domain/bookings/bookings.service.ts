import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ResourcesService } from "@modules/domain/resources"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import type { BookingsRow } from "./persistence/bookings.rows"
import { FIND_BOOKINGS } from "./persistence/bookings.sql"

interface BookingsResult {
    readonly id: string
    readonly resourceId: string
    readonly startsAt: string
    readonly endsAt: string
}

@Injectable()
/** The bookings rows reached only through the shared primary EntityManager. */
export class BookingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly resources: ResourcesService,
    ) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    async bookings(principalId: string, id: string): Promise<BookingsResult> {
        const row = await requireOwnedRow<Pick<BookingsRow, "id" | "resource_id" | "starts_at" | "ends_at">>(
            this.entityManager,
            FIND_BOOKINGS,
            id,
            principalId,
            () => {
                throw new BookingsError({ code: BookingsErrorCode.NotFound, params: { id } })
            },
        )
        await this.resources.resources(principalId, row.resource_id)
        return { id: row.id, resourceId: row.resource_id, startsAt: row.starts_at, endsAt: row.ends_at }
    }
}
