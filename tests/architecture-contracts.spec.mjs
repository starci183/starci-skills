import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkArchitecture } from '../checks/architecture.mjs';
import { loadArchitectureConfig } from '../checks/architecture/config.mjs';
import { checkBackendContracts, PUBLIC_CONTRACT_RULE_ID, READONLY_BOUNDARY_RULE_ID } from '../checks/architecture/contracts.mjs';
import { buildTypeScriptContext } from '../checks/architecture/typescript.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function writeFiles(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function fixture(t, files, { owners = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-architecture-contracts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFiles(root, {
    'architecture.json': `${JSON.stringify({
      schema: 'starci/architecture-config@1',
      kinds: ['backend'],
      tsconfig: 'tsconfig.json',
      ...(owners ? { owners: [{ id: 'feature:orders', root: 'src/features/orders', entry: 'src/features/orders/index.ts' }] } : {}),
    }, null, 2)}\n`,
    'package.json': '{"private":true}',
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
      experimentalDecorators: true, strict: true, skipLibCheck: true, noEmit: true }, include: ['src/**/*'] }),
    'node_modules/@nestjs/common/package.json': '{"name":"@nestjs/common","types":"index.d.ts"}',
    'node_modules/@nestjs/common/index.d.ts': 'export declare function Controller():ClassDecorator; export declare function Inject(token:unknown):ParameterDecorator & PropertyDecorator; export declare function Injectable():ClassDecorator; export declare function Module(metadata:unknown):ClassDecorator;',
    'node_modules/@nestjs/cqrs/package.json': '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    'node_modules/@nestjs/cqrs/index.d.ts': 'export declare function CommandHandler(message:unknown):ClassDecorator; export declare function QueryHandler(message:unknown):ClassDecorator;',
    'node_modules/@nestjs/graphql/package.json': '{"name":"@nestjs/graphql","types":"index.d.ts"}',
    'node_modules/@nestjs/graphql/index.d.ts': 'export declare function Resolver():ClassDecorator;',
    ...files,
  });
  return root;
}

function check(root) {
  const config = loadArchitectureConfig(root, 'architecture.json');
  const context = buildTypeScriptContext(config, ts);
  assert.deepEqual(context.errors, [], JSON.stringify(context.errors, null, 2));
  return checkBackendContracts(config, context);
}

