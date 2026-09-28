import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** One invitation on the task: id, email, role, status. */
export class CollaboratorResponse {
  @Field(() => ID)
      invitationId!: string

  @Field()
      email!: string

  @Field()
      role!: string

  @Field()
      status!: string

  constructor(invitationId: string, email: string, role: string, status: string) {
      this.invitationId = invitationId
      this.email = email
      this.role = role
      this.status = status
  }
}
