import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One push of the @@channel@@ channel: what the subscriber may see of a change, nothing else. */
export class @@Channel@@ChangedType {
    /** The id of the thing that changed. */
    @Field()
    id!: string
}
