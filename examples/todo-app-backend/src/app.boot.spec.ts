import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PostgresModule } from './modules/integrations/postgres';
import {
  InvalidCredentialsException,
  SessionModule,
  SessionNotFoundException,
  SessionRecord,
  SessionRepository,
} from './modules/domain/session';
import {
  TaskForbiddenException,
  TaskModule,
  TaskNotFoundException,
  TaskRecord,
  TaskRepository,
  TaskTitleRequiredException,
} from './modules/domain/task';
import { KeycloakClient, KeycloakInvalidCredentialsException, KeycloakModule, KeycloakSignInResult } from './modules/integrations/keycloak';

const DEMO_EMAIL = 'demo@todo.dev';
const DEMO_PASSWORD = 'todo-demo-pass';
const DEMO_SUBJECT = 'demo-subject';

/**
 * Stands in for the real Keycloak direct access grant round-trip: this is the fake boundary step 6 asks
 * for, so the boot test can drive the whole route sequence without a live Keycloak. It does not extend
 * KeycloakClient - a subclass with its own zero-argument constructor still inherits its parent's
 * @Injectable design:paramtypes metadata through the prototype chain, which would make Nest try to
 * resolve AppConfigService for a class that no longer needs it.
 */
@Injectable()
class FakeKeycloakClient {
  async signIn(email: string, password: string): Promise<KeycloakSignInResult> {
    if (email.toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      throw new KeycloakInvalidCredentialsException();
    }
    return { subject: DEMO_SUBJECT };
  }

  async notifySignOut(): Promise<void> {
    // Best-effort in production; a no-op here is exactly as observable.
  }
}

class FakeSessionRepository {
  private readonly byToken = new Map<string, SessionRecord>();

  tBegin(email: string): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new InvalidCredentialsException();
    }
  }

  async tAccept(personId: string): Promise<SessionRecord> {
    const record = new SessionRecord(`token-${this.byToken.size + 1}`, personId, new Date(), new Date(Date.now() + 86_400_000));
    this.byToken.set(record.token, record);
    return record;
  }

  tRefuse(): void {}

  async tRevoke(token: string): Promise<void> {
    this.byToken.delete(token);
  }

  async findActive(token: string): Promise<SessionRecord> {
    const record = this.byToken.get(token);
    if (!record) {
      throw new SessionNotFoundException();
    }
    return record;
  }
}

class FakeTaskRepository {
  private readonly byId = new Map<string, TaskRecord>();
  private seq = 0;

  async create(owner: string, title: string): Promise<TaskRecord> {
    const trimmed = title.trim();
    if (!trimmed) {
      throw new TaskTitleRequiredException();
    }
    const record = new TaskRecord(`task-${++this.seq}`, owner, trimmed, false, null);
    this.byId.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<TaskRecord> {
    const record = this.byId.get(id);
    if (!record) {
      throw new TaskNotFoundException();
    }
    return record;
  }

  async listOwnedBy(owner: string): Promise<TaskRecord[]> {
    return [...this.byId.values()].filter(record => record.owner === owner);
  }

  private assertOwner(record: TaskRecord, actorId: string): void {
    if (record.owner !== actorId) {
      throw new TaskForbiddenException();
    }
  }

  async complete(id: string, actorId: string): Promise<TaskRecord> {
    const record = await this.findById(id);
    this.assertOwner(record, actorId);
    if (!record.complete) {
      record.complete = true;
      record.completedAt = new Date();
    }
    return record;
  }

  async reopen(id: string, actorId: string): Promise<TaskRecord> {
    const record = await this.findById(id);
    this.assertOwner(record, actorId);
    record.complete = false;
    record.completedAt = null;
    return record;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const record = await this.findById(id);
    this.assertOwner(record, actorId);
    this.byId.delete(id);
  }
}

@Module({ providers: [{ provide: KeycloakClient, useClass: FakeKeycloakClient }], exports: [KeycloakClient] })
class FakeKeycloakModule {}

@Module({ providers: [{ provide: SessionRepository, useClass: FakeSessionRepository }], exports: [SessionRepository] })
class FakeSessionModule {}

@Module({ providers: [{ provide: TaskRepository, useClass: FakeTaskRepository }], exports: [TaskRepository] })
class FakeTaskModule {}

@Module({})
class FakePostgresModule {}

/**
 * fr.task.create/complete/reopen/delete/list plus br.login.password.sign-in and fr.login.sign-out, driven
 * end to end through the real Nest app - routing, controllers, use cases - against fakes at exactly the
 * two boundaries this example cannot prove in a unit test process: Keycloak and Postgres. This is the same
 * route sequence the live proof drives against the real stack.
 */
describe('todo-app-backend boot', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(PostgresModule)
      .useModule(FakePostgresModule)
      .overrideModule(KeycloakModule)
      .useModule(FakeKeycloakModule)
      .overrideModule(SessionModule)
      .useModule(FakeSessionModule)
      .overrideModule(TaskModule)
      .useModule(FakeTaskModule)
      .compile();
    app = moduleRef.createNestApplication();
    app.enableCors({ origin: 'http://localhost:3000' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses sign-in with the wrong password and with an unknown email identically', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: DEMO_EMAIL, password: 'not-it' });
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: 'nobody@todo.dev', password: 'anything' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('drives sign-in, the full task lifecycle, and sign-out through the real routes', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(signIn.status).toBe(201);
    const token = signIn.body.sessionToken as string;
    expect(token).toEqual(expect.any(String));

    const create = await request(app.getHttpServer())
      .post('/tasks')
      .set('x-session-token', token)
      .send({ title: 'Prove the boot path' });
    expect(create.status).toBe(201);
    const taskId = create.body.taskId as string;

    const list1 = await request(app.getHttpServer()).get('/tasks').set('x-session-token', token);
    expect(list1.status).toBe(200);
    expect(list1.body.tasks).toHaveLength(1);
    expect(list1.body.tasks[0].complete).toBe(false);

    const complete1 = await request(app.getHttpServer()).post(`/tasks/${taskId}/complete`).set('x-session-token', token);
    expect(complete1.status).toBe(201);
    expect(complete1.body.complete).toBe(true);

    const complete2 = await request(app.getHttpServer()).post(`/tasks/${taskId}/complete`).set('x-session-token', token);
    expect(complete2.status).toBe(201);
    expect(complete2.body.complete).toBe(true);

    const reopen = await request(app.getHttpServer()).post(`/tasks/${taskId}/reopen`).set('x-session-token', token);
    expect(reopen.status).toBe(201);
    expect(reopen.body.complete).toBe(false);

    const del = await request(app.getHttpServer()).delete(`/tasks/${taskId}`).set('x-session-token', token);
    expect(del.status).toBe(200);

    const list2 = await request(app.getHttpServer()).get('/tasks').set('x-session-token', token);
    expect(list2.status).toBe(200);
    expect(list2.body.tasks).toHaveLength(0);

    const signOut = await request(app.getHttpServer())
      .post('/auth/sign-out')
      .send({ sessionToken: token });
    expect(signOut.status).toBe(201);
    expect(signOut.body.signedOut).toBe(true);

    const afterSignOut = await request(app.getHttpServer()).get('/tasks').set('x-session-token', token);
    expect(afterSignOut.status).toBe(401);
  });

  it('answers a cross-origin preflight with Access-Control-Allow-Origin for http://localhost:3000', async () => {
    const response = await request(app.getHttpServer())
      .options('/tasks')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
