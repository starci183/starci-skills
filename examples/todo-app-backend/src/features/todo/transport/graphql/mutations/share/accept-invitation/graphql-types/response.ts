import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The invitation after accept: id, role, status 'accepted'. */
export class AcceptInvitationResponse {
  @Field(() => ID)
      invitationId!: string

  @Field()
      role!: string

  @Field()
      status!: string

  constructor(invitationId: string, role: string, status: string) {
      this.invitationId = invitationId
      this.role = role
      this.status = status
  }
}
