import {
    Field, InputType 
} from "@nestjs/graphql"
import {
    IsString, MinLength 
} from "class-validator"

@InputType()
/** unsubscribe's argument: the one channel the caller unsubscribes from. */
export class UnsubscribeInput {
  @Field({
      defaultValue: "email" 
  })
  @IsString()
  @MinLength(1)
      channel!: string
}
