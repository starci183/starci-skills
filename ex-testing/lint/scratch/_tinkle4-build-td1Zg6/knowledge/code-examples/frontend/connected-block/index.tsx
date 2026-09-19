"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useQueryExampleStatusSwr } from "@/hooks"
import { ExampleBlockBase, type ExampleBlockState } from "./component"

/** Connected owner input; status is resolved from approved data hooks. */
export type ExampleBlockOwnerProps = Record<never, never>

/**
 * Connected status block.
 *
 * Owns query, localization, navigation and state resolution, then passes only
 * resolved values into ExampleBlockBase.
 */
export const ExampleBlock = (props: ExampleBlockOwnerProps) => {
    void props
    const t = useTranslations("exampleStatus")
    const router = useRouter()
    const query = useQueryExampleStatusSwr()
    const state: ExampleBlockState = query.isLoading
        ? "pending"
        : query.error !== undefined
            ? "failed"
            : "ready"
    return (
        <ExampleBlockBase
            state={state}
            props={{
                labels: {
                    title: t("title"),
                    pendingMessage: t("pendingMessage"),
                    failedMessage: t("failedMessage"),
                    retryLabel: t("retryLabel"),
                    detailsLabel: t("detailsLabel"),
                    helpLabel: t("helpLabel"),
                },
                value: query.data?.value,
                detailsHref: "/example/details",
            }}
            on={{
                retry: () => {
                    void query.mutate()
                },
                openHelp: () => {
                    router.push("/example/help")
                },
            }}
        />
    )
}

export { ExampleBlockBase } from "./component"
export type {
    ExampleBlockActions,
    ExampleBlockData,
    ExampleBlockLabels,
    ExampleBlockProps,
    ExampleBlockState,
} from "./component"
