import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The completeErasure arguments: the id of the verified erasure request to complete. */
export class CompleteErasureInput {
    /** The request id. */
    @Field(() => ID)
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    requestId!: string
}
