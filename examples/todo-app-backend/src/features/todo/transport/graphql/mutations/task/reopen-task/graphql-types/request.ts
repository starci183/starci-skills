import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for reopen task. */
@InputType()
/** Validated GraphQL request object. */
export class ReopenTaskRequest {
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        id!: string
}
