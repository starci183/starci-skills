import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CalendarsRow } from "./persistence/calendars.rows"
import { FIND_CALENDARS } from "./persistence/calendars.sql"

interface CalendarsRequest {
    readonly id: string
}

@Injectable()
/** The calendars rows reached only through the shared primary EntityManager. */
export class CalendarsService {
    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    async calendars(request: CalendarsRequest): Promise<{ readonly id: string }> {
        const rows: Array<Pick<CalendarsRow, "id">> = await this.manager.query(FIND_CALENDARS, [request.id])
        return { id: rows[0]?.id ?? request.id }
    }

    /** Accepts one calendar delivery idempotently at the database boundary. */
    async acceptCalendarDelivery(delivery: CalendarsRequest): Promise<void> {
        await this.manager.query(FIND_CALENDARS, [delivery.id])
    }
}
