import { Injectable } from "@nestjs/common"
import { In, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectOrderEntityManager, LIST_ROWS_MAX } from "@modules/platform/database"
import type {
    ProductLookup,
    ProductView,
    ProductsByIdsParams,
    ReleaseStockParams,
    ReserveStockParams,
} from "./catalog.contracts"
import { ProductEntity } from "./persistence/entities/product.entity"

const toProductView = (row: ProductEntity): ProductView => ({
    id: row.id,
    name: row.name,
    priceMinorUnits: row.priceMinorUnits,
    stock: row.stock,
})

@Injectable()
/** The catalog: reads for the doors and the checkout, the guarded stock decrement only a transaction may call and its compensation. */
export class CatalogService {
    constructor(@InjectOrderEntityManager() private readonly entityManager: EntityManager) {}

    /** Every product, by SKU. */
    async list(): Promise<Array<ProductView>> {
        const rows = await this.entityManager.find(ProductEntity, { order: { id: "ASC" }, take: LIST_ROWS_MAX })
        return rows.map(toProductView)
    }

    /** The products named by `ids`, keyed by id. */
    async byIds(params: ProductsByIdsParams): Promise<ProductLookup> {
        if (params.ids.length === 0) return {}
        const rows = await this.entityManager.find(ProductEntity, {
            where: { id: In([...params.ids]) },
            take: LIST_ROWS_MAX,
        })
        return Object.fromEntries(rows.map((row) => [row.id, toProductView(row)]))
    }

    /** Takes `quantity` units in the caller transaction; false when the stock no longer covers it (a concurrent checkout won). */
    async reserveStock(params: ReserveStockParams): Promise<boolean> {
        const result = await params.manager.decrement(
            ProductEntity,
            { id: params.productId, stock: MoreThanOrEqual(params.quantity) },
            "stock",
            params.quantity,
        )
        return (result.affected ?? 0) > 0
    }

    /** Gives `quantity` units back in the caller transaction: the compensation of a reservation of a cancelled order. */
    async releaseStock(params: ReleaseStockParams): Promise<void> {
        await params.manager.increment(ProductEntity, { id: params.productId }, "stock", params.quantity)
    }
}
