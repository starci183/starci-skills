import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsString, MinLength 
} from "class-validator"

@InputType()
/** createTask's argument: the new task's title - the only field the door takes. */
export class CreateTaskInput {
  @Field()
  @IsString()
  @MinLength(1)
      title!: string
}
