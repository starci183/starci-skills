export class CreateTaskResponse {
  taskId: string;
  title: string;

  constructor(taskId: string, title: string) {
    this.taskId = taskId;
    this.title = title;
  }
}
