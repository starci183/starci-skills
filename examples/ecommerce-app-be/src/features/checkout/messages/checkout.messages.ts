import {
    createMessageCatalog 
} from "ecommerce-app-be/modules/platform/i18n"

/** The checkout feature's user-facing copy: refusal sentences in Vietnamese and English, read by key. */
export const CHECKOUT_MESSAGES = createMessageCatalog({
    vi: {
        "addCartItem.invalid": "Cần có productId và số lượng là số nguyên dương.",
        "session.tokenRequired": "Cần có mã phiên Bearer.",
        "session.noLiveSession": "Không có phiên nào còn hiệu lực ứng với mã này.",
        "session.noHttpRequest": "Ngữ cảnh GraphQL không mang theo yêu cầu HTTP.",
        "session.noActor": "Yêu cầu được bảo vệ nhưng không có người thực hiện.",
    },
    en: {
        "addCartItem.invalid": "productId and a positive integer quantity are required.",
        "session.tokenRequired": "A Bearer session token is required.",
        "session.noLiveSession": "No live session answers this token.",
        "session.noHttpRequest": "GraphQL context carries no HTTP request.",
        "session.noActor": "No actor on a guarded request.",
    },
})
