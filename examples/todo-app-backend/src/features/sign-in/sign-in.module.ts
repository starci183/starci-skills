import { Module } from '@nestjs/common';
import { SessionModule } from '../../modules/domain/session';
import { SignInUseCase } from './application/sign-in.use-case';
import { SignInController } from './transport/http/sign-in.controller';

@Module({
  imports: [SessionModule],
  controllers: [SignInController],
  providers: [SignInUseCase],
})
export class SignInModule {}
