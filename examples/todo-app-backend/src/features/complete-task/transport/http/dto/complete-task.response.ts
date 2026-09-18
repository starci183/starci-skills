export class CompleteTaskResponse {
  taskId: string;
  complete: boolean;

  constructor(taskId: string, complete: boolean) {
    this.taskId = taskId;
    this.complete = complete;
  }
}
