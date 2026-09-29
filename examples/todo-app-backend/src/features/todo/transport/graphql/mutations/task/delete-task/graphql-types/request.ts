import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for delete task. */
@InputType()
/** Validated GraphQL request object. */
export class DeleteTaskRequest {
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        id!: string
}
