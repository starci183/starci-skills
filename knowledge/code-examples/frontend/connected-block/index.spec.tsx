import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Captured = {
    state: string
    props: {
        status: { isLoading?: boolean; isForbidden?: boolean; isError?: boolean; items?: { value: string } }
        labels: { title: string }
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
        data: undefined as { value: string; checks: Array<string> } | undefined,
        error: undefined as { status?: number } | undefined,
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
vi.mock("@/hooks/slot", () => ({
    useSlotLabels: () => (empty: string) => ({ empty, forbidden: "forbidden", error: "error", retry: "retry" }),
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
    it("folds the query into one slot; the shape never follows the data status", () => {
        mocks.query.isLoading = true
        const view = render(<ExampleBlock />)
        expect(mocks.captured?.state).toBe("summary")
        expect(mocks.captured?.props.status.isLoading).toBe(true)

        mocks.query.isLoading = false
        mocks.query.error = { status: 403 }
        view.rerender(<ExampleBlock />)
        expect(mocks.captured?.state).toBe("summary")
        expect(mocks.captured?.props.status.isForbidden).toBe(true)
        expect(mocks.captured?.props.status.isError).toBe(false)

        mocks.query.error = { status: 500 }
        view.rerender(<ExampleBlock />)
        expect(mocks.captured?.props.status.isError).toBe(true)
        act(() => {
            mocks.captured?.on.retry()
        })
        expect(mocks.query.mutate).toHaveBeenCalledOnce()

        mocks.query.error = undefined
        mocks.query.data = { value: "All clear", checks: [] }
        view.rerender(<ExampleBlock isDetailed />)
        expect(mocks.captured?.state).toBe("detail")
        expect(mocks.captured?.props.status.items?.value).toBe("All clear")
        expect(mocks.captured?.props.labels.title).toBe("title")

        act(() => {
            mocks.captured?.on.openHelp()
        })
        expect(mocks.push).toHaveBeenCalledWith("/example/help")
    })
})
