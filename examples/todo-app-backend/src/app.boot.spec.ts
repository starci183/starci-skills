import { Global, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import request from 'supertest';
import { TodoGraphqlModule } from './features/todo/graphql/graphql.module';
import { PlatformEventsModule } from './modules/platform/events';
import {
  InvalidCredentialsException,
  SessionNotFoundException,
  SessionRecord,
  SessionService,
  SignInHandler,
  SignOutHandler,
} from './modules/bussiness/session';
import {
  CompleteTaskHandler,
  CreateTaskHandler,
  DeleteTaskHandler,
  ListTasksHandler,
  ReopenTaskHandler,
  TaskCreationPolicyRegistry,
  TaskForbiddenException,
  TaskNotFoundException,
  TaskRecord,
  TaskService,
  TaskTitleRequiredException,
} from './modules/bussiness/task';
import { KeycloakClient, KeycloakInvalidCredentialsException, KeycloakSignInResult } from './modules/integrations/keycloak';

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

class FakeSessionService {
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
    if (!token) {
      throw new SessionNotFoundException();
    }
    const record = this.byToken.get(token);
    if (!record) {
      throw new SessionNotFoundException();
    }
    return record;
  }
}

class FakeTaskService {
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

  async delete(id: string, actorId: string): Promise<TaskRecord> {
    const record = await this.findById(id);
    this.assertOwner(record, actorId);
    this.byId.delete(id);
    return record;
  }
}

/**
 * Fakes only the Keycloak boundary; SessionService, the real SignIn/SignOutHandler and PlatformEventBus
 * are all real, in-process code - the same boundary choice the former REST-transport boot test made
 * ("fakes at exactly the two boundaries this example cannot prove in a unit test process: Keycloak and
 * Postgres"). `@Global()` so the five GraphQL task resolvers, which never import SessionModule
 * themselves and rely on the app's one global registration (see `session-context.ts`), can still resolve
 * `SessionService` here.
 *
 * WHY THIS TEST BUILDS ITS OWN ROOT MODULE INSTEAD OF `AppModule` + `overrideModule`: NestJS's
 * `TestingModuleBuilder.overrideModule()` matches an import-array entry by strict reference equality
 * against the *entry itself* (`@nestjs/core/scanner.js`'s `getOverrideModuleByModule`), but a dynamic
 * module import (`SessionModule.register(...)`, `TaskModule.register()`, `PostgresqlPrimaryModule
 * .register()`) puts the whole `DynamicModule` object in that slot, not the bare class - so
 * `.overrideModule(SessionModule)` never matches and the *real* module (with its real
 * `TypeOrmModule.forFeature`/`forRootAsync` calls) still loads, which is exactly what produced the
 * "Unable to connect to the database" retries and the missing-repository DI errors this file used to
 * fail with. Composing a small test-only root module out of the real GraphQL transport
 * (`TodoGraphqlModule`, unchanged) plus these two fake capability modules sidesteps that limitation
 * entirely, and is the same shape nivo's own capability specs use (construct the collaborators
 * directly; see `sign-in.service.spec.ts`) rather than booting the full app for a unit boundary test.
 */
@Global()
@Module({
  imports: [CqrsModule, PlatformEventsModule.register()],
  providers: [
    { provide: SessionService, useClass: FakeSessionService },
    { provide: KeycloakClient, useClass: FakeKeycloakClient },
    SignInHandler,
    SignOutHandler,
  ],
  exports: [SessionService],
})
class FakeSessionModule {}

@Module({
  imports: [CqrsModule, PlatformEventsModule.register()],
  providers: [
    { provide: TaskService, useClass: FakeTaskService },
    TaskCreationPolicyRegistry,
    CreateTaskHandler,
    CompleteTaskHandler,
    ReopenTaskHandler,
    DeleteTaskHandler,
    ListTasksHandler,
  ],
  exports: [TaskService, TaskCreationPolicyRegistry],
})
class FakeTaskModule {}

@Module({ imports: [FakeSessionModule, FakeTaskModule, TodoGraphqlModule] })
class TestAppModule {}

