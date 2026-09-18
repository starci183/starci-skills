const CURRENCY_LOCALE: Readonly<Record<string, string>> = {
  USD: 'en-US',
  EUR: 'de-DE',
  VND: 'vi-VN',
};

/** Format a minor-unit (cents) amount for display; unknown currency codes fall back to a tagged number. */
export const formatPrice = (amountCents: number, currency: string): string => {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
};
