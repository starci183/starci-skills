import {
    createMessageCatalog 
} from "ecommerce-app-be/modules/platform/i18n"

/** The identity feature's user-facing copy: schema descriptions and refusal sentences in Vietnamese and English, read by key. */
export const IDENTITY_MESSAGES = createMessageCatalog({
    vi: {
        "register.description": "Đăng ký một khách mới bằng email và mật khẩu; trả về mã người dùng mới, hoặc EMAIL_TAKEN khi email đã được dùng.",
        "register.invalid": "Cần một email hợp lệ và mật khẩu tối thiểu 8 ký tự.",
        "signIn.description": "Đăng nhập bằng email và mật khẩu; trả về mã phiên để gửi lại dưới dạng \"Authorization: Bearer <token>\".",
        "signIn.invalid": "Cần có email và mật khẩu.",
        "account.description": "Đọc một tài khoản: người dùng và việc dịch vụ đơn hàng có xem họ là người mua hay không.",
        "session.noLiveSession": "Không có phiên nào còn hiệu lực ứng với mã này.",
        "session.tokenRequired": "Cần có sessionToken.",
    },
    en: {
        "register.description": "Register a fresh visitor with an email + password; answers the new person id, or EMAIL_TAKEN for a taken address.",
        "register.invalid": "A plausible email and a password of at least 8 characters are required.",
        "signIn.description": "Sign in with an email + password; returns the session token to send back as \"Authorization: Bearer <token>\".",
        "signIn.invalid": "email and password are required.",
        "account.description": "Read one account: the person and whether the order service reports them a buyer.",
        "session.noLiveSession": "No live session answers this token.",
        "session.tokenRequired": "sessionToken is required.",
    },
})
