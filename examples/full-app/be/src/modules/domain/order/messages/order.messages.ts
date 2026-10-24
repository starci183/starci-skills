import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the order codes, Vietnamese and English. */
export const ORDER_MESSAGES: MessageBundle = {
    vi: {
        "errors.ORDER_CART_EMPTY": "Giỏ hàng đang trống.",
        "errors.ORDER_UNKNOWN_PRODUCT": "Sản phẩm {{productId}} không tồn tại.",
        "errors.ORDER_INSUFFICIENT_STOCK": "Sản phẩm {{productId}} không đủ hàng.",
        "errors.ORDER_RECEIPT_NOT_FOUND": "Không tìm thấy đơn hàng này.",
        "errors.ORDER_RECEIPT_NOT_READY": "Hóa đơn chưa sẵn sàng, hãy thử lại sau.",
        "errors.ORDER_PAGE_SIZE_INVALID": "Số đơn mỗi trang phải từ 1 đến {{max}}.",
        "errors.ORDER_PAGE_CURSOR_INVALID": "Con trỏ trang không hợp lệ, hãy tải lại danh sách.",
    },
    en: {
        "errors.ORDER_CART_EMPTY": "The cart is empty.",
        "errors.ORDER_UNKNOWN_PRODUCT": "Product {{productId}} does not exist.",
        "errors.ORDER_INSUFFICIENT_STOCK": "Product {{productId}} does not have enough stock.",
        "errors.ORDER_RECEIPT_NOT_FOUND": "This order was not found.",
        "errors.ORDER_RECEIPT_NOT_READY": "The receipt is not ready yet, try again shortly.",
        "errors.ORDER_PAGE_SIZE_INVALID": "The page size must be from 1 to {{max}}.",
        "errors.ORDER_PAGE_CURSOR_INVALID": "The page cursor is not valid, reload the list.",
    },
}
