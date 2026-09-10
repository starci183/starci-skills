import {
    Field,
    ObjectType,
} from "@nestjs/graphql"
import {
    AbstractGraphQLResponse,
} from "@modules/api/apollo/server/graphql-types/object-types/graphql-response"
import {
    IAbstractGraphQLResponse,
} from "@modules/api/apollo/server/types/graphql-response"

/**
 * Synthetic persisted row returned by the example mutation.
 * On a real host this would be a TypeORM GraphQL object type.
 */
@ObjectType({
    description: "Synthetic example item row.",
})
export class ExampleItemEntity {
    @Field(() => String,
        {
            description: "Row id.",
        })
        id: string
}

@ObjectType({
    description: "Response wrapper for the exampleCreateItem mutation.",
})
/**
 * Response wrapper for the example mutation.
 *
 * `data` is nullable because the transform interceptor sets `data = null` on
 * the error path — a non-nullable field would crash GraphQL and mask the real
 * error.
 */
export class ExampleCreateItemResponse
    extends AbstractGraphQLResponse
    implements IAbstractGraphQLResponse<ExampleItemEntity> {
    /** The example row after create-or-return. */
    @Field(
        () => ExampleItemEntity,
        {
            nullable: true,
            description: "The example item row after the mutation.",
        },
    )
        data: ExampleItemEntity
}
