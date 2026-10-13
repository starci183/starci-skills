import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ResourcesService } from "@modules/domain/resources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BookingConfirmationQueue, isConfirmBookingPayload } from "@modules/queues/booking-confirmation"
import type { BookingResult, CreateBookingParams } from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import type { BookingsRow } from "./persistence/bookings.rows"
import { CONFIRM_BOOKING, INSERT_BOOKING } from "./persistence/bookings.sql"

/** The PostgreSQL code of an exclusion-constraint violation: the interval overlaps another booking of the resource. */
const EXCLUSION_VIOLATION = "23P01"

type InsertedBooking = Pick<BookingsRow, "id" | "resource_id" | "starts_at" | "ends_at" | "status">

const isIntervalTaken = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === EXCLUSION_VIOLATION

@Injectable()
/** The bookings rows reached only through the shared primary EntityManager. */
export class BookingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly resources: ResourcesService,
        private readonly confirmations: BookingConfirmationQueue,
    ) {}

    /**
     * Books a resource of the caller: the pending booking and its confirm-booking job are written in one transaction, so the job
     * exists exactly when the booking does. An interval that overlaps another booking of the resource is refused.
     */
    async createBooking(principalId: string, params: CreateBookingParams): Promise<BookingResult> {
        await this.resources.resources(principalId, params.resourceId)
        return this.entityManager.transaction(async (tx) => {
            const [row] = await tx
                .query<Array<InsertedBooking>>(INSERT_BOOKING, [
                    principalId,
                    params.resourceId,
                    params.startsAt,
                    params.endsAt,
                ])
                .catch((cause: unknown) => {
                    if (!isIntervalTaken(cause)) throw cause
                    throw new BookingsError({
                        code: BookingsErrorCode.IntervalTaken,
                        params: { resourceId: params.resourceId },
                        cause,
                    })
                })
            if (row === undefined) throw new BookingsError({ code: BookingsErrorCode.NotCreated })
            await this.confirmations.enqueueConfirmBooking({ bookingId: row.id }, tx)
            return {
                id: row.id,
                resourceId: row.resource_id,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                status: row.status,
            }
        })
    }

    /** The effect of one confirm-booking job: the pending booking becomes confirmed. Any other payload changes nothing. */
    async confirmBooking(payload: object): Promise<void> {
        if (!isConfirmBookingPayload(payload)) return
        await this.entityManager.query(CONFIRM_BOOKING, [payload.bookingId])
    }
}
