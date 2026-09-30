import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { InjectOrderEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import type { AddCartItemParams, CartLine, ClearCartParams, ListCartParams } from "./cart.contracts"
import { CartError, CartErrorCode } from "./errors/cart.error"
import { CartItemEntity } from "./persistence/entities/cart-item.entity"
import { toCartLine } from "./persistence/cart.rows"
import type { CartItemRow } from "./persistence/cart.rows"
import { UPSERT_CART_ITEM } from "./persistence/cart.sql"

@Injectable()
/** The per-person cart: an upsert on (person, product) and a clear that only a confirmed order performs. */
export class CartService {
    constructor(@InjectOrderEntityManager() private readonly entityManager: EntityManager) {}

    /** The lines of one cart, by product. */
    async list(params: ListCartParams): Promise<Array<CartLine>> {
        const rows = await this.entityManager.find(CartItemEntity, {
            where: { personId: params.personId },
            order: { productId: "ASC" },
            take: LIST_ROWS_MAX,
        })
        return rows.map((row) => ({ productId: row.productId, quantity: row.quantity }))
    }

    /** Adds `quantity` of a product in the caller transaction and answers the merged line. */
    async add(params: AddCartItemParams): Promise<CartLine> {
        const rows: Array<CartItemRow> = await params.manager.query(UPSERT_CART_ITEM, [
            params.personId,
            params.productId,
            params.quantity,
        ])
        const line = toCartLine(rows)
        if (line === null) throw new CartError({ code: CartErrorCode.LineMissing })
        return line
    }

    /** Empties a cart in the caller transaction. */
    async clear(params: ClearCartParams): Promise<void> {
        await params.manager.delete(CartItemEntity, { personId: params.personId })
    }
}
