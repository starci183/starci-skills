// proves: FE_GRAPHQL_CONTRACT@lite FE_GRAPHQL_CONTRACT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { feContractFindings } from '../../scripts/hfs/rules/fe-contract-documents.mjs';

const SCHEMA = `
type Query { product(id: ID!): Product! }
type Mutation { renameProduct(id: ID!, name: String!): Product! }
type Product { id: ID!, name: String! }
`;
const OPERATION = 'fe/apps/web/src/modules/api/graphql/queries/query-product.ts';
const CONTRACT = 'be/contracts/shop/schema.graphql';

function check(t, edition, files, schema = SCHEMA) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-fe-contract-gql-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const entries = { ...(schema === null ? {} : { [CONTRACT]: schema }), ...files };
  for (const [file, text] of Object.entries(entries)) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return feContractFindings({ repoRoot, files: Object.keys(entries), repo: { edition } });
}

for (const edition of ['lite', 'full']) {
  test(`FE_GRAPHQL_CONTRACT gql (${edition}): a field absent from the schema is refused on its source template`, (t) => {
    const findings = check(t, edition, {
      [OPERATION]: 'import { gql } from "@apollo/client";\nexport const PRODUCT = gql`query Product($id: ID!) { product(id: $id) { id price } }`;',
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'FE_GRAPHQL_CONTRACT');
    assert.equal(findings[0].level, 'error');
    assert.equal(findings[0].path, OPERATION);
    assert.equal(findings[0].operation, 'Product');
    assert.equal(findings[0].service, 'shop');
    assert.equal(findings[0].line, 2);
    assert.match(findings[0].message, /Product\.product\.price is not a field of Product/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): matching operations, aliased imports and namespace tags pass`, (t) => {
    assert.deepEqual(check(t, edition, {
      [OPERATION]: 'import { gql as document } from "@apollo/client"; export const PRODUCT = document`query Product($id: ID!) { product(id: $id) { id name } }`;',
      'fe/apps/web/src/rename.tsx': 'import gql from "graphql-tag"; export const RENAME = gql`mutation Rename($id: ID!, $name: String!) { renameProduct(id: $id, name: $name) { id name } }`;',
      'fe/packages/api/product.mjs': 'import * as Apollo from "@apollo/client"; export const PRODUCT = Apollo.gql`{ product(id: "p") { id } }`;',
    }), []);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): every template and operation is checked, including aliased tags`, (t) => {
    const findings = check(t, edition, {
      [OPERATION]: 'import { gql as document } from "@apollo/client"; const GOOD = document`{ product(id: "p") { id } }`; const BAD = document`query First { product(id: "p") { price } } query Second { missing { id } }`;',
    });
    assert.deepEqual(findings.map((finding) => finding.operation), ['First', 'Second']);
    assert.match(findings[0].message, /price is not a field/);
    assert.match(findings[1].message, /no contract .* declares query missing/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): static local fragment substitutions are validated`, (t) => {
    const source = (field) => `import { gql } from "@apollo/client";
const FIELDS = gql\`fragment ProductFields on Product { ${field} }\`;
const PRODUCT = gql\`query Product($id: ID!) { product(id: $id) { ...ProductFields } } \${FIELDS}\`;`;
    assert.deepEqual(check(t, edition, { [OPERATION]: source('id name') }), []);
    const findings = check(t, edition, { [OPERATION]: source('id price') });
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /price is not a field/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): an unrelated nested const cannot supply an imported fragment`, (t) => {
    const findings = check(t, edition, {
      [OPERATION]: `import { fields } from './fragment';
function unrelated() { const fields = gql\`fragment ProductFields on Product { id }\`; }
const PRODUCT = gql\`query Product { product(id: "p") { ...ProductFields } } \${fields}\`;`,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 3);
    assert.match(findings[0].message, /cannot be resolved to static GraphQL text/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): parameters and mutable locals shadow outer fragment constants`, (t) => {
    const findings = check(t, edition, {
      [OPERATION]: `const fields = gql\`fragment ProductFields on Product { id }\`;
function parameter(fields) { return gql\`query Parameter { product(id: "p") { ...ProductFields } } \${fields}\`; }
function mutable() { let fields = fragmentFromRuntime(); return gql\`query Mutable { product(id: "p") { ...ProductFields } } \${fields}\`; }`,
    });
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((finding) => finding.line), [2, 3]);
    assert.ok(findings.every((finding) => /cannot be resolved to static GraphQL text/.test(finding.message)));
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): local const fragments and aliases resolve within their lexical scope`, (t) => {
    const source = (field) => `const fields = gql\`fragment ProductFields on Product { id }\`;
function outer() { const alias = fields; return gql\`query Outer { product(id: "p") { ...ProductFields } } \${alias}\`; }
function inner() { const fields = gql\`fragment ProductFields on Product { ${field} }\`; return gql\`query Inner { product(id: "p") { ...ProductFields } } \${fields}\`; }`;
    assert.deepEqual(check(t, edition, { [OPERATION]: source('name') }), []);
    const findings = check(t, edition, { [OPERATION]: source('price') });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].operation, 'Inner');
    assert.match(findings[0].message, /price is not a field/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): malformed and unresolved templates are refused`, (t) => {
    const findings = check(t, edition, {
      [OPERATION]: 'import { gql } from "@apollo/client"; const BAD = gql`query Product { product(id: "p") { id }`; const DYNAMIC = gql`query Product { product(id: "p") { id } } ${fragmentFromRuntime()}`;',
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((finding) => /is not a GraphQL document/.test(finding.message)));
    assert.ok(findings.some((finding) => /cannot be resolved to static GraphQL text/.test(finding.message)));
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): comments, quoted examples, other tags and generated sources are ignored`, (t) => {
    const bad = 'gql`query Bad { unknown { missing } }`';
    assert.deepEqual(check(t, edition, {
      [OPERATION]: `// ${bad}\nconst example = '${bad}'; const other = sql\`query Bad { unknown { missing } }\`;`,
      'fe/apps/web/src/modules/api/graphql/__generated__/graphql.ts': `const GENERATED = ${bad};`,
      'fe/node_modules/vendor/source.ts': `const VENDORED = ${bad};`,
      'be/apps/api/src/query.ts': `const BACKEND = ${bad};`,
    }), []);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): an operation without a contract is refused`, (t) => {
    const findings = check(t, edition, { [OPERATION]: 'const PRODUCT = gql`{ product(id: "p") { id } }`;' }, null);
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /keeps no be\/contracts/);
  });

  test(`FE_GRAPHQL_CONTRACT gql (${edition}): standalone .graphql documents keep their validation behavior`, (t) => {
    assert.deepEqual(check(t, edition, {
      'fe/apps/web/src/modules/api/graphql/product.graphql': 'query Product($id: ID!) { product(id: $id) { id name } }',
    }), []);
    const findings = check(t, edition, {
      'fe/apps/web/src/modules/api/graphql/product.graphql': 'query Product($id: ID!) { product(id: $id) { price } }',
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, undefined);
    assert.match(findings[0].message, /price is not a field/);
  });
}