test('accepts named callable contracts, inherited execute contracts, readonly injection, and readonly messages', t => {
  const root = fixture(t, {
    'src/features/orders/index.ts': `
export { CreateOrderCommand } from './application/create-order.command';
export { CreateOrderHandler } from './application/create-order.handler';
export { CreateOrderUseCase } from './application/create-order.use-case';
export { FindOrdersUseCase } from './application/find-orders.use-case';
export type { OrderPort } from './application/order.port';
export { createOrdersModule } from './orders.module-definition';
`,
    'src/features/orders/application/contracts.ts': `
export interface CreateOrderParams { readonly sku:string }
export interface CreateOrderResult { readonly id:string }
export interface FindOrdersParams { readonly accountId:string }
export interface FindOrdersResult { readonly ids:ReadonlyArray<string> }
`,
    'src/features/orders/application/repository.ts': 'export interface OrderRepository { save(params:import("./contracts").CreateOrderParams):Promise<import("./contracts").CreateOrderResult> }',
    'src/features/orders/application/create-order.use-case.ts': `
import { Injectable } from '@nestjs/common';
import type { CreateOrderParams,CreateOrderResult } from './contracts';
import type { OrderRepository } from './repository';
@Injectable() export class CreateOrderUseCase {
  private readonly repository:OrderRepository;
  constructor(repository:OrderRepository){this.repository=repository}
  execute(params:CreateOrderParams):Promise<CreateOrderResult>{return this.repository.save(params)}
}
`,
    'src/features/orders/application/find-orders.use-case.ts': `
import type { FindOrdersParams,FindOrdersResult } from './contracts';
class BaseUseCase<P,R>{ execute(_params:P):Promise<R>{throw new Error('abstract behavior')} }
export class FindOrdersUseCase extends BaseUseCase<FindOrdersParams,FindOrdersResult>{}
`,
    'src/features/orders/application/order.port.ts': `
import type { FindOrdersParams,FindOrdersResult } from './contracts';
export interface OrderPort { find(params:FindOrdersParams):Promise<FindOrdersResult> }
`,
    'src/features/orders/application/create-order.command.ts': `
export class CreateOrderCommand { constructor(public readonly sku:string){} }
`,
    'src/features/orders/application/create-order.handler.ts': `
import { CommandHandler } from '@nestjs/cqrs';
import { CreateOrderCommand } from './create-order.command';
import { CreateOrderUseCase } from './create-order.use-case';
import type { CreateOrderResult } from './contracts';
@CommandHandler(CreateOrderCommand) export class CreateOrderHandler {
  constructor(private readonly useCase:CreateOrderUseCase){}
  execute(command:CreateOrderCommand):Promise<CreateOrderResult>{return this.useCase.execute(command)}
}
`,
    'src/features/orders/orders.module-definition.ts': `
export const createOrdersModule=(options:{endpoint:string})=>({module:'orders',options});
`,
  });
  const result = check(root);
  assert.deepEqual(result.violations, [], JSON.stringify(result, null, 2));
  assert.equal(result.coverage.publicContracts.status, 'checked');
  assert.ok(result.coverage.publicContracts.callableSignatures >= 4, JSON.stringify(result.coverage));
  assert.deepEqual(result.coverage.readonlyBoundaries, { status: 'checked', injectedClasses: 2, messages: 1 });
  const integrated = checkArchitecture({ repositoryRoot: root, configFile: 'architecture.json', injectedTypeScript: ts });
  assert.deepEqual(integrated.coverage.backendContractTypeForm, result.coverage);
  assert.ok(integrated.coverage.checkedRuleIds.includes(PUBLIC_CONTRACT_RULE_ID));
  assert.ok(integrated.coverage.checkedRuleIds.includes(READONLY_BOUNDARY_RULE_ID));
});

