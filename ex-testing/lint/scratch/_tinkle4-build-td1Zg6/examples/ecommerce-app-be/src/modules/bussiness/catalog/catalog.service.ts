import {
    Injectable 
} from "@nestjs/common"
import {
    EntityManager, In 
} from "typeorm"
import {
    ProductEntity 
} from "@modules/platform/databases/postgresql/order/entities/product.entity"
import {
    InjectPrimaryEntityManager 
} from "@modules/platform/databases/postgresql/order/primary.decorators"

/** A catalog product as the door answers it: id, name, the minor-unit price and live stock. */
export interface ProductResult {
  id: string;
  name: string;
  priceMinorUnits: number;
  stock: number;
}

@Injectable()
/**
 * The read side of the catalog; stock is only ever written by the checkout transaction
 * (bussiness/order), which is what makes the guarded decrement race-safe. Persistence goes
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
                } 
            })
        return rows.map((row) => ({
            id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock 
        }))
    }

    async byIds(ids: Array<string>): Promise<Record<string, ProductResult | undefined>> {
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
