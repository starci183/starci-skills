import { ArgsType, Field } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"

@ArgsType()
/** The auditLog arguments: an optional action and target filter, honoured for administrators only. */
export class AuditLogArgs {
    /** Only lines of this action. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    action?: string | null

    /** Only lines of this target. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    target?: string | null
}
