export class TaskRecord {
  constructor(
    readonly id: string,
    readonly owner: string,
    public title: string,
    public complete: boolean,
    public completedAt: Date | null,
  ) {}
}
