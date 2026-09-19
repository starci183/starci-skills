import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Captured = {
    state: string
    props: {
        labels: Record<string, string>
        value?: string
        detailsHref: string
    }
    on: {
        retry: () => void
        openHelp: () => void
    }
}

const mocks = vi.hoisted(() => ({
    captured: undefined as Captured | undefined,
    push: vi.fn(),
    query: {
        data: undefined as { value: string } | undefined,
        error: undefined as unknown,
        isLoading: false,
        mutate: vi.fn(),
    },
}))

vi.mock("next-intl", () => ({
    useTranslations: () => (key: string) => key,
}))
vi.mock("@/i18n/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
}))
vi.mock("@/hooks", () => ({
    useQueryExampleStatusSwr: () => mocks.query,
}))
vi.mock("./component", () => ({
    ExampleBlockBase: (input: Captured) => {
        mocks.captured = input
        return <output data-testid="example-block" />
    },
}))

import { ExampleBlock } from "./index"

beforeEach(() => {
    vi.clearAllMocks()
    mocks.captured = undefined
    mocks.query.data = undefined
    mocks.query.error = undefined
    mocks.query.isLoading = false
})

describe("ExampleBlock", () => {
    it("maps query states into resolved Base props and owns navigation", () => {
        mocks.query.isLoading = true
        const view = render(<ExampleBlock />)
        expect(mocks.captured?.state).toBe("pending")

        mocks.query.isLoading = false
        mocks.query.error = new Error("network")
        view.rerender(<ExampleBlock />)
        expect(mocks.captured?.state).toBe("failed")
        expect(mocks.captured?.props.labels.title).toBe("title")
        expect(mocks.captured?.props.detailsHref).toBe("/example/details")

        act(() => {
            mocks.captured?.on.retry()
        })
        expect(mocks.query.mutate).toHaveBeenCalledOnce()

        mocks.query.error = undefined
        mocks.query.data = { value: "All clear" }
        view.rerender(<ExampleBlock />)
        expect(mocks.captured?.state).toBe("ready")
        expect(mocks.captured?.props.value).toBe("All clear")

        act(() => {
            mocks.captured?.on.openHelp()
        })
        expect(mocks.push).toHaveBeenCalledWith("/example/help")
    })
})
