import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class CreateTaskInput {
  @Field()
  @IsString()
  @MinLength(1)
  title!: string;
}
