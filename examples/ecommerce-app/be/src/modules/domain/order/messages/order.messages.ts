import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the order codes, Vietnamese and English. */
export const ORDER_MESSAGES: MessageBundle = {
    vi: {
        "errors.ORDER_CART_EMPTY": "Giỏ hàng đang trống.",
        "errors.ORDER_UNKNOWN_PRODUCT": "Sản phẩm {{productId}} không tồn tại.",
        "errors.ORDER_INSUFFICIENT_STOCK": "Sản phẩm {{productId}} không đủ hàng.",
    },
    en: {
        "errors.ORDER_CART_EMPTY": "The cart is empty.",
        "errors.ORDER_UNKNOWN_PRODUCT": "Product {{productId}} does not exist.",
        "errors.ORDER_INSUFFICIENT_STOCK": "Product {{productId}} does not have enough stock.",
    },
}
