/** Domain record read out of the task persistence row; the types service maps entities onto it. */
export class TaskRecord {
    constructor(
    readonly id: string,
    readonly owner: string,
    public title: string,
    public complete: boolean,
    public completedAt: Date | null,
    ) {}
}
