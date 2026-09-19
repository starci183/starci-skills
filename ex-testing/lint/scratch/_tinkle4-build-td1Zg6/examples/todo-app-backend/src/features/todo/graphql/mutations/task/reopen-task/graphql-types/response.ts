import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** reopenTask's payload: the taskId and its now-false complete flag. */
export class ReopenTaskResponse {
  @Field(() => ID)
      taskId!: string

  @Field()
      complete!: boolean

  constructor(taskId: string, complete: boolean) {
      this.taskId = taskId
      this.complete = complete
  }
}
