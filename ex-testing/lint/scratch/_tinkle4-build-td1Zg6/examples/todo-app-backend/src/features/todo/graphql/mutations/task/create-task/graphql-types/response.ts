import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** createTask's payload: the created task's id and title. */
export class CreateTaskResponse {
  @Field(() => ID)
      taskId!: string

  @Field()
      title!: string

  constructor(taskId: string, title: string) {
      this.taskId = taskId
      this.title = title
  }
}
