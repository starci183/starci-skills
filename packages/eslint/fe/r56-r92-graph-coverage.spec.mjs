import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"
// proves: FE_HOOKS_ARE_HOOKS@lite FE_HOOKS_ARE_HOOKS@full
// proves: FE_CUSTOM_HOOK_LOCATION@lite FE_CUSTOM_HOOK_LOCATION@full
// proves: FE_BLOCK_PRODUCT_HOOK_DEFINITION@lite FE_BLOCK_PRODUCT_HOOK_DEFINITION@full
// proves: FE_COMPONENT_DEEP_HOOK_IMPORT@lite FE_COMPONENT_DEEP_HOOK_IMPORT@full
// proves: FE_PURE_REACHES_DATA@lite FE_PURE_REACHES_DATA@full
// proves: FE_PURE_WORLD_HOOK@lite FE_PURE_WORLD_HOOK@full
// proves: FE_PURE_WORLD_IMPORT@lite FE_PURE_WORLD_IMPORT@full
// proves: FE_CONNECTED_BLOCK_RENDER_PAIR@lite FE_CONNECTED_BLOCK_RENDER_PAIR@full
for (const edition of ["lite", "full"]) {
  test(`R56 R92 ${edition} accepts owned hooks and pure rendering and rejects misplaced hooks and world imports`, t => {
    const hook = "apps/web/src/hooks/data/useData.ts"
    const shared = "apps/web/src/hooks/data/wrong.shared.ts"
    const clean = "apps/web/src/components/blocks/Clean/component.tsx"
    const data = "apps/web/src/components/blocks/Data/component.tsx"
    const react = "apps/web/src/components/blocks/React/component.tsx"
    const router = "apps/web/src/components/blocks/Router/component.tsx"
    const own = "apps/web/src/components/blocks/Own/index.tsx"
    const deep = "apps/web/src/components/leaves/Deep/index.tsx"
    const misplaced = "apps/web/src/components/leaves/Misplaced/index.tsx"
    const files = {
      [hook]: 'export const useData = () => 1;',
      "apps/web/src/hooks/index.ts": 'export { useData } from "./data/useData";',
      [shared]: 'export const helper = () => 1;',
      [clean]: 'export const Clean = () => <span />;',
      [data]: 'import { useData } from "../../../hooks"; export const Data = () => null;',
      [react]: 'import { useContext } from "react"; export const ReactView = () => null;',
      [router]: 'import { useRouter } from "next/navigation"; export const Router = () => null;',
      [own]: 'import { useData } from "../../../hooks"; const useOwn = () => useData(); export const Own = () => <span>{useOwn()}</span>;',
      [deep]: 'import { useData } from "../../../hooks/data/useData"; export const Deep = () => null;',
      [misplaced]: 'import { useRef } from "react"; export const useMisplaced = () => useRef(null);',
    }
    const fixture = projectFixture({ profile: "fe", edition, files })
    t.after(fixture.cleanup)
    fixture.tester.run("hooks-are-hooks", rules["hooks-are-hooks"], {
      valid: [{filename: fixture.at(hook), code: files[hook]}],
      invalid: [{filename: fixture.at(shared), code: files[shared], errors: [{message: /FE_HOOKS_ARE_HOOKS/}]}],
    })
    fixture.tester.run("hook-location", rules["hook-location"], {
      valid: [{filename: fixture.at(hook), code: files[hook]}],
      invalid: [
        {filename: fixture.at(deep), code: files[deep], errors: [{message: /FE_COMPONENT_DEEP_HOOK_IMPORT/}]},
        {filename: fixture.at(misplaced), code: files[misplaced], errors: [{message: /FE_CUSTOM_HOOK_LOCATION/}]},
        {filename: fixture.at(own), code: files[own], errors: [{message: /FE_BLOCK_PRODUCT_HOOK_DEFINITION/}, {message: /FE_CUSTOM_HOOK_LOCATION/}]},
      ],
    })
    fixture.tester.run("component-purity", rules["component-purity"], {
      valid: [{filename: fixture.at(clean), code: files[clean]}],
      invalid: [
        {filename: fixture.at(data), code: files[data], errors: [{message: /FE_PURE_REACHES_DATA/}]},
        {filename: fixture.at(react), code: files[react], errors: [{message: /FE_PURE_WORLD_HOOK/}]},
        {filename: fixture.at(router), code: files[router], errors: [{message: /FE_PURE_WORLD_IMPORT/}]},
        {filename: fixture.at(own), code: files[own], errors: [{message: /FE_CONNECTED_BLOCK_RENDER_PAIR/}, {message: /FE_WORLD_OWNER_RENDER_BOUNDARY/}]},
      ],
    })
  })
}
