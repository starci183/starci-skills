import { GraphQLError } from "graphql"
import type { ASTVisitor, ValidationContext } from "graphql"

/** A validation rule that refuses an operation whose selection sets nest deeper than `maxDepth` (each fragment counts on its own). */
export const depthLimitRule =
    (maxDepth: number) =>
    (context: ValidationContext): ASTVisitor => {
        let depth = 0
        return {
            SelectionSet: {
                enter: () => {
                    depth += 1
                    if (depth === maxDepth + 1)
                        context.reportError(new GraphQLError(`Selection depth exceeds ${maxDepth}.`))
                },
                leave: () => {
                    depth -= 1
                },
            },
        }
    }