/**
 * fr.task.create/complete/reopen/delete/list plus br.login.password.sign-in and fr.login.sign-out, driven
 * end to end through the real GraphQL transport (`TodoGraphqlModule`, unchanged from what `AppModule`
 * composes) and the real CQRS handlers - against fakes at exactly the two boundaries this example cannot
 * prove in a unit test process: Keycloak and Postgres. This is the same route sequence the live proof
 * drives against the real stack, now speaking GraphQL instead of REST.
 */
describe('todo-app-backend boot', () => {
  let app: INestApplication;

  const graphql = (query: string, variables?: Record<string, unknown>, sessionToken?: string) => {
    const req = request(app.getHttpServer()).post('/graphql').send({ query, variables });
    return sessionToken ? req.set('authorization', `Bearer ${sessionToken}`) : req;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.enableCors({ origin: 'http://localhost:3000' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses sign-in with the wrong password and with an unknown email identically', async () => {
    const query = 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }';
    const wrongPassword = await graphql(query, { input: { email: DEMO_EMAIL, password: 'not-it' } });
    const unknownEmail = await graphql(query, { input: { email: 'nobody@todo.dev', password: 'anything' } });

    expect(wrongPassword.status).toBe(200);
    expect(wrongPassword.body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('drives sign-in, the full task lifecycle, and sign-out through the real GraphQL operations', async () => {
    const signIn = await graphql(
      'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }',
      { input: { email: DEMO_EMAIL, password: DEMO_PASSWORD } },
    );
    expect(signIn.body.errors).toBeUndefined();
    const token = signIn.body.data.signIn.sessionToken as string;
    expect(token).toEqual(expect.any(String));

    const create = await graphql(
      'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }',
      { input: { title: 'Prove the boot path' } },
      token,
    );
    expect(create.body.errors).toBeUndefined();
    const taskId = create.body.data.createTask.taskId as string;

    const list1 = await graphql('query { tasks { taskId title complete } }', undefined, token);
    expect(list1.body.data.tasks).toHaveLength(1);
    expect(list1.body.data.tasks[0].complete).toBe(false);

    const complete1 = await graphql(
      'mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }',
      { id: taskId },
      token,
    );
    expect(complete1.body.data.completeTask.complete).toBe(true);

    const complete2 = await graphql(
      'mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }',
      { id: taskId },
      token,
    );
    expect(complete2.body.data.completeTask.complete).toBe(true);

    const reopen = await graphql('mutation ReopenTask($id: ID!) { reopenTask(id: $id) { taskId complete } }', { id: taskId }, token);
    expect(reopen.body.data.reopenTask.complete).toBe(false);

    const del = await graphql('mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }', { id: taskId }, token);
    expect(del.body.data.deleteTask.deleted).toBe(true);

    const list2 = await graphql('query { tasks { taskId title complete } }', undefined, token);
    expect(list2.body.data.tasks).toHaveLength(0);

    const signOut = await graphql(
      'mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }',
      { input: { sessionToken: token } },
    );
    expect(signOut.body.data.signOut.signedOut).toBe(true);

    const afterSignOut = await graphql('query { tasks { taskId title complete } }', undefined, token);
    expect(afterSignOut.body.errors[0].extensions.code).toBe('SESSION_NOT_FOUND');
  });

  it('refuses an unauthenticated tasks query before any data is returned, with no Authorization header at all', async () => {
    const noHeader = await graphql('query { tasks { taskId title complete } }');

    expect(noHeader.body.data == null).toBe(true);
    expect(noHeader.body.errors[0].extensions.code).toBe('SESSION_NOT_FOUND');
  });

  it('refuses a task mutation carrying a malformed Authorization header (no "Bearer " prefix) the same way', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/graphql')
      .set('authorization', 'not-a-bearer-token')
      .send({
        query: 'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId } }',
        variables: { input: { title: 'should never be created' } },
      });

    expect(malformed.body.data == null).toBe(true);
    expect(malformed.body.errors[0].extensions.code).toBe('SESSION_NOT_FOUND');
  });

  it('answers a cross-origin preflight with Access-Control-Allow-Origin for http://localhost:3000', async () => {
    const response = await request(app.getHttpServer())
      .options('/graphql')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
