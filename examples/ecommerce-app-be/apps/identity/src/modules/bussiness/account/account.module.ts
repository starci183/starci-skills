import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonEntity, POSTGRESQL_PRIMARY } from '../../platform/databases/postgresql/primary';
import { AccountService } from './account.service';
import { PasswordPolicy } from './password.policy';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEntity], POSTGRESQL_PRIMARY)],
  providers: [AccountService, PasswordPolicy],
  exports: [AccountService],
})
export class AccountModule {}
