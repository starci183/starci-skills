"use client"

import { Pagination as HeroPagination } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type PaginationToken = number | "start-ellipsis" | "end-ellipsis"

export type PaginationProps = {
    /** Names the pagination landmark, e.g. "Results pages". */
    readonly label: string
    /** 1-based current page. */
    readonly page: number
    readonly pageCount: number
    readonly onPageChange: (page: number) => void
    /** Pages kept on each side of the current page before collapsing into an ellipsis. */
    readonly siblingCount?: number
    readonly previousLabel: string
    readonly nextLabel: string
    /** App-owned accessible name of one page button, e.g. "Page 3". */
    readonly pageLabel: (page: number) => string
    /** Optional app-owned summary, e.g. "21-30 of 94". */
    readonly summary?: ReactNode
    readonly className?: string
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)

/** The page tokens drawn for one position: first, last, the current window and collapsed gaps. */
export const paginationTokens = (page: number, pageCount: number, siblingCount = 1): ReadonlyArray<PaginationToken> => {
    const count = Math.max(0, Math.floor(pageCount))
    const current = Math.min(Math.max(1, Math.floor(page)), Math.max(1, count))
    if (count <= siblingCount * 2 + 5) return range(1, count)
    const left = Math.max(current - siblingCount, 1)
    const right = Math.min(current + siblingCount, count)
    const showStart = left > 2
    const showEnd = right < count - 1
    const edge = 3 + siblingCount * 2
    if (!showStart && showEnd) return [...range(1, edge), "end-ellipsis", count]
    if (showStart && !showEnd) return [1, "start-ellipsis", ...range(count - edge + 1, count)]
    return [1, "start-ellipsis", ...range(left, right), "end-ellipsis", count]
}

/*
 * Consumer hooks: `starci-core-pagination-summary` names a HeroUI part whose vendor paint Common
 * leaves as it is. No shipped sheet paints it; the Grammar name lets a consumer or family select
 * that part without reaching for vendor class names.
 */

/**
 * Page-by-page navigation over one ordered result set.
 *
 * The current page carries `aria-current="page"`. Below 30rem the previous/next labels and the
 * non-adjacent page numbers leave the paint (the first, last and current page stay), so the strip
 * fits a 360px viewport without horizontal scroll.
 * Contract: list FOCUS-2 (tab order = page order), steps A11Y-2 FOCUS-1, pages FOCUS-1 CONTROL-STATE-3.
 */
export const Pagination = ({
    label,
    page,
    pageCount,
    onPageChange,
    siblingCount = 1,
    previousLabel,
    nextLabel,
    pageLabel,
    summary,
    className,
}: PaginationProps) => {
    const tokens = paginationTokens(page, pageCount, siblingCount)
    const last = Math.max(1, pageCount)
    return (
        <HeroPagination
            aria-label={label}
            className={navigationClassName("starci-core-pagination", className)}
            data-component="Pagination"
            data-tier="composite"
        >
            {summary === undefined ? null : <HeroPagination.Summary className="starci-core-pagination-summary" data-grammar-pagination-summary="true">{summary}</HeroPagination.Summary>}
            <HeroPagination.Content className="starci-core-pagination-list" data-contract="FOCUS-2">
                <HeroPagination.Item className="starci-core-pagination-item" data-grammar-pagination-step="previous">
                    <HeroPagination.Previous
                        aria-label={previousLabel}
                        className="starci-core-pagination-step"
                        data-contract="A11Y-2 FOCUS-1"
                        isDisabled={page <= 1}
                        onPress={() => onPageChange(page - 1)}
                    >
                        <HeroPagination.PreviousIcon />
                        <span aria-hidden="true" className="starci-core-pagination-step-label">{previousLabel}</span>
                    </HeroPagination.Previous>
                </HeroPagination.Item>
                {tokens.map((token) => typeof token === "number" ? (
                    <HeroPagination.Item
                        key={token}
                        className="starci-core-pagination-item"
                        data-grammar-page-distance={Math.min(Math.abs(token - page), 2)}
                        data-grammar-page-edge={token === 1 || token === last ? "true" : "false"}
                    >
                        <HeroPagination.Link
                            aria-label={pageLabel(token)}
                            className="starci-core-pagination-page"
                            data-contract="FOCUS-1 CONTROL-STATE-3"
                            data-grammar-current={token === page ? "true" : "false"}
                            isActive={token === page}
                            onPress={() => { if (token !== page) onPageChange(token) }}
                        >
                            {token}
                        </HeroPagination.Link>
                    </HeroPagination.Item>
                ) : (
                    <HeroPagination.Item key={token} className="starci-core-pagination-item" data-grammar-pagination-gap="true">
                        <HeroPagination.Ellipsis />
                    </HeroPagination.Item>
                ))}
                <HeroPagination.Item className="starci-core-pagination-item" data-grammar-pagination-step="next">
                    <HeroPagination.Next
                        aria-label={nextLabel}
                        className="starci-core-pagination-step"
                        data-contract="A11Y-2 FOCUS-1"
                        isDisabled={page >= last}
                        onPress={() => onPageChange(page + 1)}
                    >
                        <span aria-hidden="true" className="starci-core-pagination-step-label">{nextLabel}</span>
                        <HeroPagination.NextIcon />
                    </HeroPagination.Next>
                </HeroPagination.Item>
            </HeroPagination.Content>
        </HeroPagination>
    )
}
