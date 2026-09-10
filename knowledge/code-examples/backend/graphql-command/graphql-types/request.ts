import {
    Field,
    ID,
    InputType,
} from "@nestjs/graphql"

@InputType({
    description: "Synthetic request identifying the example item to create.",
})
/** Request for the exampleCreateItem mutation. */
export class ExampleCreateItemRequest {
    /** Stable id of the item the caller wants created or returned. */
    @Field(
        () => ID,
        {
            description: "Example item id.",
        },
    )
        itemId: string
}
