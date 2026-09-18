import { Injectable } from '@nestjs/common';

const DEFAULT_SESSION_TTL_DAYS = 30;
const DEFAULT_KEYCLOAK_TOKEN_URL = 'http://localhost:8089/realms/todo/protocol/openid-connect/token';
const DEFAULT_KEYCLOAK_CLIENT_ID = 'todo-api';
// Host port 5440, not the container's internal 5432: this machine already runs starci-postgres on
// host 5432 (see .starcistacks/dev/infra/compose/postgres.yaml and application-stacks.yaml), and the
// api process that reads this default runs on the host, not inside the compose network.
const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5440/todo';
const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

@Injectable()
export class AppConfigService {
  getSessionTtlDays(): number {
    const raw = process.env.TODO_SESSION_TTL_DAYS;
    return raw ? Number(raw) : DEFAULT_SESSION_TTL_DAYS;
  }

  getKeycloakTokenUrl(): string {
    return process.env.KEYCLOAK_TOKEN_URL ?? DEFAULT_KEYCLOAK_TOKEN_URL;
  }

  getKeycloakClientId(): string {
    return process.env.KEYCLOAK_CLIENT_ID ?? DEFAULT_KEYCLOAK_CLIENT_ID;
  }

  getDatabaseUrl(): string {
    return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  }

  getCorsOrigin(): string {
    return process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN;
  }

  getPort(): number {
    const raw = process.env.PORT;
    return raw ? Number(raw) : 3001;
  }
}
