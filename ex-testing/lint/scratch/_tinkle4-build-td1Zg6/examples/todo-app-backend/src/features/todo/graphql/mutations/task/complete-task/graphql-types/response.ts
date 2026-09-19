import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** completeTask's payload: the taskId and its now-true complete flag. */
export class CompleteTaskResponse {
  @Field(() => ID)
      taskId!: string

  @Field()
      complete!: boolean

  constructor(taskId: string, complete: boolean) {
      this.taskId = taskId
      this.complete = complete
  }
}
