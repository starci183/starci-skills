import { useState } from "react"
import { useTranslations } from "next-intl"
import { useQueryOrderReceiptSwr } from "../swr"

/**
 * Owns the receipt press of one confirmed order: it asks the order service for a fresh download link and sends the
 * browser to it. A receipt the archive has not taken yet is named as not ready (a press later succeeds); any other
 * refusal is named as refused.
 */
export const useDownloadReceipt = (orderId: string) => {
    const t = useTranslations("shop.checkout.confirmed.receipt")
    const receipt = useQueryOrderReceiptSwr(orderId)
    const [failure, setFailure] = useState<string | null>(null)
    const onPress = () => {
        void receipt.trigger().then((response) => {
            if (response.success) {
                setFailure(null)
                window.location.assign(response.data.url)
                return
            }
            setFailure(response.error === "ORDER_RECEIPT_NOT_READY" ? t("notReady") : t("refused"))
        })
    }
    return { props: { failure, pending: receipt.isMutating }, on: { onPress } }
}
