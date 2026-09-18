import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { POSTGRESQL_PRIMARY, ProductEntity } from '../../platform/databases/postgresql/primary';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity], POSTGRESQL_PRIMARY)],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
