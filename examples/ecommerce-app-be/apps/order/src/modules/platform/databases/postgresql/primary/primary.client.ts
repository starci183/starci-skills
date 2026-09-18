import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { POSTGRESQL_PRIMARY } from './constants/connection';

@Injectable()
export class PostgresPrimaryClient {
  constructor(@InjectDataSource(POSTGRESQL_PRIMARY) private readonly dataSource: DataSource) {}

  async ping(): Promise<void> {
    await this.dataSource.query('select 1');
  }
}
