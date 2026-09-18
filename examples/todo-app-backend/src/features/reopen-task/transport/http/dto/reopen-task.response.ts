export class ReopenTaskResponse {
  taskId: string;
  complete: boolean;

  constructor(taskId: string, complete: boolean) {
    this.taskId = taskId;
    this.complete = complete;
  }
}
