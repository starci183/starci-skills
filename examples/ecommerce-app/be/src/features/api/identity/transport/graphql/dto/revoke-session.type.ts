import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The confirmation that a session ended. */
export class RevokeSessionType {
    /** Always true: a refusal is an error instead. */
    @Field()
    revoked!: boolean
}
