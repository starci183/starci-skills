import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CreateTaskResponse {
  @Field(() => ID)
  taskId!: string;

  @Field()
  title!: string;

  constructor(taskId: string, title: string) {
    this.taskId = taskId;
    this.title = title;
  }
}
