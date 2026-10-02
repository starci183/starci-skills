import { buildSchema, parse, validate } from "graphql"
import { depthLimitRule } from "./graphql-depth.policy"

const schema = buildSchema(`
    type Query {
        item: Item
    }

    type Item {
        value: String
        child: Item
    }
`)

const validateDepth = (source: string, maxDepth = 2) => validate(schema, parse(source), [depthLimitRule(maxDepth)])

describe("depthLimitRule", () => {
    it("accepts an operation nested exactly to the depth limit", () => {
        const errors = validateDepth(`
            query {
                item {
                    value
                }
            }
        `)

        expect(errors).toEqual([])
    })

    it("rejects the first selection set deeper than the limit", () => {
        const errors = validateDepth(`
            query {
                item {
                    child {
                        value
                    }
                }
            }
        `)

        expect(errors.map((error) => error.message)).toEqual(["Selection depth exceeds 2."])
    })

    it("counts the selection set of a fragment on its own", () => {
        const errors = validateDepth(
            `
                query {
                    ...QueryBits
                }

                fragment QueryBits on Query {
                    item {
                        value
                    }
                }
            `,
            1,
        )

        expect(errors.map((error) => error.message)).toEqual(["Selection depth exceeds 1."])
    })
})
