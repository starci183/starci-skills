import { useState } from "react"
import { useTranslations } from "next-intl"
import { useGraphQLWithToast } from "@/modules/toast"
import { useMutateClearCartSwr, useQueryCartSwr } from "../swr"

/**
 * Owns the cart's clear press: it runs the real `clearCart` mutation and revalidates the cart query so the page re-reads
 * the now-empty cart; a refusal is named inline and nothing is pretended empty.
 */
export const useClearCart = () => {
    const t = useTranslations("shop.cart")
    const runGraphQL = useGraphQLWithToast()
    const cart = useQueryCartSwr()
    const clear = useMutateClearCartSwr()
    const [refused, setRefused] = useState(false)
    const onPress = () => {
        void runGraphQL(() => clear.trigger(), { successMessage: t("cleared") }).then(async (response) => {
            setRefused(!response.success)
            if (response.success) await cart.mutate()
        })
    }
    return { props: { refused, pending: clear.isMutating }, on: { onPress } }
}
