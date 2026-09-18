import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { PersonRepository } from './person.repository';
import { SessionRepository } from './session.repository';

@Module({
  providers: [PasswordService, PersonRepository, SessionRepository],
  exports: [PasswordService, PersonRepository, SessionRepository],
})
export class SessionModule {}
