import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CollaboratorResponse {
  @Field(() => ID)
  invitationId!: string;

  @Field()
  email!: string;

  @Field()
  role!: string;

  @Field()
  status!: string;

  constructor(invitationId: string, email: string, role: string, status: string) {
    this.invitationId = invitationId;
    this.email = email;
    this.role = role;
    this.status = status;
  }
}
