/**
 * A minimal in-memory stand-in for `EntityManager`, scoped to one entity and keyed by one field - only
 * the methods a capability service actually calls (`findOneBy`, `findBy`, `save`, `delete`), each
 * shaped like the real `EntityManager` method it replaces (`(target, where/criteria)`, ignoring
 * `target` since each spec that builds one already fixes the entity type). It is not a real TypeORM
 * `EntityManager`, so it is cast through `unknown` at the injection site rather than claimed to satisfy
 * the full `EntityManager` surface.
 */
export const createFakeEntityManager = <T extends object>(keyField: keyof T) => {
  const rows = new Map<unknown, T>();
  return {
    async findOneBy(_target: unknown, where: Partial<T>): Promise<T | null> {
      const key = where[keyField];
      if (key !== undefined) return rows.get(key) ?? null;
      for (const row of rows.values()) if (matches(row, where)) return row;
      return null;
    },
    async findBy(_target: unknown, where: Partial<T>): Promise<T[]> {
      return [...rows.values()].filter(row => matches(row, where));
    },
    async save(_target: unknown, entityLike: Partial<T>): Promise<T> {
      const entity = entityLike as T;
      rows.set(entity[keyField], entity);
      return entity;
    },
    async delete(_target: unknown, criteria: unknown): Promise<void> {
      rows.delete(criteria);
    },
  };
};

function matches<T extends object>(row: T, where: Partial<T>): boolean {
  return (Object.keys(where) as Array<keyof T>).every(key => row[key] === where[key]);
}
