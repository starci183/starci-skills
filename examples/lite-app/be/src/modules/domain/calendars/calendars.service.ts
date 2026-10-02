import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { acceptRowDelivery, findRowIdentity, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CalendarsRow } from "./persistence/calendars.rows"
import { FIND_CALENDARS } from "./persistence/calendars.sql"

interface CalendarsRequest {
    readonly id: string
}

interface CalendarsResult {
    readonly id: string
}

@Injectable()
/** The calendars rows reached only through the shared primary EntityManager. */
export class CalendarsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers the requested row identity without exposing persistence types to the feature. */
    calendars(request: CalendarsRequest): Promise<CalendarsResult> {
        return findRowIdentity<CalendarsRow>(this.entityManager, FIND_CALENDARS, request.id)
    }

    /** Accepts one calendar delivery idempotently at the database boundary. */
    async acceptCalendarDelivery(delivery: CalendarsRequest): Promise<void> {
        await acceptRowDelivery(this.entityManager, FIND_CALENDARS, delivery.id)
    }
}
