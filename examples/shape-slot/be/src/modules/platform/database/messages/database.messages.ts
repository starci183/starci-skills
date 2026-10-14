import type { MessageBundle } from "@modules/platform/i18n"

/** Readiness failures describe availability without disclosing database connection details. */
export const DATABASE_MESSAGES: MessageBundle = {
    vi: { "errors.DATABASE_REQUIRED_UNAVAILABLE": "Cơ sở dữ liệu bắt buộc chưa sẵn sàng." },
    en: { "errors.DATABASE_REQUIRED_UNAVAILABLE": "The required database is not ready." },
}
