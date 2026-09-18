import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RevokeCollaboratorResponse {
  @Field(() => ID)
  invitationId!: string;

  @Field()
  status!: string;

  constructor(invitationId: string, status: string) {
    this.invitationId = invitationId;
    this.status = status;
  }
}
