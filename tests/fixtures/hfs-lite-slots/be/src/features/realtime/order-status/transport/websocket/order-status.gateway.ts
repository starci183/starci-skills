import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets"
import { orderStatusTopic } from "@modules/domain/order"
import type { OrderStatusFrame } from "@modules/domain/order"
import type { Principal } from "@modules/platform/cqrs"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { OrderStatusNamespace } from "./order-status-websocket.module"

@WebSocketGateway({ namespace: "/order-status", transports: ["websocket"] })
/** The push-only order-status door: its module authenticates each connection before opening the principal's stream. */
export class OrderStatusGateway {
    /** The namespace created by the app's socket.io adapter; the module installs authentication before the app listens. */
    @WebSocketServer()
    namespace!: OrderStatusNamespace

    constructor(@InjectRealtimeHub() private readonly hub: RealtimeHub) {}

    /** The domain contract builds this principal-wide topic; the reactor publishes through the same builder. */
    frames(principal: Principal): AsyncIterable<OrderStatusFrame> {
        return this.hub.subscribe(orderStatusTopic(principal.id))
    }
}
