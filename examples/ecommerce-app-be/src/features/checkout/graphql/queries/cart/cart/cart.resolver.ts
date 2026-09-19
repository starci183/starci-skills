import {
    Query, Resolver 
} from "@nestjs/graphql"
import {
    UseGuards 
} from "@nestjs/common"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"
import {
    CatalogService 
} from "@modules/bussiness/catalog/catalog.service"

import {
    CartLineResponse, CartResponse, CatalogProductResponse 
} from "./graphql-types/response"
import {
    SessionGuard 
} from "../../../session.guard"
import {
    ActorParams 
} from "../../../session.guard"
import {
    SessionActor 
} from "../../../session-actor.decorator"

@Resolver()
@UseGuards(SessionGuard)
/**
 * The person-scoped cart read, now a GraphQL query behind the same session verification the
 * retired `GET /cart` door ran: SessionGuard names the person, the cart and catalog
 * capabilities answer the lines and the catalog snapshot, and the resolver stays a transport
 * adapter between the two.
 */
export class CartResolver {
    constructor(
        private readonly carts: CartService,
        private readonly catalog: CatalogService,
    ) {}

    @Query(() => CartResponse,
        {
            name: "cart" 
        })
    async cart(@SessionActor() actor: ActorParams): Promise<CartResponse> {
        const items = await this.carts.list(actor.personId)
        const products = await this.catalog.list()
        return new CartResponse(
            items.map((item) => new CartLineResponse(item.productId,
                item.quantity)),
            products.map((product) => new CatalogProductResponse(
                product.id,
                product.name,
                product.priceMinorUnits,
                product.stock,
            )),
        )
    }
}
