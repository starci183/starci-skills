import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for complete task. */
@InputType()
/** Validated GraphQL request object. */
export class CompleteTaskRequest {
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        id!: string
}
