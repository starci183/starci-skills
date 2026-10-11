// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, installDomShims } from "../__test__/grammarRoots.js"
import { DataTable } from "./branch/DataTable/index.js"
import { FlowGraph } from "./branch/FlowGraph/index.js"
import { ListBox } from "./branch/ListBox/index.js"
import { Select } from "./branch/Select/index.js"
import { SurfaceListCard } from "./branch/SurfaceListCard/index.js"
import { Breadcrumbs } from "./composite/Breadcrumbs/index.js"
import { CheckboxGroup } from "./composite/CheckboxGroup/index.js"
import { SegmentedControl } from "./composite/SegmentedControl/index.js"
import { Stepper } from "./composite/Stepper/index.js"
import { Timeline } from "./composite/Timeline/index.js"
import { ChatBubble, ChatBubbleSkeletons } from "./composite/ChatBubble/index.js"
import { DescriptionList } from "./composite/DescriptionList/index.js"
import { ListRow } from "./composite/ListRow/index.js"
import { StaticStateRow } from "./composite/StaticStateRow/index.js"
import { Avatar } from "./primitive/Avatar/index.js"
import { Meter } from "./primitive/Meter/index.js"
import { NumberField } from "./primitive/NumberField/index.js"
import { SearchField } from "./primitive/SearchField/index.js"
import { Switch } from "./primitive/Switch/index.js"
import { SectionHeader } from "./primitive/SectionHeader/index.js"
import { Textarea } from "./primitive/Textarea/index.js"

beforeAll(installDomShims)
afterEach(cleanup)

const columns = [{ id: "name", label: "Name", isRowHeader: true }, { id: "count", label: "Count", align: "end" as const }]
const skeletonCount = (root: ParentNode) => root.querySelectorAll('[data-component="Skeleton"]').length

