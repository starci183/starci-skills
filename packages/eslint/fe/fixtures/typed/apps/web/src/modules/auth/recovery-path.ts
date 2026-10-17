/** Fixture: a pure helper of the auth owner. */
export const recoveryPath = (type: string | null): string => (type === "recovery" ? "/reset-password" : "/")
