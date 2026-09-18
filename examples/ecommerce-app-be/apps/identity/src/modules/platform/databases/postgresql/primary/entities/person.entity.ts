import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('identity_person')
export class PersonEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  /** scrypt hex of the demo password; a real deployment delegates this to an identity provider. */
  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;
}
