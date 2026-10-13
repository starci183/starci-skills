import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The create-resource answer. */
export class CreateResourceType {
    /** The id of the new resource row. */
    @Field(() => ID)
    id!: string
}
