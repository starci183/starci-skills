import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresModule, TaskEntity } from '../../integrations/postgres';
import { TaskRepository } from './task.repository';
import { TaskCreationPolicyRegistry } from './creation-policy.registry';
import { CompletionAuthorityRegistry } from './completion-authority.registry';

/**
 * Exports the two seam registries beside TaskRepository so any feature module (a future `plan` or
 * `share` feature among them) can inject TaskCreationPolicyRegistry/CompletionAuthorityRegistry from its
 * own module and register a policy or authority, without importing task's use cases or repository.
 */
@Module({
  imports: [PostgresModule, TypeOrmModule.forFeature([TaskEntity])],
  providers: [TaskRepository, TaskCreationPolicyRegistry, CompletionAuthorityRegistry],
  exports: [TaskRepository, TaskCreationPolicyRegistry, CompletionAuthorityRegistry],
})
export class TaskModule {}
