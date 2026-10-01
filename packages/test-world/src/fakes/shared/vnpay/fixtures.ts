/**
 * VNPAY fixtures: the response codes of VNPAY-PAY 2.1.0 and the static bodies the fake answers. Typed objects, not JSON
 * files, because tsc does not copy JSON into `dist`.
 */

/** `vnp_ResponseCode` of a payment result (return URL and IPN), with the documented meaning. */
export const VNPAY_RESPONSE_CODES = {
    "00": "Giao dich thanh cong",
    "07": "Tru tien thanh cong, giao dich bi nghi ngo",
    "09": "The/Tai khoan chua dang ky dich vu InternetBanking",
    "10": "Xac thuc thong tin the/tai khoan khong dung qua 3 lan",
    "11": "Da het han cho thanh toan",
    "12": "The/Tai khoan bi khoa",
    "13": "Nhap sai mat khau xac thuc giao dich (OTP)",
    "24": "Khach hang huy giao dich",
    "51": "Tai khoan khong du so du",
    "65": "Tai khoan vuot qua han muc giao dich trong ngay",
    "75": "Ngan hang thanh toan dang bao tri",
    "79": "Nhap sai mat khau thanh toan qua so lan quy dinh",
    "99": "Cac loi khac",
} as const

/** `vnp_TransactionStatus`: success 00, pending 01, failed 02, reversed 04. */
export const VNPAY_TRANSACTION_STATUS = { success: "00", pending: "01", failed: "02", reversed: "04" } as const

/** The IPN answers of the merchant (`RspCode`), as documented. */
export const VNPAY_IPN_ANSWERS = {
    confirmed: { RspCode: "00", Message: "Confirm Success" },
    orderNotFound: { RspCode: "01", Message: "Order not found" },
    alreadyConfirmed: { RspCode: "02", Message: "Order already confirmed" },
    invalidAmount: { RspCode: "04", Message: "Invalid amount" },
    invalidSignature: { RspCode: "97", Message: "Invalid signature" },
    unknown: { RspCode: "99", Message: "Unknown error" },
} as const

/** The answer codes of the merchant web api (querydr, refund). */
export const VNPAY_API_CODES = {
    ok: { code: "00", message: "Success" },
    malformed: { code: "03", message: "Input data required" },
    merchantInvalid: { code: "02", message: "Merchant invalid" },
    orderNotFound: { code: "91", message: "Unable to find the transaction" },
    invalidAmount: { code: "04", message: "Invalid amount" },
    duplicated: { code: "94", message: "Duplicated refund request" },
    invalidSignature: { code: "97", message: "Checksum failed" },
    unknown: { code: "99", message: "Unknown error" },
} as const

/** A JSON error body of the merchant web api (querydr, refund); VNPAY answers these unsigned. */
export const vnpayApiError = (kind: keyof typeof VNPAY_API_CODES): { readonly vnp_ResponseCode: string; readonly vnp_Message: string } => ({
    vnp_ResponseCode: VNPAY_API_CODES[kind].code,
    vnp_Message: VNPAY_API_CODES[kind].message,
})

/** The error page the fake shows for a payment URL with a wrong hash. */
export const VNPAY_INVALID_SIGNATURE_PAGE = "<html><body><h1>Invalid signature</h1></body></html>"
