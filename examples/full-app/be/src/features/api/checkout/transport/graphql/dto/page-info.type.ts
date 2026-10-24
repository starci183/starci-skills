import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where a paginated list stands: the cursor to continue from and whether anything follows. */
export class PageInfoType {
    /** The cursor of the last item of the page; null for an empty page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null

    /** True when at least one more item follows this page. */
    @Field()
    hasNextPage!: boolean
}
