import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { CalendarsError, CalendarsErrorCode } from "./errors/calendars.error"
import type { CalendarsRow } from "./persistence/calendars.rows"
import { FIND_CALENDARS, FIND_DELIVERY_CALENDAR, INSERT_CALENDARS } from "./persistence/calendars.sql"

interface CalendarDelivery {
    readonly id: string
}

interface CalendarsResult {
    readonly id: string
}

@Injectable()
/** The calendars rows reached only through the shared primary EntityManager. */
export class CalendarsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    calendars(principalId: string, id: string): Promise<CalendarsResult> {
        return requireOwnedRow<Pick<CalendarsRow, "id">>(this.entityManager, FIND_CALENDARS, id, principalId, () => {
            throw new CalendarsError({ code: CalendarsErrorCode.NotFound, params: { id } })
        })
    }

    /** Creates one row owned by the authenticated principal and answers its id. */
    async createCalendar(principalId: string): Promise<CalendarsResult> {
        const [row] = await this.entityManager.query<Array<Pick<CalendarsRow, "id">>>(INSERT_CALENDARS, [principalId])
        if (row === undefined) throw new CalendarsError({ code: CalendarsErrorCode.NotCreated })
        return { id: row.id }
    }

    /** Resolves one verified delivery target; the inbox generator supplies its transaction manager. */
    async acceptCalendarDelivery(
        delivery: CalendarDelivery,
        entityManager: EntityManager = this.entityManager,
    ): Promise<void> {
        const rows = await entityManager.query<Array<Pick<CalendarsRow, "id">>>(FIND_DELIVERY_CALENDAR, [delivery.id])
        if (rows[0] === undefined) {
            throw new CalendarsError({ code: CalendarsErrorCode.NotFound, params: { id: delivery.id } })
        }
    }
}
