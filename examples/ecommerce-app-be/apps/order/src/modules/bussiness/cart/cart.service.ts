import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItemEntity, POSTGRESQL_PRIMARY } from '../../platform/databases/postgresql/primary';

export interface CartLineResult {
  productId: string;
  quantity: number;
}

/** The per-person cart (sds.checkout.order-flow t-add): upsert on (person, product), and a
 * cart that clears only when a confirmation is written. */
@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItemEntity, POSTGRESQL_PRIMARY) private readonly cart: Repository<CartItemEntity>,
  ) {}

  async list(personId: string): Promise<CartLineResult[]> {
    const rows = await this.cart.find({ where: { personId }, order: { productId: 'ASC' } });
    return rows.map((row) => ({ productId: row.productId, quantity: row.quantity }));
  }

  async add(personId: string, productId: string, quantity: number): Promise<CartLineResult> {
    const existing = await this.cart.findOneBy({ personId, productId });
    const next = (existing?.quantity ?? 0) + quantity;
    if (existing) {
      await this.cart.update({ id: existing.id }, { quantity: next });
    } else {
      await this.cart.insert({ personId, productId, quantity: next });
    }
    return { productId, quantity: next };
  }

  async clear(personId: string): Promise<void> {
    await this.cart.delete({ personId });
  }
}
