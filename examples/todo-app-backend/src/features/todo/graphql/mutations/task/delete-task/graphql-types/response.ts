import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DeleteTaskResponse {
  @Field()
  deleted!: boolean;

  constructor(deleted: boolean) {
    this.deleted = deleted;
  }
}
