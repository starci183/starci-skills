import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/platform/config';
import { PostgresModule } from './modules/integrations/postgres';
import { SignInModule } from './features/sign-in';
import { SignOutModule } from './features/sign-out';
import { CreateTaskModule } from './features/create-task';
import { CompleteTaskModule } from './features/complete-task';
import { ReopenTaskModule } from './features/reopen-task';
import { DeleteTaskModule } from './features/delete-task';
import { ListTasksModule } from './features/list-tasks';

@Module({
  imports: [
    ConfigModule,
    PostgresModule,
    SignInModule,
    SignOutModule,
    CreateTaskModule,
    CompleteTaskModule,
    ReopenTaskModule,
    DeleteTaskModule,
    ListTasksModule,
  ],
})
export class AppModule {}
