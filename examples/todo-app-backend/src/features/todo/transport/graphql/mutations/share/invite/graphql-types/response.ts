import {
    Field, ID, ObjectType 
} from "@nestjs/graphql"

@ObjectType()
/** The created invitation: id, taskId, email, role, status 'pending'. */
export class InviteResponse {
  @Field(() => ID)
      invitationId!: string

  @Field(() => ID)
      taskId!: string

  @Field()
      email!: string

  @Field()
      role!: string

  @Field()
      status!: string

  constructor(invitationId: string, taskId: string, email: string, role: string, status: string) {
      this.invitationId = invitationId
      this.taskId = taskId
      this.email = email
      this.role = role
      this.status = status
  }
}
