import { InvitationStatus, ShareRole } from "./share.contracts"
import type { StoredInvitationStatus } from "./share.contracts"

/** How many days a pending invitation can still be accepted. */
export const INVITATION_EXPIRY_DAYS = 14

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The address in the one form invitations store and compare it. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** True when the (normalized) text has the shape of an email address. */
export const isWellFormedEmail = (email: string): boolean => EMAIL_PATTERN.test(email)

/** True when the text names a role an invitation can grant. */
export const isShareRole = (role: string): boolean => Object.values<string>(ShareRole).includes(role)

/** The status a stored row reads as at `at`: a pending row past its window reads as expired, everything else as stored. */
export const liveStatusOf = (row: StoredInvitationStatus, at: Date): string =>
    row.status === InvitationStatus.Pending &&
    at.getTime() > row.sentAt.getTime() + INVITATION_EXPIRY_DAYS * MILLISECONDS_PER_DAY
        ? InvitationStatus.Expired
        : row.status
