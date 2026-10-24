import { Controller, Headers, Sse } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { @@service@@ } from "@@serviceModule@@"
import { CurrentPrincipal } from "@modules/domain/identity"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"

@Controller("@@channel@@")
/** The push-only @@channel@@ door: the default guards authenticate the stream, and it writes nothing. */
export class @@Channel@@Controller {
    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /**
     * The changes of the caller's @@channel@@, as server-sent events. The domain contract builds the principal-wide topic and the
     * reactor publishes through the same builder; a `Last-Event-ID` header only resumes after that frame inside the caller's own topic.
     */
    @Sse("stream")
    stream(@CurrentPrincipal() principal: Principal, @Headers("last-event-id") lastEventId?: string): Observable<MessageEvent> {
        return this.hub.stream(@@service@@(principal.id), { after: lastEventId })
    }
}
