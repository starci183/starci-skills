import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager 
} from "typeorm"
import {
    CartItemEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    InjectPrimaryEntityManager 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"

/** The most lines one cart read returns: a cart is a handful of products, so a bound this size is never reached in practice. */
const CART_LINES_LIMIT = 200

/** One cart line as the door answers it: the product and how many of it the person holds. */
export interface CartLineResult {
  productId: string;
  quantity: number;
}

@Injectable()
/**
 * The per-person cart (sds.checkout.order-flow t-add): upsert on (person, product), and a cart
 * that clears only when a confirmation is written. Persistence goes through the primary
 * EntityManager - the capability owns behaviour, the databases module owns the connection.
 */
export class CartService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    async list(personId: string): Promise<Array<CartLineResult>> {
        const rows = await this.entityManager.find(CartItemEntity,
            {
                where: {
                    personId 
                }, order: {
                    productId: "ASC" 
                }, take: CART_LINES_LIMIT 
            })
        return rows.map((row) => ({
            productId: row.productId, quantity: row.quantity 
        }))
    }

    async add(personId: string, productId: string, quantity: number): Promise<CartLineResult> {
        const existing = await this.entityManager.findOneBy(CartItemEntity,
            {
                personId, productId 
            })
        const next = (existing?.quantity ?? 0) + quantity
        if (existing) {
            await this.entityManager.update(CartItemEntity,
                {
                    id: existing.id 
                },
                {
                    quantity: next 
                })
        } else {
            await this.entityManager.insert(CartItemEntity,
                {
                    personId, productId, quantity: next 
                })
        }
        return {
            productId, quantity: next 
        }
    }

    async clear(personId: string): Promise<void> {
        await this.entityManager.delete(CartItemEntity,
            {
                personId 
            })
    }
}
