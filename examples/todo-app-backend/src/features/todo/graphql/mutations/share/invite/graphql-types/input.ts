import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class InviteInput {
  @Field(() => ID)
  @IsString()
  taskId!: string;

  @Field()
  @IsString()
  @MinLength(1)
  email!: string;

  /** Deliberately not `@IsIn(['viewer', 'editor'])`: br.share.role.permissions is enforced once, by
   * InvitationService (ShareInvalidRoleException), not duplicated at the transport pipe - see
   * scripts/live-proof-share.sh, which exercises that refusal end to end through this exact field. */
  @Field()
  @IsString()
  @MinLength(1)
  role!: string;
}
