import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The createTask arguments: the title of the new task. */
export class CreateTaskInput {
    /** The title of the new task. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    title!: string
}
