import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { CalendarsError, CalendarsErrorCode } from "./errors/calendars.error"
import type { CalendarsRow } from "./persistence/calendars.rows"
import { FIND_CALENDARS, FIND_DELIVERY_CALENDAR, INSERT_CALENDARS } from "./persistence/calendars.sql"

/** One verified delivery of the calendar notifier: the calendar it targets. */
interface CalendarDelivery {
    readonly id: string
}

/** What the capability answers for one row: its id. */
type CalendarsResult = Pick<CalendarsRow, "id">

/** Throws the typed not-found error of one id: absent and denied rows share it. */
const notFound = (id: string): never => {
    throw new CalendarsError({ code: CalendarsErrorCode.NotFound, params: { id } })
}

/** The row an insert answered; an insert that answered none throws the typed not-created error. */
const createdRow = ([row]: ReadonlyArray<CalendarsResult>): CalendarsResult => {
    if (row === undefined) throw new CalendarsError({ code: CalendarsErrorCode.NotCreated })
    return row
}

@Injectable()
/** The calendars rows reached only through the shared primary EntityManager. */
export class CalendarsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Answers one row owned by the authenticated principal; absent and denied rows share one typed not-found result. */
    calendars(principalId: string, id: string): Promise<CalendarsResult> {
        return requireOwnedRow<CalendarsResult>(this.entityManager, FIND_CALENDARS, id, principalId, notFound)
    }

    /** Creates one row owned by the authenticated principal and answers its id. */
    createCalendar(principalId: string): Promise<CalendarsResult> {
        return this.entityManager.query<Array<CalendarsResult>>(INSERT_CALENDARS, [principalId]).then(createdRow)
    }

    /** Resolves one verified delivery target; the inbox generator supplies its transaction manager. */
    async acceptCalendarDelivery(
        delivery: CalendarDelivery,
        entityManager: EntityManager = this.entityManager,
    ): Promise<void> {
        const [row] = await entityManager.query<Array<CalendarsResult>>(FIND_DELIVERY_CALENDAR, [delivery.id])
        if (row === undefined) notFound(delivery.id)
    }
}
