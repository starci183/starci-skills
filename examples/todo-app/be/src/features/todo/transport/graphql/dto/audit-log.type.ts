import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One decrypted audit line: at, action and target; the actor and the key id stay server-side. */
export class AuditLogType {
    /** When the action happened. */
    @Field(() => Date)
    at!: Date

    /** The action label. */
    @Field()
    action!: string

    /** What the action touched. */
    @Field(() => String, { nullable: true })
    target!: string | null
}
