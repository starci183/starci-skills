import {
    Field, Int, ObjectType 
} from "@nestjs/graphql"

/** contract.task.list-for-dashboard's surface shape: two integers for one person, never the tasks
 * themselves - there is no task-list field on this type to render a list from, per the consumer
 * obligation "the dashboard renders counts and never derives a task list from them". */
@ObjectType()
/** taskCounts' payload: open and complete counts for the caller's own tasks. */
export class TaskCountsResponse {
  @Field(() => Int)
      open!: number

  @Field(() => Int)
      complete!: number

  constructor(open: number, complete: number) {
      this.open = open
      this.complete = complete
  }
}
