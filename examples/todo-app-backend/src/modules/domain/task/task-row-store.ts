/**
 * The port data.task.task depends on, not the adapter. The platform database module satisfies this
 * structurally with a real TypeORM Repository<TaskEntity>; a test satisfies it with a Map. This module
 * never imports TypeORM to get there.
 */
export interface TaskRow {
  readonly id: string;
  readonly owner: string;
  title: string;
  complete: boolean;
  completedAt: Date | null;
}

export interface TaskRowStore {
  findOneBy(where: { id: string }): Promise<TaskRow | null>;
  findBy(where: { owner: string }): Promise<TaskRow[]>;
  save(row: TaskRow): Promise<TaskRow>;
  delete(id: string): Promise<unknown>;
}
