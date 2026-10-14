import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets"
import { @@service@@ } from "@@serviceModule@@"
import type { @@Channel@@Frame } from "@@serviceModule@@"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { @@Channel@@Namespace } from "./@@channel@@-websocket.module"

@WebSocketGateway({ namespace: "/@@channel@@", transports: ["websocket"] })
/** The push-only @@channel@@ door: its module authenticates each connection before opening the principal's stream. */
export class @@Channel@@Gateway {
    /** The namespace created by the app's socket.io adapter; the module installs authentication before the app listens. */
    @WebSocketServer()
    namespace!: @@Channel@@Namespace

    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /** The domain contract builds this principal-wide topic; the reactor publishes through the same builder. */
    frames(principal: Principal): AsyncIterable<@@Channel@@Frame> {
        return this.hub.subscribe(@@service@@(principal.id))
    }
}
