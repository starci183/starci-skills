import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength, MinLength
} from "class-validator"

/** The GraphQL request for complete erasure. */
@InputType()
/** Validated GraphQL request object. */
export class CompleteErasureRequest {
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
        requestId!: string
}
