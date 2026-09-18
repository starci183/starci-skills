import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('product')
export class ProductEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Minor units (cents) - money is never a float in this tree. */
  @Column({ type: 'int', name: 'price_minor_units' })
  priceMinorUnits!: number;

  @Column({ type: 'int' })
  stock!: number;
}
