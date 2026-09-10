import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

// Read-only probes against installed reference rules, not a product lint pass.
const root=path.resolve(process.argv[2]??'..');
const require=createRequire(path.join(root,'package.json'));
const {Linter}=require('eslint');
const parser=require('@typescript-eslint/parser');
const {rules}=await import(pathToFileURL(path.join(root,'node_modules/@starci/eslint-canon-be/data-access.mjs')));
const linter=new Linter();
const check=(code)=>linter.verify(code,[{files:['**/*.ts'],languageOptions:{parser},plugins:{probe:{rules}},rules:Object.fromEntries(Object.keys(rules).map(k=>['probe/'+k,'error']))}],{filename:'fixture.ts'}).map(m=>m.ruleId);
const cases=[
 ['undecorated manager','class A { constructor(private m: EntityManager) {} }',['probe/must-inject-entity-manager']],
 ['named manager','class A { constructor(@InjectInstanceEntityManager() private m: EntityManager) {} }',[]],
 ['injected TypeORM repository','class A { constructor(private r: Repository<User>) {} }',['probe/no-injected-repository']],
 ['custom facade is a lint gap','class A { constructor(private r: AccountingRepository) {} }',[]],
 ['outer manager detected','class A { run() { return this.m.transaction(async tx => this.m.save({})); } }',['probe/no-outer-manager-in-transaction']],
 ['isolation overload is a lint gap','class A { run() { return this.m.transaction("SERIALIZABLE", async tx => this.m.save({})); } }',[]],
];
for(const [name,code,expected] of cases){const actual=check(code);assert.deepEqual(actual,expected,name);console.log(JSON.stringify({name,reports:actual}));}
