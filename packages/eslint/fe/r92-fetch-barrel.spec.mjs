import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

// proves: FE_COMPONENT_WORLD_OWNERSHIP@lite FE_COMPONENT_WORLD_OWNERSHIP@full
// proves: FE_WORLD_OWNER_RENDER_BOUNDARY@lite FE_WORLD_OWNER_RENDER_BOUNDARY@full
for (const edition of ["lite", "full"]) {
  test(`R92 ${edition} rejects global fetch through a UI hook barrel and accepts intrinsic UI and data owners`, t => {
    const branch = "apps/web/src/components/branches/Remote/index.tsx"
    const intrinsic = "apps/web/src/components/branches/Local/index.tsx"
    const block = "apps/web/src/components/blocks/Data/index.tsx"
    const files = {
      "apps/web/src/hooks/index.ts": 'export { useRemote } from "./ui/useRemote"; export { useLocal } from "./ui/useLocal"; export { useData } from "./data/useData";',
      "apps/web/src/hooks/ui/useRemote.ts": 'export const useRemote = () => fetch("https://example.test");',
      "apps/web/src/hooks/ui/useLocal.ts": 'const fetch = () => 1; export const useLocal = () => fetch();',
      "apps/web/src/hooks/data/useData.ts": 'export const useData = () => 1;',
      [branch]: 'import { useRemote } from "../../../hooks"; export const Remote = () => { const value = useRemote(); return <span>{String(value)}</span> };',
      [intrinsic]: 'import { useLocal } from "../../../hooks"; export const Local = () => <span>{useLocal()}</span>;',
      [block]: 'import { useData } from "../../../hooks"; import { DataView } from "./component"; export const Data = () => <DataView value={useData()}/>;',
      "apps/web/src/components/blocks/Data/component.tsx": 'export const DataView = ({value}: {value: number}) => <span>{value}</span>;',
    }
    const fixture = projectFixture({ profile: "fe", edition, files })
    t.after(fixture.cleanup)
    fixture.tester.run("component-purity", rules["component-purity"], {
      valid: [intrinsic, block, "apps/web/src/hooks/data/useData.ts"].map(file => ({ filename: fixture.at(file), code: files[file] })),
      invalid: [{ filename: fixture.at(branch), code: files[branch], errors: [{ message: /FE_COMPONENT_WORLD_OWNERSHIP/ }, { message: /FE_WORLD_OWNER_RENDER_BOUNDARY/ }] }],
    })
  })
}
