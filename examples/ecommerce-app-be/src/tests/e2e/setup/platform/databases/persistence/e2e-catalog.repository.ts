import {
    Injectable
} from "@nestjs/common"
import {
    E2EDbService
} from "../e2e-db.service"

/** A product's stock as the product table holds it. */
interface StockRow {
  stock: number;
}

/** A `count(*)::int` answer. */
interface CountRow {
  count: number;
}

@Injectable()
/** Out-of-band reads of the persisted product catalog. */
export class E2ECatalogRepository {
    constructor(private readonly db: E2EDbService) {}

    async stockOf(productId: string): Promise<number> {
        const rows = await this.db.query<StockRow>("SELECT stock FROM product WHERE id = $1",
            [productId])
        return rows[0].stock
    }

    async productCount(): Promise<number> {
        const rows = await this.db.query<CountRow>("SELECT COUNT(*)::int AS count FROM product")
        return rows[0].count
    }
}
