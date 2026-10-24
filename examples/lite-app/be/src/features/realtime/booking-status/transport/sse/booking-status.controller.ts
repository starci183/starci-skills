import { Controller, Headers, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { bookingStatusTopic } from "@modules/domain/bookings"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

@Controller("booking-status")
/** The push door of the caller's booking status changes: it subscribes the stream to the caller's topic of the hub and writes nothing. */
export class BookingStatusController {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The booking status changes of the caller, as server-sent events. The topic is built from the authenticated principal, so
     * another owner receives nothing; a `Last-Event-ID` header only resumes after that frame inside the caller's own topic.
     */
    @Sse("stream")
    stream(
        @CurrentPrincipal() principal: Principal,
        @Headers("last-event-id") lastEventId?: string,
    ): Observable<MessageEvent> {
        return this.hub.stream(bookingStatusTopic(principal.id), { after: lastEventId })
    }
}
