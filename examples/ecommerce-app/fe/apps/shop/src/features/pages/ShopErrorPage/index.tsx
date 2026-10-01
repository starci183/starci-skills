import { useTranslations } from "next-intl"
import { ShopErrorPageBase } from "./component"

/** The public props of the shop locale segment's error page: the boundary hands it the retry. */
type ShopErrorPageProps = { readonly onRetry: () => void }

/** A render failure in the shop shows this instead of a blank page; retry re-renders the segment. */
export const ShopErrorPage = (props: ShopErrorPageProps) => {
    const t = useTranslations("shop.errors.page")
    return (
        <ShopErrorPageBase
            state="ready"
            props={{ title: t("title"), retryLabel: t("retry") }}
            on={{ retry: props.onRetry }}
        />
    )
}
