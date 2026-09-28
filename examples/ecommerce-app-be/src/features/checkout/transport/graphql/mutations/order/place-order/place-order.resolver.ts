import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    UseGuards 
} from "@nestjs/common"
import {
    OrderService 
} from "ecommerce-app-be/modules/domain/order"

import {
    PlaceOrderInput 
} from "./graphql-types/input"
import {
    PlaceOrderResponse 
} from "./graphql-types/response"
import {
    ActorParams, SessionGuard 
} from "../../../session.guard"
import {
    SessionActor 
} from "../../../session-actor.decorator"

@Resolver()
@UseGuards(SessionGuard)
/**
 * The confirmation door (sds.checkout.order-flow t-confirm), now a GraphQL mutation behind the
 * same session verification the retired `POST /orders` ran: SessionGuard names the person - the
 * one identity verified, never a body claim - and the order capability turns their cart into a
 * confirmed order or a named CHECKOUT_REFUSAL. The replay key the REST door read off the
 * `Idempotency-Key` header now arrives in the request, the canonical GraphQL place for it; a
 * replay still returns the first answer rather than a second order.
 */
export class PlaceOrderResolver {
    constructor(private readonly orders: OrderService) {}

    @Mutation(() => PlaceOrderResponse,
        {
            name: "placeOrder" 
        })
    async placeOrder(
    @SessionActor() actor: ActorParams,
        @Args("request") request: PlaceOrderInput,
    ): Promise<PlaceOrderResponse> {
        const idempotencyKey = typeof request?.idempotencyKey === "string" && request.idempotencyKey.trim()
            ? request.idempotencyKey.trim()
            : undefined
        const result = await this.orders.place(actor.personId,
            idempotencyKey)
        return new PlaceOrderResponse(
            result.orderId,
            result.status,
            result.totalMinorUnits,
            result.currency,
            result.paymentId,
            result.replayed,
        )
    }
}
