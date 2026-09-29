import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    UseGuards 
} from "@nestjs/common"
import {
    CartService 
} from "ecommerce-app-be/modules/domain/cart"
import {
    RequestInvalidException 
} from "ecommerce-app-be/modules/platform/errors"

import {
    AddCartItemInput 
} from "./graphql-types/input"
import {
    AddCartItemLineResponse, AddCartItemResponse 
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
 * The add-to-cart operation, now a GraphQL mutation behind the same session verification the
 * retired `POST /cart/items` door ran: SessionGuard names the person, the request carries the
 * product and quantity, and a non-positive quantity is the same REQUEST_INVALID refusal the
 * REST body validation threw. The cart capability owns the upsert; the resolver stays a
 * transport adapter.
 */
export class AddCartItemResolver {
    constructor(private readonly cart: CartService) {}

    @Mutation(() => AddCartItemResponse,
        {
            name: "addCartItem" 
        })
    async addCartItem(
    @SessionActor() actor: ActorParams,
        @Args("request") request: AddCartItemInput,
    ): Promise<AddCartItemResponse> {
        const productId = typeof request?.productId === "string" ? request.productId : ""
        const quantity = typeof request?.quantity === "number" && Number.isInteger(request.quantity) ? request.quantity : 0
        if (!productId || quantity <= 0) {
            throw new RequestInvalidException({
                message: "productId and a positive integer quantity are required." 
            })
        }
        const item = await this.cart.add(actor.personId,
            productId,
            quantity)
        return new AddCartItemResponse(new AddCartItemLineResponse(item.productId,
            item.quantity))
    }
}
