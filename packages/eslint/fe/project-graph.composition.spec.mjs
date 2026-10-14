import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const overlay = "apps/web/src/features/overlays/ItemsOverlay/index.tsx"
const block = "apps/web/src/components/blocks/ItemBlock/index.tsx"
const branch = "apps/web/src/components/branches/ItemList/index.tsx"
const files = {
    "apps/web/src/app/page.tsx": 'import { ItemsPage } from "../features/pages/ItemsPage"\nexport default function Route() { return <ItemsPage /> }\n',
    "apps/web/src/features/pages/ItemsPage/index.tsx": 'import { ItemsOverlay } from "../../overlays/ItemsOverlay"\nexport const ItemsPage = () => <ItemsOverlay />\n',
    [branch]: 'export const ItemList = (props: { ids: string[], renderItem: (id: string) => unknown }) => <section>{props.ids.map(props.renderItem)}</section>\n',
    "apps/web/src/features/overlays/ItemsOverlay/component.tsx": 'import { ItemList } from "../../../components/branches/ItemList"\nexport const ItemsOverlayBase = (props: { props: { ids: string[], renderItem: (id: string) => unknown } }) => <ItemList {...props.props} />\n',
    [block]: 'import { useItems } from "../../../hooks/swr"\nimport { ItemBlockBase } from "./component"\nexport const ItemBlock = (props: { id: string }) => { const ids = useItems(); return <ItemBlockBase id={props.id} count={ids.length} /> }\n',
    "apps/web/src/components/blocks/ItemBlock/component.tsx": 'export const ItemBlockBase = (props: { id: string, count: number }) => <article>{props.id}{props.count}</article>\n',
    "apps/web/src/hooks/swr/index.ts": 'export const useItems = () => ["one", "two"]\n',
}

const composition = (body) => [
    '"use client"',
    'import { createElement } from "react"',
    'import { useItems } from "../../../hooks/swr"',
    'import { ItemBlock } from "../../../components/blocks/ItemBlock"',
    'import { ItemsOverlayBase } from "./component"',
    'import { ItemList } from "../../../components/branches/ItemList"',
    `export const ItemsOverlay = () => { const ids = useItems(); ${body} }`,
    "",
].join("\n")

const checkScene = (t, code) => {
    const f = projectFixture({ profile: "fe", files: { ...files, [overlay]: code } })
    t.after(f.cleanup)
    const at = (rel) => ({ filename: f.at(rel), code: rel === overlay ? code : files[rel] })
    return { ...f, at }
}

test("composition: a page mounts a client overlay whose pure view and branch render supplied connected blocks", (t) => {
    const s = checkScene(t, composition('return <ItemsOverlayBase props={{ ids, renderItem: (id) => <ItemBlock id={id + ids[0]} /> }} />;'))
    for (const id of ["tier-direction", "component-purity", "route-adapter"]) {
        s.tester.run(id, rules[id], { valid: Object.keys({ ...files, [overlay]: "" }).map(s.at), invalid: [] })
    }
})

test("composition: captured callbacks, aliases, mapped lists and React element construction keep the pure boundary", (t) => {
    const bodies = [
        'return <ItemList ids={ids} renderItem={() => <ItemBlock id={ids[0]} />} />;',
        'const renderItem = () => <ItemBlock id={ids[0]} />; return <ItemList ids={ids} renderItem={renderItem} />;',
        'return <ItemList ids={ids} content={ids.map(id => <ItemBlock key={id} id={id} />)} />;',
        'const content = [<ItemBlock id={ids[0]} />]; return <ItemList ids={ids} content={content} />;',
        'return <ItemList ids={ids} renderItem={() => ids.map(id => <ItemBlock key={id} id={id} />)} />;',
        'return <ItemList ids={ids} renderItem={() => <>{ids.length ? <ItemBlock id={ids[0]} /> : null}</>} />;',
        'return createElement(ItemList, { ids, renderItem: () => createElement(ItemBlock, { id: ids[0] }) });',
    ]
    for (const body of bodies) {
        const s = checkScene(t, composition(body))
        s.tester.run("component-purity", rules["component-purity"], { valid: [s.at(overlay), s.at(branch), s.at(block)], invalid: [] })
    }
})

test("composition: inline drawing, dynamic targets, callback world reads and direct connected render paths stay forbidden", (t) => {
    const bodies = [
        'return <ItemList ids={ids} renderItem={() => <div>{ids[0]}</div>} />;',
        'return <ItemsOverlayBase props={{ ids, renderItem: () => <div>{ids[0]}</div> }} />;',
        'const choices = { item: ItemBlock }; const Target = choices[ids[0]]; return <ItemList ids={ids} renderItem={() => <Target id={ids[0]} />} />;',
        'return <ItemList ids={ids} renderItem={() => { const values = useItems(); return <ItemBlock id={values[0]} />; }} />;',
        'return <ItemBlock id={ids[0]} />;',
        'return <ItemList ids={ids} renderItem={ItemBlock} />;',
        'return <ItemList ids={ids} content={[<div>{ids[0]}</div>]} />;',
    ]
    for (const body of bodies) {
        const s = checkScene(t, composition(body))
        const errors = body.includes("const values") ? [{ messageId: "finding", line: 7 }, { messageId: "finding", line: 7 }]
            : [{ messageId: "finding", line: 7 }]
        s.tester.run("component-purity", rules["component-purity"], { valid: [s.at(branch), s.at(block)], invalid: [{ ...s.at(overlay), errors }] })
    }
})

test("composition: receiving block render props never permits a branch to import blocks or own their data", (t) => {
    const code = composition('return <ItemsOverlayBase props={{ ids, renderItem: (id) => <ItemBlock id={id} /> }} />;')
    const badBranch = 'import { ItemBlock } from "../../blocks/ItemBlock"\nimport { useItems } from "../../../hooks/swr"\nexport const ItemList = () => { const ids = useItems(); return ids.map(id => <ItemBlock id={id} />); }\n'
    const f = projectFixture({ profile: "fe", files: { ...files, [overlay]: code, [branch]: badBranch } })
    t.after(f.cleanup)
    const entry = { filename: f.at(branch), code: badBranch }
    f.tester.run("tier-direction", rules["tier-direction"], { valid: [], invalid: [{ ...entry, errors: [{ messageId: "finding", line: 1 }] }] })
    f.tester.run("component-purity", rules["component-purity"], { valid: [], invalid: [{ ...entry, errors: [{ messageId: "finding", line: 3 }, { messageId: "finding", line: 3 }] }] })
})
