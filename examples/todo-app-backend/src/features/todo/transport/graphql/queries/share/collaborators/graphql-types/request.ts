import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for collaborators. */
@InputType()
/** Validated GraphQL request object. */
export class CollaboratorsRequest {
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        taskId!: string
}
