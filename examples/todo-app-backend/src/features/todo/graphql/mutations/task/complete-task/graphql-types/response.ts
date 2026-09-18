import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CompleteTaskResponse {
  @Field(() => ID)
  taskId!: string;

  @Field()
  complete!: boolean;

  constructor(taskId: string, complete: boolean) {
    this.taskId = taskId;
    this.complete = complete;
  }
}
