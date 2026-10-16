// proves: FE_PROPS_MUTABLE@lite
// proves: FE_PROPS_MUTABLE@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { at, fixtureHfs } from "./fixtures/typed/tester.mjs"
import { propsFieldsReadonly } from "./props-and-slots.mjs"

const COMPONENT = at("apps/web/src/components/branches/Card/index.tsx")
const render = '\nexport const Card = (props: CardProps) => <div>{props.title}</div>'

for (const edition of ["lite", "full"]) {
    test(`${edition} FE_PROPS_MUTABLE accepts deeply readonly props and rejects mutable fields and collections`, () => {
        const tester = new RuleTester({
            languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
            settings: { starci: { hfs: fixtureHfs(undefined, { lite: edition === "lite" }) } },
        })
        tester.run("props-fields-readonly", propsFieldsReadonly, {
            valid: [
                { filename: COMPONENT, code: "interface CardProps { readonly title: string; readonly meta: { readonly label: string }; readonly tags: readonly string[]; readonly pair: readonly [string, number]; readonly rows: ReadonlyArray<{ readonly id: string }>; readonly [key: string]: unknown }" + render },
                { filename: COMPONENT, code: "type CardProps = Readonly<{ title: string; tags: readonly string[] }>" + render },
                { filename: COMPONENT, code: "interface Base { readonly title: string }\ninterface CardProps extends Base { readonly enabled: boolean }" + render },
            ],
            invalid: [
                { filename: COMPONENT, code: "interface CardProps { title: string }" + render, errors: [{ messageId: "field" }] },
                { filename: COMPONENT, code: "interface CardProps { readonly title: string; readonly meta: { label: string }; [key: string]: unknown }" + render, errors: [{ messageId: "field" }, { messageId: "index" }] },
                { filename: COMPONENT, code: "interface CardProps { readonly title: string; readonly tags: string[]; readonly pair: [string, number]; readonly rows: Array<string> }" + render, errors: [{ messageId: "collection" }, { messageId: "collection" }, { messageId: "collection" }] },
                { filename: COMPONENT, code: "interface Base { title: string }\ninterface Item { name: string }\ninterface CardProps extends Base { readonly rows: readonly Item[] }" + render, errors: [{ messageId: "field" }, { messageId: "field" }] },
            ],
        })
    })
}
