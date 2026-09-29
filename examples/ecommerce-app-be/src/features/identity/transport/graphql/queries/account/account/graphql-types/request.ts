import {
    Field, ID, InputType
} from "@nestjs/graphql"
import {
    IsString, MaxLength
} from "class-validator"

@InputType()
/** Account lookup argument at the identity GraphQL boundary. */
export class AccountRequest {
    @Field(() => ID)
    @IsString()
    @MaxLength(64)
        personId!: string
}