test('rejects inline or inferred public contracts and mutable dependency or message fields without treating DTOs as messages', t => {
  const root = fixture(t, {
    'src/features/orders/index.ts': `
export { BadCapability } from './application/bad.service';
export { InlineInheritedUseCase } from './application/inline-inherited.use-case';
export { MutableAssignedService, ValidAssignedService } from './application/injection.service';
export { ChangeOrderCommand } from './application/change-order.command';
export { ChangeOrderHandler } from './application/change-order.handler';
export { MutableInput } from './transport/http/mutable.input';
`,
    'src/features/orders/application/bad.service.ts': `
export class BadCapability {
  run(input:{readonly value:string}) { return {value:input.value} }
  static build(input:{readonly value:string}) {return input}
  get transform(){return (input:{readonly value:string})=>({value:input.value})}
}
`,
    'src/features/orders/application/inline-inherited.use-case.ts': `
class BaseUseCase<P,R>{ execute(_params:P):Promise<R>{throw new Error('base')} }
export class InlineInheritedUseCase extends BaseUseCase<{readonly id:string},{readonly ok:boolean}>{}
`,
    'src/features/orders/application/injection.service.ts': `
import { Injectable } from '@nestjs/common';
class Repository{}
@Injectable() export class MutableAssignedService { private repository:Repository; constructor(repository:Repository){this.repository=repository} }
@Injectable() export class ValidAssignedService { private readonly repository:Repository; constructor(repository:Repository){this.repository=repository} }
`,
    'src/features/orders/application/change-order.command.ts': `
export class ChangeOrderCommand { constructor(public id:string){} }
`,
    'src/features/orders/application/change-order.handler.ts': `
import { CommandHandler } from '@nestjs/cqrs'; import { ChangeOrderCommand } from './change-order.command';
@CommandHandler(ChangeOrderCommand) export class ChangeOrderHandler { execute(command:ChangeOrderCommand):Promise<void>{void command;return Promise.resolve()} }
`,
    'src/features/orders/transport/http/mutable.input.ts': 'export class MutableInput { value!:string }',
  });
  const result = check(root);
  const contracts = result.violations.filter(item => item.ruleId === PUBLIC_CONTRACT_RULE_ID);
  const readonly = result.violations.filter(item => item.ruleId === READONLY_BOUNDARY_RULE_ID);
  assert.ok(contracts.some(item => /inline object\/union input/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(contracts.some(item => /explicit public output/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(contracts.some(item => /BadCapability\.build/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(contracts.some(item => /BadCapability\.transform/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(contracts.filter(item => /InlineInheritedUseCase/.test(item.message)).length >= 2, JSON.stringify(result, null, 2));
  assert.ok(readonly.some(item => item.path.endsWith('/injection.service.ts') && /repository/.test(item.message)), JSON.stringify(result, null, 2));
  assert.ok(readonly.some(item => item.path.endsWith('/change-order.command.ts') && /Message field id/.test(item.message)), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.path.endsWith('/mutable.input.ts')), false, JSON.stringify(result, null, 2));
  assert.equal(result.coverage.publicContracts.status, 'checked');
  assert.equal(result.coverage.readonlyBoundaries.status, 'checked');
});

test('fails coverage closed for undeclared owners and constructed or dynamically stored dependency/message identity', t => {
  const root = fixture(t, {
    'src/features/orders/index.ts': 'export { HiddenService } from "./application/hidden.service";',
    'src/features/orders/application/hidden.service.ts': `
import { Injectable } from '@nestjs/common';
const make=()=>Injectable; const Wrapped=make(); class Repository{}
@Wrapped() export class HiddenService { constructor(repository:Repository){Object.assign(this,{repository})} }
@Injectable() export class StoredService { constructor(repository:Repository){Object.assign(this,{repository})} }
`,
    'src/features/orders/application/object-wrapped.service.ts': `
import { Injectable } from '@nestjs/common'; const Nest={Injectable}; class Repository{}
@Nest.Injectable() export class ObjectWrappedService { constructor(private repository:Repository){} }
`,
  }, { owners: false });
  const result = check(root);
  assert.equal(result.coverage.publicContracts.status, 'unavailable');
  assert.ok(result.coverage.publicContracts.details.some(item => /does not declare owners/.test(item)));
  assert.equal(result.coverage.readonlyBoundaries.status, 'unavailable');
  assert.ok(result.coverage.readonlyBoundaries.details.filter(item => /constructed Injectable/.test(item)).length >= 2, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.readonlyBoundaries.details.some(item => /unsupported instance assignment/.test(item)), JSON.stringify(result, null, 2));
});

test('does not certify public contracts when an applicable backend source is outside declared owner roots', t => {
  const root = fixture(t, {
    'src/features/orders/index.ts': 'export { OrdersCapability } from "./application/orders.service";',
    'src/features/orders/application/orders.service.ts': 'export class OrdersCapability { count():number{return 0} }',
    'src/modules/catalog/catalog.service.ts': 'export class CatalogCapability { find(id:string):string{return id} }',
  });
  const result = check(root);
  assert.equal(result.coverage.publicContracts.status, 'unavailable');
  assert.ok(result.coverage.publicContracts.details.some(item => /src\/modules\/catalog\/catalog\.service\.ts is outside every declared owner root/.test(item)),
    JSON.stringify(result, null, 2));
  assert.equal(result.violations.length, 0, JSON.stringify(result, null, 2));
});

test('handles optional contracts while failing closed on unknown types, dynamic storage, aliases, and class expressions', t => {
  const root = fixture(t, {
    'src/features/orders/index.ts': `
export { AnyCapability, OptionalCapability } from './application/contracts.service';
export { AliasStorage, DynamicStorage, MutableAliasStorage } from './application/storage.service';
export { CoalescedStorage, DefinePropertyStorage, DestructureStorage, IdentityStorage, PrimitiveProjection, ObjectAssignAlias, ReflectStorage } from './application/derived-storage.service';
export { ExpressionService } from './application/expression.service';
export { UpdateOrderCommand, UpdateOrderHandler } from './application/update-order.handler';
`,
    'src/features/orders/application/contracts.service.ts': `
export interface NamedParams {readonly id:string} export interface OtherParams {readonly key:string}
export class AnyCapability { run(input:any):unknown{return input} }
export class OptionalCapability {
  run(input?:NamedParams):number{return input?1:0}
  count(value?:number):number{return value??0}
  bad(input?:NamedParams|OtherParams):number{return input?1:0}
}
`,
    'src/features/orders/application/storage.service.ts': `
import { Injectable } from '@nestjs/common'; class Repository{}
@Injectable() export class AliasStorage {private readonly repository:Repository;constructor(repository:Repository){const self=this;self.repository=repository}}
@Injectable() export class DynamicStorage {constructor(repository:Repository){const key='repository';this[key]=repository}}
@Injectable() export class MutableAliasStorage {constructor(repository:Repository){let self=this;self.repository=repository}}
`,
    'src/features/orders/application/derived-storage.service.ts': `
import { Injectable } from '@nestjs/common';
class Repository { readonly timeoutMs=100 }
const identity=<T>(value:T):T=>value;
@Injectable() export class CoalescedStorage {private repository:Repository;constructor(repository:Repository,fallback:Repository){this.repository=repository??fallback}}
@Injectable() export class IdentityStorage {private repository:Repository;constructor(repository:Repository){const alias=repository;this.repository=identity(alias)}}
@Injectable() export class PrimitiveProjection {private timeoutMs:number;constructor(repository:Repository){this.timeoutMs=repository.timeoutMs}}
@Injectable() export class ObjectAssignAlias {constructor(repository:Repository){const self=this;Object.assign(self,{repository})}}
@Injectable() export class ReflectStorage {private repository!:Repository;constructor(repository:Repository){Reflect.set(this,'repository',repository)}}
@Injectable() export class DefinePropertyStorage {private repository!:Repository;constructor(repository:Repository){Object.defineProperty(this,'repository',{value:repository})}}
@Injectable() export class DestructureStorage {private repository!:Repository;constructor(repository:Repository){({repository:this.repository}={repository})}}
`,
    'src/features/orders/application/expression.service.ts': `
import { Injectable } from '@nestjs/common'; import type { NamedParams } from './contracts.service'; class Repository{}
export const ExpressionService=@Injectable() class {constructor(private repository:Repository){} run(input:NamedParams):number{return input.id.length}}
`,
    'src/features/orders/application/update-order.handler.ts': `
import { CommandHandler } from '@nestjs/cqrs';
export class UpdateOrderCommand {constructor(input:{id:string}){const self=this;Object.assign(self,input)}}
@CommandHandler(UpdateOrderCommand) export class UpdateOrderHandler {execute(_command:UpdateOrderCommand):void{}}
`,
  });
  const result = check(root);
  assert.equal(result.coverage.publicContracts.status, 'unavailable', JSON.stringify(result, null, 2));
  assert.ok(result.coverage.publicContracts.details.some(item => /AnyCapability\.run/.test(item)), JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === PUBLIC_CONTRACT_RULE_ID && /OptionalCapability\.bad/.test(item.message)), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.ruleId === PUBLIC_CONTRACT_RULE_ID && /OptionalCapability\.(?:run|count)/.test(item.message)), false,
    JSON.stringify(result, null, 2));
  assert.equal(result.coverage.readonlyBoundaries.status, 'unavailable', JSON.stringify(result, null, 2));
  assert.ok(result.coverage.readonlyBoundaries.details.filter(item => /unsupported instance assignment/.test(item)).length >= 2,
    JSON.stringify(result, null, 2));
  assert.ok(result.coverage.readonlyBoundaries.details.filter(item => item.includes('derived-storage.service.ts')
    && /unsupported instance assignment/.test(item)).length >= 4, JSON.stringify(result, null, 2));
  assert.ok(result.coverage.readonlyBoundaries.details.some(item => item.includes('update-order.handler.ts')
    && /unsupported instance mutation/.test(item)), JSON.stringify(result, null, 2));
  const derivedStorageLines = new Set(result.violations.filter(item => item.ruleId === READONLY_BOUNDARY_RULE_ID
    && item.path.endsWith('/derived-storage.service.ts') && /repository/.test(item.message)).map(item => item.line));
  assert.ok(derivedStorageLines.size >= 2, JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.ruleId === READONLY_BOUNDARY_RULE_ID
    && item.path.endsWith('/derived-storage.service.ts') && /timeoutMs/.test(item.message)), false, JSON.stringify(result, null, 2));
  assert.ok(result.violations.some(item => item.ruleId === READONLY_BOUNDARY_RULE_ID
    && item.path.endsWith('/expression.service.ts') && /repository/.test(item.message)), JSON.stringify(result, null, 2));
  assert.equal(result.violations.some(item => item.ruleId === READONLY_BOUNDARY_RULE_ID
    && item.path.endsWith('/storage.service.ts') && /AliasStorage/.test(item.message)), false, JSON.stringify(result, null, 2));
});

test('excludes ambient library callable members from the public contract walk but still checks a repository-declared any', t => {
  const root = fixture(t, {
    // No strictNullChecks: matches the reference project's tsconfig and is what lets the ambient
    // ErrorConstructor.prepareStackTrace/captureStackTrace members resolve to plain callables at all.
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
      experimentalDecorators: true, skipLibCheck: true, noEmit: true }, include: ['src/**/*'] }),
    'node_modules/@types/node/package.json': '{"name":"@types/node","types":"index.d.ts"}',
    'node_modules/@types/node/index.d.ts': `
declare global {
  interface ErrorConstructor {
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace?: (err: Error, stackTraces: unknown[]) => any;
    stackTraceLimit: number;
  }
}
export {};
`,
    'src/features/orders/index.ts': `
export { NotOwnerException } from './application/not-owner.exception';
export { LeakyException } from './application/leaky.exception';
`,
    'src/features/orders/application/abstract.exception.ts': `
export abstract class AbstractException extends Error {
  constructor(message:string){super(message)}
}
`,
    'src/features/orders/application/not-owner.exception.ts': `
import { AbstractException } from './abstract.exception';
export class NotOwnerException extends AbstractException {
  constructor(){super('not owner')}
  reason():string{return 'not-owner'}
}
`,
    'src/features/orders/application/leaky.exception.ts': `
import { AbstractException } from './abstract.exception';
export class LeakyException extends AbstractException {
  constructor(){super('leaky')}
  leak():any{return undefined}
}
`,
  });
  const result = check(root);
  assert.equal(result.violations.some(item => item.path.endsWith('/not-owner.exception.ts')
    || item.path.endsWith('/leaky.exception.ts')), false, JSON.stringify(result, null, 2));
  assert.equal((result.coverage.publicContracts.details ?? []).some(item => /prepareStackTrace|captureStackTrace/.test(item)), false,
    JSON.stringify(result, null, 2));
  assert.equal(result.coverage.publicContracts.status, 'unavailable', JSON.stringify(result, null, 2));
  assert.ok((result.coverage.publicContracts.details ?? []).some(item => /LeakyException\.leak/.test(item)), JSON.stringify(result, null, 2));
});
