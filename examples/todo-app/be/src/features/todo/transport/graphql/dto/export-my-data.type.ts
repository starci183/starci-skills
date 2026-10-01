import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One exported audit line: at, action and target, the same shape auditLog returns. */
export class ExportMyDataType {
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
