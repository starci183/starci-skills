// proves: BE_TRANSPORT_SHAPE@lite
// proves: BE_TRANSPORT_SHAPE@full
import test from 'node:test';
import { appDeclaration } from './fixtures/app.mjs';
import { at, BE_DECLARATION, ruleTester, TYPED_ROOT } from './fixtures/typed/tester.mjs';
import { hfsFromDeclaration } from './lib/hfs.mjs';
import { emInjectionSlots } from './connections.mjs';
import {
  doorLivesInFeatures,
  noCapabilityImportsFeatures,
  noGraphqlJson,
  noResponseEnvelope,
  restDoorNeedsAReason,
  transportIsThin,
} from './transport.mjs';

const domain = at('src/modules/domain/order/order.service.ts');
const resolver = at('src/features/api/plan/transport/graphql/place-order.resolver.ts');
const controller = at('src/features/api/plan/transport/http/pay.controller.ts');
const controllerImport = 'import { Controller, Get } from "@nestjs/common";';
const controllerBody = '@Controller("orders") export class C { @Get() list() { return 1; } }';
const busImport = 'import { CommandBus } from "@nestjs/cqrs"; import { Mutation, Resolver } from "@nestjs/graphql";';
const thinDoor = '@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()); } }';

for (const edition of ['lite', 'full']) {
  test(`R88 ${edition} accepts valid doors and rejects capability transport declarations`, () => {
    const hfs = hfsFromDeclaration({ ...appDeclaration('be', BE_DECLARATION), edition }, TYPED_ROOT);
    const tester = ruleTester({ root: TYPED_ROOT, hfs });
    tester.run('door-lives-in-features', doorLivesInFeatures, {
      valid: [{ filename: controller, code: controllerImport + controllerBody }],
      invalid: [{ filename: domain, code: controllerImport + controllerBody, errors: [{ messageId: 'wrongSlot' }] }],
    });
    tester.run('no-capability-imports-features', noCapabilityImportsFeatures, {
      valid: [{ filename: resolver, code: 'import { x } from "@modules/domain/order"; export { x };' }],
      invalid: [{ filename: domain, code: 'import { x } from "@features/api/plan"; export { x };', errors: [{ messageId: 'reversed' }] }],
    });
    tester.run('transport-is-thin', transportIsThin, {
      valid: [{ filename: resolver, code: busImport + thinDoor }],
      invalid: [{ filename: resolver, code: busImport + '@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place() { return 1; } }', errors: [{ messageId: 'none' }] }],
    });
    tester.run('no-response-envelope', noResponseEnvelope, {
      valid: [{ filename: resolver, code: 'export class R { place() { return { id: 1 }; } }' }],
      invalid: [{ filename: resolver, code: 'export class R { place() { return { success: true, data: 1 }; } }', errors: [{ messageId: 'literal' }] }],
    });
    tester.run('no-graphql-json', noGraphqlJson, {
      valid: [{ filename: resolver, code: 'import { GraphQLDateTime } from "graphql-scalars"; export const scalar = GraphQLDateTime;' }],
      invalid: [{ filename: resolver, code: 'import GraphQLJSON from "graphql-type-json"; export const scalar = GraphQLJSON;', errors: [{ messageId: 'scalar' }] }],
    });
    tester.run('rest-door-needs-a-reason', restDoorNeedsAReason, {
      valid: [{ filename: controller, code: controllerImport + 'import { Public, PublicReason } from "@modules/domain/identity"; @Controller("health") export class C { @Public({ reason: PublicReason.Health }) @Get() live() { return 1; } }' }],
      invalid: [{ filename: controller, code: controllerImport + controllerBody, errors: [{ messageId: 'unjustified' }] }],
    });
    const manager = 'import { EntityManager } from "typeorm"; class H { constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {} }';
    tester.run('em-injection-slots', emInjectionSlots, {
      valid: [{ filename: domain, code: manager }],
      invalid: [{ filename: resolver, code: manager, errors: [{ messageId: 'slot' }] }],
    });
  });
}
