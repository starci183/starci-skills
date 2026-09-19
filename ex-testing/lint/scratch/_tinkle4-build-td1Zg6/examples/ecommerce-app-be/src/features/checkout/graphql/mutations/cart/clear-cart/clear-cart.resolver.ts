import {
    Mutation, Resolver 
} from "@nestjs/graphql"
import {
    UseGuards 
} from "@nestjs/common"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"

import {
    ClearCartResponse 
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
 * The clear-cart operation, now a GraphQL mutation behind the same session verification the
 * retired `DELETE /cart` door ran: SessionGuard names the person, the cart capability empties
 * their cart, and the resolver answers the same `cleared` flag the REST door returned.
 */
export class ClearCartResolver {
    constructor(private readonly cart: CartService) {}

    @Mutation(() => ClearCartResponse,
        {
            name: "clearCart" 
        })
    async clearCart(@SessionActor() actor: ActorParams): Promise<ClearCartResponse> {
        await this.cart.clear(actor.personId)
        return new ClearCartResponse(true)
    }
}
