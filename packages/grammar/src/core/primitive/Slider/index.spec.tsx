// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf, installOverlayShims } from "../../../__test__/familyRoots.js"
import { Slider, type SliderValue } from "./index.js"

installOverlayShims()
afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Slider under %s", (family, Root) => {
    it("is a labelled range input stepped by the keyboard, with guidance on every thumb", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <Slider label="Volume" description="Applies now" defaultValue={40} step={10} onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const thumb = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement
        expect(thumb.value).toBe("40")
        expect(describedTexts(thumb)).toContain("Applies now")
        await act(async () => {
            fireEvent.keyDown(thumb, { key: "ArrowRight" })
        })
        expect(onValueChange).toHaveBeenLastCalledWith(50)
        expect(container.querySelector("[data-component='Slider'] output")?.textContent).toBe("50")
        expect(container.querySelector("[data-grammar-slider-fill]")).not.toBeNull()
    })

    it("renders one named thumb per value for a range", () => {
        render(<Root><Slider label="Price" defaultValue={[10, 60]} thumbLabels={["Minimum", "Maximum"]} /></Root>)
        const thumbs = screen.getAllByRole("slider") as Array<HTMLInputElement>
        expect(thumbs.map((thumb) => thumb.value)).toEqual(["10", "60"])
        expect(screen.getByRole("slider", { name: /Minimum/ })).toBe(thumbs[0])
        expect(screen.getByRole("slider", { name: /Maximum/ })).toBe(thumbs[1])
    })
})

describe("Slider states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<SliderValue>(20)
            return <><Slider label="Level" value={value} onValueChange={setValue} /><output data-testid="out">{String(value)}</output></>
        }
        render(<Controlled />)
        await act(async () => {
            fireEvent.keyDown(screen.getByRole("slider", { name: "Level" }), { key: "ArrowLeft" })
        })
        expect(screen.getByTestId("out").textContent).toBe("19")
    })

    it("wires error to the thumbs and holds the value when read-only", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<>
            <Slider label="Bad" errorMessage="Too loud" defaultValue={90} />
            <Slider label="Fixed" isReadOnly defaultValue={30} onValueChange={onValueChange} />
            <Slider label="Off" isDisabled />
        </>)
        const bad = screen.getByRole("slider", { name: "Bad" })
        expect(describedTexts(bad)).toContain("Too loud")
        expect(bad.getAttribute("aria-errormessage")).toBeTruthy()
        const fixed = screen.getByRole("slider", { name: "Fixed" }) as HTMLInputElement
        await act(async () => {
            fireEvent.keyDown(fixed, { key: "ArrowRight" })
        })
        expect(fixed.value).toBe("30")
        expect(onValueChange).not.toHaveBeenCalled()
        expect((screen.getByRole("slider", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
        expect(container.querySelector("[data-component='Slider'][data-grammar-readonly='true']")).not.toBeNull()
    })
})