describe.each(FAMILY_WRAPS)("knowledge STATE-8 loading views under %s", (_family, wrap) => {
    describe("ListRow isSkeleton", () => {
        it("draws the four parts as aria-hidden geometry and renders no real content or control", () => {
            const { container } = render(wrap(<ul><ListRow isSkeleton title="Real title" description="Real line" leading={<b>L</b>} actions={<button type="button">Open</button>} badges={<i>B</i>}>Detail</ListRow></ul>))
            const row = container.querySelector("li")!
            expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(row.getAttribute("data-grammar-skeleton")).toBe("true")
            expect(row.querySelector('[data-shape="circle"]')).not.toBeNull()
            expect(row.querySelectorAll('[data-shape="text"]')).toHaveLength(2)
            expect(row.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(row.textContent).toBe("")
            expect(row.querySelector("button")).toBeNull()
        })

        it("draws only the parts that are passed", () => {
            const { container } = render(wrap(<ul><ListRow isSkeleton title="Only title" /></ul>))
            expect(skeletonCount(container)).toBe(1)
        })
    })

    describe("SurfaceListCard isLoading", () => {
        it("draws 3 skeleton rows by default, aria-hidden, and marks the collection busy", () => {
            const { container } = render(wrap(<SurfaceListCard label="Saved" isLoading />))
            const rows = container.querySelectorAll('li[data-grammar-skeleton="true"]')
            expect(rows).toHaveLength(3)
            for (const row of rows) expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(container.querySelector('[data-grammar-list="true"]')?.getAttribute("aria-busy")).toBe("true")
            expect(container.querySelector("h3")?.textContent).toBe("Saved")
        })

        it("honours loadingRows and clamps it to 1..12", () => {
            const rowsFor = (loadingRows: number) => {
                const { container, unmount } = render(wrap(<SurfaceListCard label="Saved" isLoading loadingRows={loadingRows} />))
                const count = container.querySelectorAll('li[data-grammar-skeleton="true"]').length
                unmount()
                return count
            }
            expect(rowsFor(5)).toBe(5)
            expect(rowsFor(40)).toBe(12)
            expect(rowsFor(0)).toBe(1)
        })

        it("lets real children win, and prefers the skeleton to the empty notice while loading", () => {
            const real = render(wrap(<SurfaceListCard label="Saved" isLoading><StaticStateRow item={{ id: "a", label: "Ada" }} /></SurfaceListCard>))
            expect(real.container.querySelectorAll('li[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(real.container.textContent).toContain("Ada")
            real.unmount()
            const loadingEmpty = render(wrap(<SurfaceListCard label="Saved" isLoading empty={<p>Nothing saved</p>} />))
            expect(loadingEmpty.container.querySelectorAll('li[data-grammar-skeleton="true"]')).toHaveLength(3)
            expect(loadingEmpty.container.textContent).not.toContain("Nothing saved")
        })

        it("is not busy when it is not loading", () => {
            const { container } = render(wrap(<SurfaceListCard label="Saved"><StaticStateRow item={{ id: "a", label: "Ada" }} /></SurfaceListCard>))
            expect(container.querySelector('[data-grammar-list="true"]')?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("DescriptionList isLoading", () => {
        it("keeps terms real and turns descriptions into skeletons, aria-busy on the root", () => {
            const { container } = render(wrap(<DescriptionList isLoading items={[{ id: "a", term: "Owner", description: "Ada" }, { id: "b", term: "Plan", description: "Pro" }]} />))
            const list = container.querySelector("dl")!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect([...list.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Owner", "Plan"])
            expect(list.textContent).not.toContain("Ada")
            expect(list.querySelectorAll("dd")).toHaveLength(2)
            expect(skeletonCount(list)).toBe(2)
        })

        it("covers the stat-strip figure and meta, and drops the unit", () => {
            const { container } = render(wrap(<DescriptionList layout="stat-strip" isLoading items={[{ id: "a", term: "Revenue", description: "1,200", unit: "USD", meta: "Updated now" }, { id: "b", term: "Users", description: "40" }]} />))
            const list = container.querySelector("dl")!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect([...list.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Revenue", "Users"])
            expect(list.textContent).not.toMatch(/1,200|USD|Updated now|40/)
            expect(skeletonCount(list)).toBe(3)
        })

        it("is not busy when loaded", () => {
            const { container } = render(wrap(<DescriptionList items={[{ id: "a", term: "Owner", description: "Ada" }]} />))
            expect(container.querySelector("dl")?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("DataTable isLoading", () => {
        const cell = () => "x"
        it("keeps the real headers and draws 3 aria-hidden skeleton rows by default instead of the empty state", () => {
            const { container } = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading />))
            expect([...container.querySelectorAll("th")].map((header) => header.textContent)).toEqual(["Name", "Count"])
            const rows = container.querySelectorAll('[data-grammar-table-row][data-grammar-skeleton="true"]')
            expect(rows).toHaveLength(3)
            for (const row of rows) expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(container.querySelector('[data-component="DataTable"]')?.getAttribute("aria-busy")).toBe("true")
            expect(container.querySelector("[data-grammar-table-empty]")).toBeNull()
            expect(skeletonCount(container)).toBe(6)
        })

        it("honours loadingRows, and loadingContent still replaces the body", () => {
            const five = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading loadingRows={5} />))
            expect(five.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(5)
            five.unmount()
            const custom = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading loadingContent="Loading invoices" />))
            expect(custom.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(custom.container.textContent).toContain("Loading invoices")
        })
    })

    describe("FlowGraph isLoading", () => {
        it("draws the frame with a skeleton, mounts no React Flow, and is busy", () => {
            const { container } = render(wrap(<FlowGraph label="Second brain" height="lg" isLoading nodes={[{ id: "a", label: "Root" }]} edges={[]} />))
            const figure = container.querySelector('[data-component="FlowGraph"]')!
            expect(figure.getAttribute("aria-busy")).toBe("true")
            expect(figure.getAttribute("aria-label")).toBe("Second brain")
            expect(figure.getAttribute("data-grammar-flow-height")).toBe("lg")
            expect(figure.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(container.querySelector(".react-flow")).toBeNull()
            expect(container.querySelector("[data-grammar-flow-fallback]")).toBeNull()
        })
    })

    describe("SectionHeader isSkeleton", () => {
        it("keeps the heading rank, draws title, description and meta as skeleton text, and is busy", () => {
            const { container } = render(wrap(<SectionHeader level={3} eyebrow="Course" title="Real title" description="Real copy" meta="Real meta" count={4} action={<button type="button">Share</button>} isSkeleton />))
            const root = container.querySelector('[data-component="SectionHeader"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.querySelector("h3")?.getAttribute("aria-hidden")).toBe("true")
            expect(root.textContent).toBe("Course")
            expect(root.querySelector("button")).toBeNull()
            expect(root.querySelectorAll('[data-shape="text"]')).toHaveLength(3)
            expect(root.querySelector('.starci-core-section-action [data-shape="rect"]')).not.toBeNull()
        })

        it("draws only the parts that are passed and is not busy when loaded", () => {
            const { container, unmount } = render(wrap(<SectionHeader title="Only title" isSkeleton />))
            expect(skeletonCount(container)).toBe(1)
            expect(container.querySelector(".starci-core-section-action")).toBeNull()
            unmount()
            const loaded = render(wrap(<SectionHeader title="Done" />))
            expect(loaded.container.querySelector('[data-component="SectionHeader"]')?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("Breadcrumbs isSkeleton", () => {
        it("renders a short aria-hidden skeleton for the unknown crumb and keeps the others real", () => {
            const { container } = render(wrap(<Breadcrumbs label="Trail" items={[{ id: "a", label: "Home", href: "#a" }, { id: "b", label: "Lessons", href: "#b" }, { id: "c", label: "", isSkeleton: true }]} />))
            const nav = container.querySelector("nav")!
            expect(nav.textContent).toBe("HomeLessons")
            expect(nav.querySelectorAll("a")).toHaveLength(2)
            const crumb = nav.querySelector(".starci-core-breadcrumb-skeleton")!
            expect(crumb.getAttribute("aria-hidden")).toBe("true")
            expect(crumb.querySelector('[data-shape="text"]')).not.toBeNull()
            expect(skeletonCount(nav)).toBe(1)
        })

        it("never links a skeleton crumb, even one that has an href", () => {
            const { container } = render(wrap(<Breadcrumbs label="Trail" items={[{ id: "a", label: "Home", href: "#a" }, { id: "b", label: "", href: "#b", isSkeleton: true }, { id: "c", label: "Now" }]} />))
            expect(container.querySelectorAll("a")).toHaveLength(1)
        })
    })

    describe("Select isSkeleton", () => {
        const options = [{ id: "a", label: "Alpha" }]
        it("keeps the label real and replaces the trigger with a non-focusable aria-hidden skeleton field", () => {
            const { container } = render(wrap(<Select label="Plan" options={options} isSkeleton />))
            const root = container.querySelector('[data-component="Select"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.textContent).toBe("Plan")
            const control = root.querySelector('[data-grammar-field-skeleton="select"]')!
            expect(control.getAttribute("aria-hidden")).toBe("true")
            expect(control.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(root.querySelector("button, input, select, [tabindex], [role='button']")).toBeNull()
        })

        it("keeps the label as the name when it is hidden", () => {
            const { container } = render(wrap(<Select label="Plan" options={options} isLabelHidden isSkeleton />))
            expect(container.querySelector(".starci-core-form-label--screen-reader")?.textContent).toBe("Plan")
        })
    })

    describe("Textarea isSkeleton", () => {
        it("keeps the label real and draws a skeleton block sized by rows", () => {
            const { container } = render(wrap(<Textarea label="Bio" rows={6} isSkeleton />))
            const root = container.querySelector('[data-component="Textarea"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.textContent).toBe("Bio")
            const control = root.querySelector<HTMLElement>('[data-grammar-field-skeleton="textarea"]')!
            expect(control.getAttribute("aria-hidden")).toBe("true")
            expect(control.style.getPropertyValue("--starci-core-skeleton-rows")).toBe("6")
            expect(root.querySelector("textarea")).toBeNull()
        })
    })

    describe("Meter isSkeleton", () => {
        it("keeps the label real, announces no meter or value, and draws a static skeleton bar", () => {
            const { container } = render(wrap(<Meter label="Storage" value={40} valueLabel="40%" isSkeleton />))
            const root = container.querySelector('[data-component="Meter"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.getAttribute("role")).toBeNull()
            expect(root.querySelector("[role='meter'], [aria-valuenow]")).toBeNull()
            expect(root.textContent).toBe("Storage")
            const bar = root.querySelector(".starci-core-meter-skeleton-bar")!
            expect(bar.getAttribute("aria-hidden")).toBe("true")
            expect(bar.querySelector('[data-shape="rect"]')).not.toBeNull()
        })
    })

    describe("ListBox isLoading", () => {
        it("draws 3 aria-hidden skeleton options by default inside the named, busy list", () => {
            const { container } = render(wrap(<ListBox label="Members" items={[]} isLoading emptyContent="None" />))
            const list = container.querySelector('[data-component="ListBox"]')!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect(list.getAttribute("aria-label")).toBe("Members")
            const options = list.querySelectorAll('[data-grammar-skeleton="true"]')
            expect(options).toHaveLength(3)
            for (const option of options) {
                expect(option.getAttribute("aria-hidden")).toBe("true")
                expect(option.querySelectorAll('[data-shape="text"]')).toHaveLength(2)
            }
            expect(list.textContent).toBe("")
        })

        it("honours loadingRows (clamped 1..12) and lets real items win", () => {
            const five = render(wrap(<ListBox label="Members" items={[]} isLoading loadingRows={5} />))
            expect(five.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(5)
            five.unmount()
            const clamped = render(wrap(<ListBox label="Members" items={[]} isLoading loadingRows={99} />))
            expect(clamped.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(12)
            clamped.unmount()
            const real = render(wrap(<ListBox label="Members" items={[{ id: "a", label: "Ada" }]} isLoading />))
            expect(real.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(real.container.textContent).toContain("Ada")
        })

        it("is not busy when loaded", () => {
            const { container } = render(wrap(<ListBox label="Members" items={[{ id: "a", label: "Ada" }]} />))
            expect(container.querySelector('[data-component="ListBox"]')?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("ChatBubble isSkeleton", () => {
        it("draws the bubble on its side with two skeleton lines and no content or control", () => {
            const { container } = render(wrap(<ChatBubble isSkeleton side="outgoing" author="Real" meta="09:00" actions={<button type="button">Reply</button>} footer={<b>card</b>}>Real text</ChatBubble>))
            const bubble = container.querySelector('[data-component="ChatBubble"]')!
            expect(bubble.getAttribute("aria-hidden")).toBe("true")
            expect(bubble.getAttribute("data-grammar-bubble-side")).toBe("outgoing")
            expect(bubble.querySelector(".starci-core-chat-bubble-body")).not.toBeNull()
            expect(bubble.querySelectorAll('[data-shape="text"] > *')).toHaveLength(2)
            expect(bubble.textContent).toBe("")
            expect(bubble.querySelector("button")).toBeNull()
            expect(bubble.querySelector(".starci-core-chat-bubble-avatar")).toBeNull()
        })

        it("draws a skeleton avatar only when one is passed", () => {
            const { container } = render(wrap(<ChatBubble isSkeleton avatar={<b>L</b>} />))
            expect(container.querySelector('.starci-core-chat-bubble-avatar [data-shape="circle"]')).not.toBeNull()
            expect(container.textContent).toBe("")
        })

        it("ChatBubbleSkeletons draws 3 alternating bubbles in one busy thread, clamped 1..12", () => {
            const { container, unmount } = render(wrap(<ChatBubbleSkeletons />))
            const thread = container.querySelector("[data-grammar-chat-skeleton-thread]")!
            expect(thread.getAttribute("aria-busy")).toBe("true")
            expect([...thread.querySelectorAll("[data-grammar-bubble-side]")].map((bubble) => bubble.getAttribute("data-grammar-bubble-side"))).toEqual(["incoming", "outgoing", "incoming"])
            unmount()
            expect(render(wrap(<ChatBubbleSkeletons count={50} />)).container.querySelectorAll("[data-grammar-bubble-side]")).toHaveLength(12)
        })
    })

    describe.each([
        ["NumberField", (props: object) => <NumberField label="Seats" {...props} />, "input"],
        ["SearchField", (props: object) => <SearchField label="Search" {...props} />, "input"],
    ])("%s isSkeleton", (name, make, kind) => {
        it("keeps the label real and draws a non-focusable aria-hidden field block", () => {
            const { container } = render(wrap(make({ isSkeleton: true, value: 3 } as object)))
            const root = container.querySelector(`[data-component="${name}"]`)!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.textContent).toBe(name === "NumberField" ? "Seats" : "Search")
            const control = root.querySelector(`[data-grammar-field-skeleton="${kind}"]`)!
            expect(control.getAttribute("aria-hidden")).toBe("true")
            expect(control.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(root.querySelector("button, input, [tabindex], [role]")).toBeNull()
        })
    })

    describe("SegmentedControl isSkeleton", () => {
        const options = [{ value: "a", label: "Day" }, { value: "b", label: "Week" }, { value: "c", label: "Month" }]
        it("keeps the label real and draws one aria-hidden block sized by the option count", () => {
            const { container } = render(wrap(<SegmentedControl label="Range" options={options} isSkeleton />))
            const root = container.querySelector('[data-component="SegmentedControl"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.textContent).toBe("Range")
            const control = root.querySelector<HTMLElement>('[data-grammar-field-skeleton="segmented"]')!
            expect(control.getAttribute("aria-hidden")).toBe("true")
            expect(control.style.getPropertyValue("--starci-core-skeleton-segments")).toBe("3")
            expect(control.getAttribute("data-width")).toBe("content")
            expect(root.querySelector("button, [role]")).toBeNull()
        })

        it("stretches with width fill", () => {
            const { container } = render(wrap(<SegmentedControl label="Range" options={options} width="fill" isSkeleton />))
            expect(container.querySelector('[data-grammar-field-skeleton="segmented"]')?.getAttribute("data-width")).toBe("fill")
        })
    })

    describe("CheckboxGroup isSkeleton", () => {
        it("keeps the group and option labels real and draws a skeleton box per option", () => {
            const { container } = render(wrap(<CheckboxGroup label="Topics" orientation="horizontal" options={[{ value: "a", label: "Maths", description: "Hidden" }, { value: "b", label: "Art" }]} isSkeleton />))
            const root = container.querySelector('[data-component="CheckboxGroup"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.getAttribute("data-grammar-orientation")).toBe("horizontal")
            expect(root.textContent).toBe("TopicsMathsArt")
            const boxes = root.querySelectorAll('[data-grammar-field-skeleton="choice"]')
            expect(boxes).toHaveLength(2)
            for (const box of boxes) expect(box.getAttribute("aria-hidden")).toBe("true")
            expect(root.querySelector("input, button, [role]")).toBeNull()
        })
    })

    describe("Switch isSkeleton", () => {
        it("keeps the label real and draws a track that is not a switch", () => {
            const { container } = render(wrap(<Switch label="Notifications" isSelected isSkeleton />))
            const root = container.querySelector('[data-component="Switch"]')!
            expect(root.getAttribute("aria-busy")).toBe("true")
            expect(root.textContent).toBe("Notifications")
            expect(root.querySelector('[data-grammar-field-skeleton="switch"]')?.getAttribute("aria-hidden")).toBe("true")
            expect(root.querySelector("input, [role='switch']")).toBeNull()
        })
    })

    describe("Avatar isSkeleton", () => {
        it.each(["sm", "md", "lg"] as const)("draws an aria-hidden skeleton circle at size %s with no name or initials", (size) => {
            const { container } = render(wrap(<Avatar name="Ada Lovelace" size={size} isSkeleton />))
            const avatar = container.querySelector('[data-component="Avatar"]')!
            expect(avatar.getAttribute("aria-hidden")).toBe("true")
            expect(avatar.getAttribute("data-grammar-avatar-size")).toBe(size)
            expect(avatar.getAttribute("role")).toBeNull()
            expect(avatar.textContent).toBe("")
            expect(avatar.querySelector(`[data-shape="circle"][data-size="${size}"]`)).not.toBeNull()
        })
    })

    describe("Stepper isLoading", () => {
        const steps = [{ id: "a", label: "Cart" }, { id: "b", label: "" }, { id: "c", label: "Pay", description: "Hidden" }]
        it("keeps given labels real, marks become skeleton circles, no current step or button, busy landmark", () => {
            const { container } = render(wrap(<Stepper label="Checkout" steps={steps} currentStepId="b" onStepSelect={() => undefined} isLoading />))
            const nav = container.querySelector("nav")!
            expect(nav.getAttribute("aria-busy")).toBe("true")
            expect(nav.getAttribute("aria-label")).toBe("Checkout")
            expect(nav.textContent).toBe("CartPay")
            expect(nav.querySelectorAll('.starci-core-step-marker [data-shape="circle"]')).toHaveLength(3)
            expect(nav.querySelector(".starci-core-step-skeleton-label [data-shape='text']")).not.toBeNull()
            expect(nav.querySelector("[aria-current], button")).toBeNull()
            for (const marker of nav.querySelectorAll(".starci-core-step-marker")) expect(marker.getAttribute("aria-hidden")).toBe("true")
        })

        it("is not busy when loaded", () => {
            const { container } = render(wrap(<Stepper label="Checkout" steps={steps} currentStepId="a" />))
            expect(container.querySelector("nav")?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("Timeline isLoading", () => {
        it("draws 3 aria-hidden skeleton entries by default in the named, busy list", () => {
            const { container } = render(wrap(<Timeline label="History" items={[]} isLoading />))
            const list = container.querySelector("ol")!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect(list.getAttribute("aria-label")).toBe("History")
            const rows = list.querySelectorAll('li[data-grammar-skeleton="true"]')
            expect(rows).toHaveLength(3)
            for (const row of rows) {
                expect(row.getAttribute("aria-hidden")).toBe("true")
                expect(row.querySelectorAll('[data-shape="text"]')).toHaveLength(3)
                expect(row.querySelector('.starci-core-timeline-marker [data-shape="circle"]')).not.toBeNull()
            }
            expect(list.textContent).toBe("")
        })

        it("honours loadingRows (clamped 1..12) and lets real items win", () => {
            const rowsFor = (loadingRows: number) => {
                const { container, unmount } = render(wrap(<Timeline label="History" items={[]} isLoading loadingRows={loadingRows} />))
                const count = container.querySelectorAll("li").length
                unmount()
                return count
            }
            expect(rowsFor(5)).toBe(5)
            expect(rowsFor(99)).toBe(12)
            expect(rowsFor(0)).toBe(1)
            const real = render(wrap(<Timeline label="History" isLoading items={[{ id: "a", title: "Shipped" }]} />))
            expect(real.container.querySelectorAll('li[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(real.container.textContent).toContain("Shipped")
        })

        it("is not busy when loaded", () => {
            const { container } = render(wrap(<Timeline label="History" items={[{ id: "a", title: "Shipped" }]} />))
            expect(container.querySelector("ol")?.hasAttribute("aria-busy")).toBe(false)
        })
    })
})
