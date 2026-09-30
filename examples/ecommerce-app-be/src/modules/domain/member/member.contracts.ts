/** What reading a member profile needs. */
export interface MemberProfileParams {
    /** The member, by their identity provider subject id. */
    readonly memberId: string
}

/** A member as the shop shows them. */
export interface MemberProfile {
    /** The member id. */
    readonly memberId: string
    /** The email of the member. */
    readonly email: string
    /** The name the member goes by. */
    readonly displayName: string
}
