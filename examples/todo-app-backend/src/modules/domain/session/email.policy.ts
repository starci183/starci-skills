const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True when the text has the shape of an email address; the identity provider decides whether it is an account. */
export const isPlausibleEmail = (email: string): boolean => EMAIL_PATTERN.test(email)
