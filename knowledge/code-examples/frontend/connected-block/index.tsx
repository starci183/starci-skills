"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useQueryExampleStatusSwr } from "@/hooks"
import { useSlotLabels } from "@/hooks/slot"
import { toSlot } from "@/modules/slot"
import { ExampleBlockBase } from "./component"

/** Connected owner input: the shape is chosen by the page as an atom. */
export type ExampleBlockProps = {
    readonly isDetailed?: boolean
}

/**
 * Connected status block.
 *
 * Owns query, localization and navigation, folds the query into a slot, and passes only
 * resolved atoms into ExampleBlockBase. This folder exports ExampleBlock only; the pure
 * half stays behind it.
 */
export const ExampleBlock = (props: ExampleBlockProps) => {
    const t = useTranslations("exampleStatus")
    const slotLabels = useSlotLabels()
    const router = useRouter()
    const query = useQueryExampleStatusSwr()
    return (
        <ExampleBlockBase
            state={props.isDetailed === true ? "detail" : "summary"}
            props={{
                status: toSlot(query),
                labels: {
                    title: t("title"),
                    detailsLabel: t("detailsLabel"),
                    helpLabel: t("helpLabel"),
                    status: slotLabels(t("emptyMessage")),
                },
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

export type { ExampleBlockState } from "./component"
