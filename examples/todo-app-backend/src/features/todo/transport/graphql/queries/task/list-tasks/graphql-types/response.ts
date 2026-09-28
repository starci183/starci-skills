import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One task in the list: taskId, title, complete. */
export class TaskSummaryResponse {
  @Field(() => ID)
      taskId!: string

  @Field()
      title!: string

  @Field()
      complete!: boolean

  constructor(taskId: string, title: string, complete: boolean) {
      this.taskId = taskId
      this.title = title
      this.complete = complete
  }
}
