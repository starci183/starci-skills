import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The get-resource answer. */
export class GetResourceType {
    /** The id of the resource row. */
    @Field(() => ID)
    id!: string
}
