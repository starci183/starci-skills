import {
    Args, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    UseGuards 
} from "@nestjs/common"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"
import {
    RequestInvalidException 
} from "@modules/platform/exceptions/errors/requests/request-invalid"

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
 * retired `POST /cart/items` door ran: SessionGuard names the person, the input carries the
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
        @Args("input") input: AddCartItemInput,
    ): Promise<AddCartItemResponse> {
        const productId = typeof input?.productId === "string" ? input.productId : ""
        const quantity = typeof input?.quantity === "number" && Number.isInteger(input.quantity) ? input.quantity : 0
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
