import {
    Field, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** deleteTask's payload: deleted - true once the row is gone. */
export class DeleteTaskResponse {
  @Field()
      deleted!: boolean

  constructor(deleted: boolean) {
      this.deleted = deleted
  }
}
