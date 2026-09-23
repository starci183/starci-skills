import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS } from "../common/registry.js"

/**
 * Storybook catalog guard: every Common renderer has a story named after it, in exactly one
 * group file. Adding a renderer without a story, or listing one twice, fails here.
 */
const STORY_GROUPS = {
    "Primitives.stories.tsx": [
        "Avatar", "Badge", "Button", "CloseButton", "Divider", "GrammarRoot", "Heading", "Icon",
        "IconButton", "IconTile", "Image", "IncludedMark", "Kbd", "Label", "LeadingNumber", "Link",
        "Meter", "Progress", "ProgressCircle", "RankArtwork", "Skeleton", "Spinner", "StateMark", "Text",
        "TextAction",
    ],
    "Forms.stories.tsx": [
        "ButtonGroup", "Checkbox", "CheckboxGroup", "ComboBox", "DateField", "DatePicker",
        "DateRangePicker", "Field", "Fieldset", "FileDropzone", "Form", "Input", "NumberField", "OtpInput",
        "PressableField", "RadioGroup", "Rating", "SearchField", "SegmentedControl", "Select", "Slider",
        "Switch", "Textarea", "TimeField",
    ],
    "Overlays.stories.tsx": [
        "Alert", "AlertDialog", "Dialog", "Drawer", "DropdownMenu", "Popover", "Toast", "Toaster", "Tooltip",
    ],
    "NavigationData.stories.tsx": [
        "Accordion", "AvatarGroup", "Breadcrumbs", "Calendar", "DataTable", "DescriptionList", "Disclosure",
        "ListBox", "Pagination", "Stepper", "Subnav", "Tabs", "TagGroup", "Timeline",
    ],
    "Surfaces.stories.tsx": [
        "EmptyNotice", "FencedCodeBlock", "HorizontalScrollRegion", "MarkdownArticle", "MarkdownTableFrame",
        "MediaFrame", "Rail", "SectionHeader", "StaticStateRow", "SurfaceAccordionCard", "SurfaceCard",
        "SurfaceCopyGroup", "SurfaceListCard", "VerticalScrollRegion",
    ],
    "Compositions.stories.tsx": [
        "BottomNav", "ChatWorkspace", "Footer", "NavigationFeatureNav", "PageContainer", "PrimaryRailLayout",
        "Sidebar", "TopBar", "WorkspaceShell",
    ],
} as const

const PAGE_STORIES = [
    "CoreSettings", "CoreDataList", "CoreMobileHome",
    "HeritageSettings", "HeritageDataList", "HeritageMobileHome",
    "OffsetPopSettings", "OffsetPopDataList", "OffsetPopMobileHome",
] as const

const source = (file: string) => readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8")

describe("Storybook catalog", () => {
    it("covers every Common renderer exactly once", () => {
        const listed = Object.values(STORY_GROUPS).flat()
        expect(new Set(listed).size).toBe(listed.length)
        expect([...listed].sort()).toEqual(Object.keys(COMMON_GRAMMAR_COMPONENTS).sort())
        expect(listed).toHaveLength(95)
    })

    it.each(Object.entries(STORY_GROUPS))("%s exports a story per renderer", (file, names) => {
        const text = source(file)
        for (const name of names) expect(text, `${file} is missing story ${name}`).toMatch(new RegExp(`export const ${name}: Story`))
    })

    it("pins three page compositions to each family", () => {
        const text = source("Pages.stories.tsx")
        for (const name of PAGE_STORIES) expect(text).toMatch(new RegExp(`export const ${name}: Story`))
        for (const family of ["core", "heritage", "offset-pop"]) {
            expect(text.split(`grammarFamily: '${family}'`).length - 1).toBe(3)
        }
    })
})
