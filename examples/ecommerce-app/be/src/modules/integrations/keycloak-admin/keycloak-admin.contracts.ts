/** A member as the identity provider names them. */
export interface KeycloakMember {
    /** The stable subject id of the member. */
    readonly id: string
    /** The email of the member. */
    readonly email: string
    /** The name the member goes by. */
    readonly displayName: string
}
