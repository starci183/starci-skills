import {
    Field, ID, InputType
} from "@nestjs/graphql"

@InputType()
/** Account lookup argument at the identity GraphQL boundary. */
export class AccountRequest {
    @Field(() => ID)
        personId!: string
}
