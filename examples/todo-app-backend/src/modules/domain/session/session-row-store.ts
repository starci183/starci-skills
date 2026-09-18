/**
 * The port sds.login.session-store depends on, not the adapter. The platform database module satisfies
 * this structurally with a real TypeORM Repository<SessionEntity>; a test satisfies it with a Map. This
 * module never imports TypeORM to get there.
 */
export interface SessionRow {
  readonly token: string;
  readonly personId: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface SessionRowStore {
  findOneBy(where: { token: string }): Promise<SessionRow | null>;
  save(row: SessionRow): Promise<SessionRow>;
  delete(token: string): Promise<unknown>;
}
