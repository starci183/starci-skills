import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ResourcesService } from "@modules/domain/resources"
import { InjectPrimaryEntityManager, requireOwnedRow } from "@modules/platform/database"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { BookingConfirmationQueue, isConfirmBookingPayload } from "@modules/queues/booking-confirmation"
import { BookingReminderQueue, isBookingReminderPayload, isBookingReminderTick } from "@modules/queues/booking-reminder"
import type { BookingResult, BookingStatusResult, CreateBookingParams } from "./bookings.contracts"
import { bookingStatusFrame, bookingStatusTopic } from "./bookings.policy"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"
import type { BookingsRow } from "./persistence/bookings.rows"
import {
    CONFIRM_BOOKING,
    FIND_BOOKING_STATUS,
    INSERT_BOOKING,
    REMIND_BOOKING,
    REMIND_DUE_BOOKINGS,
} from "./persistence/bookings.sql"

/** The PostgreSQL code of an exclusion-constraint violation: the interval overlaps another booking of the resource. */
const EXCLUSION_VIOLATION = "23P01"

type InsertedBooking = Pick<BookingsRow, "id" | "resource_id" | "starts_at" | "ends_at" | "status">

type ConfirmedBooking = Pick<BookingsRow, "id" | "owner_id">

const isIntervalTaken = (cause: unknown): boolean =>
    typeof cause === "object" && cause !== null && "code" in cause && cause.code === EXCLUSION_VIOLATION

@Injectable()
/** The bookings rows reached only through the shared primary EntityManager. */
export class BookingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly resources: ResourcesService,
        private readonly confirmations: BookingConfirmationQueue,
        private readonly reminders: BookingReminderQueue,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
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
            await this.reminders.enqueueRemindBooking({ bookingId: row.id }, tx)
            return {
                id: row.id,
                resourceId: row.resource_id,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                status: row.status,
            }
        })
    }

    /**
     * The confirmation status of one booking the caller owns, polled after booking until the confirm-booking job ran; absent and
     * denied bookings share one typed not-found result.
     */
    bookingStatus(principalId: string, id: string): Promise<BookingStatusResult> {
        return requireOwnedRow<BookingStatusResult>(this.entityManager, FIND_BOOKING_STATUS, id, principalId, () => {
            throw new BookingsError({ code: BookingsErrorCode.NotFound, params: { id } })
        })
    }

    /**
     * The effect of one confirm-booking job: the pending booking becomes confirmed, and once that write is committed its owner is
     * pushed the new status on the booking-status channel. A confirmed booking answers no row, so a repeated job pushes nothing.
     * Any other payload changes nothing.
     */
    async confirmBooking(payload: object): Promise<void> {
        if (!isConfirmBookingPayload(payload)) return
        const confirmed = await this.entityManager.query<Array<ConfirmedBooking>>(CONFIRM_BOOKING, [payload.bookingId])
        for (const booking of confirmed) {
            this.hub.publish(bookingStatusTopic(booking.owner_id), bookingStatusFrame(booking.id, "confirmed"))
        }
    }

    /**
     * The effect of one send-reminder job: the booking it names is marked reminded; for the pg_cron tick every confirmed
     * booking due a reminder is. Any other payload changes nothing.
     */
    async remindBooking(payload: object): Promise<void> {
        if (isBookingReminderTick(payload)) {
            await this.entityManager.query(REMIND_DUE_BOOKINGS)
            return
        }
        if (!isBookingReminderPayload(payload)) return
        await this.entityManager.query(REMIND_BOOKING, [payload.bookingId])
    }
}
