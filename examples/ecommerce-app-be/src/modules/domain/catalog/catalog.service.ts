import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager, In 
} from "typeorm"
import {
    ProductEntity 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"
import {
    InjectPrimaryEntityManager 
} from "ecommerce-app-be/modules/platform/databases/postgresql/order"

/** The most products one catalog list returns: the demo catalog is a few SKUs, so a bound this size is never reached in practice. */
const CATALOG_LIST_LIMIT = 500

/** A catalog product as the door answers it: id, name, the minor-unit price and live stock. */
export interface ProductResult {
  id: string;
  name: string;
  priceMinorUnits: number;
  stock: number;
}

/** Product views keyed by requested id; missing ids remain undefined. */
export type ProductLookupResult = Record<string, ProductResult | undefined>

@Injectable()
/**
 * The read side of the catalog; stock is only ever written by the checkout transaction
 * (domain/order), which is what makes the guarded decrement race-safe. Persistence goes
 * through the primary EntityManager - the capability owns behaviour, the databases module owns
 * the connection.
 */
export class CatalogService {
    constructor(
    @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
    ) {}

    async list(): Promise<Array<ProductResult>> {
        const rows = await this.entityManager.find(ProductEntity,
            {
                order: {
                    id: "ASC" 
                }, take: CATALOG_LIST_LIMIT 
            })
        return rows.map((row) => ({
            id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock 
        }))
    }

    async byIds(ids: Array<string>): Promise<ProductLookupResult> {
        const rows = ids.length ? await this.entityManager.findBy(ProductEntity,
            {
                id: In(ids) 
            }) : []
        const found: Record<string, ProductResult | undefined> = {
        }
        for (const row of rows) {
            found[row.id] = {
                id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock 
            }
        }
        return found
    }
}
