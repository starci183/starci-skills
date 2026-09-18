import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductEntity, POSTGRESQL_PRIMARY } from '../../platform/databases/postgresql/primary';

export interface ProductResult {
  id: string;
  name: string;
  priceMinorUnits: number;
  stock: number;
}

/** The read side of the catalog; stock is only ever written by the checkout transaction
 * (bussiness/order), which is what makes the guarded decrement race-safe. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ProductEntity, POSTGRESQL_PRIMARY) private readonly products: Repository<ProductEntity>,
  ) {}

  async list(): Promise<ProductResult[]> {
    const rows = await this.products.find({ order: { id: 'ASC' } });
    return rows.map((row) => ({ id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock }));
  }

  async byIds(ids: string[]): Promise<Record<string, ProductResult | undefined>> {
    const rows = ids.length ? await this.products.findBy({ id: In(ids) }) : [];
    const found: Record<string, ProductResult | undefined> = {};
    for (const row of rows) {
      found[row.id] = { id: row.id, name: row.name, priceMinorUnits: row.priceMinorUnits, stock: row.stock };
    }
    return found;
  }
}
