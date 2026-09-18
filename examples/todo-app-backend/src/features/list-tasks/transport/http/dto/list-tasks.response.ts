export class TaskSummaryResponse {
  taskId: string;
  title: string;
  complete: boolean;

  constructor(taskId: string, title: string, complete: boolean) {
    this.taskId = taskId;
    this.title = title;
    this.complete = complete;
  }
}

export class ListTasksResponse {
  tasks: TaskSummaryResponse[];

  constructor(tasks: TaskSummaryResponse[]) {
    this.tasks = tasks;
  }
}
