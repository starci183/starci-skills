import { Test } from "@nestjs/testing"
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

const validateDepth = async (source: string, maxDepth = 2) => {
    const subject = await build()
    return validate(schema, parse(source), [subject.depthLimitRule(maxDepth)])
}

const SUBJECT: unique symbol = Symbol("graphql/graphql-depth.policy")
const subjectFunctions = () => ({ depthLimitRule })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("depthLimitRule", () => {
    it("accepts an operation nested exactly to the depth limit", async () => {
        const errors = await validateDepth(`
            query {
                item {
                    value
                }
            }
        `)

        expect(errors).toEqual([])
    })

    it("rejects the first selection set deeper than the limit", async () => {
        const errors = await validateDepth(`
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

    it("counts the selection set of a fragment on its own", async () => {
        const errors = await validateDepth(
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
