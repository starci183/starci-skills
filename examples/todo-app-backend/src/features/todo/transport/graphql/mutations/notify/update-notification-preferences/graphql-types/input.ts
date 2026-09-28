import {
    Field, Int, InputType 
} from "@nestjs/graphql"
import {
    IsBoolean, IsInt, IsOptional, IsString, Min, MinLength 
} from "class-validator"

@InputType()
/** The preference write: channel plus the fields to change - unsubscribed flag and/or digestWindowMinutes. */
export class UpdateNotificationPreferencesInput {
  @Field({
      defaultValue: "email" 
  })
  @IsString()
  @MinLength(1)
      channel!: string

  @Field({
      nullable: true 
  })
  @IsOptional()
  @IsBoolean()
      unsubscribed?: boolean

  @Field(() => Int,
      {
          nullable: true 
      })
  @IsOptional()
  @IsInt()
  @Min(1)
      digestWindowMinutes?: number
}
