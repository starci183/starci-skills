import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the commission codes, Vietnamese and English. */
export const COMMISSION_MESSAGES: MessageBundle = {
    vi: {
        "errors.COMMISSION_SELF_REFERRAL": "Không thể nhận hoa hồng từ chính giao dịch của mình.",
    },
    en: {
        "errors.COMMISSION_SELF_REFERRAL": "A person cannot earn a commission on their own payment.",
    },
}
