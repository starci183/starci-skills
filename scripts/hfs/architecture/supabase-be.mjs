// supabase-be.mjs - the back-end half of the slot-driven Supabase architecture machine: a single integration owns
// JWT verification, pins the remote JWKS/issuer/audience/algorithms, and never trusts authorization claims from a body.
import path from 'node:path';
import { machineKit } from './machine-ast.mjs';
import { chainParts, importedFrom, reportAt, unwrap } from './supabase-ast.mjs';

const BE_SUPABASE_SLOT = 'be.integrations.supabase';
const BE_JWT_VERIFIED = 'BE_SUPABASE_JWT_VERIFIED';
const JWT_MODULES = new Set(['jose', 'jsonwebtoken', 'jwt-decode']);
const CLAIM_NAMES = new Set(['role', 'roles', 'membership', 'memberships']);

const objectLiteral = (kit, checker, node) => {
  const current = unwrap(kit.ts, node);
  if (kit.ts.isObjectLiteralExpression(current)) return current;
  if (!kit.ts.isIdentifier(current)) return null;
  for (const declaration of kit.declarationsOf(checker, current)) {
    if (kit.ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const value = unwrap(kit.ts, declaration.initializer);
      if (kit.ts.isObjectLiteralExpression(value)) return value;
    }
  }
  return null;
};

const staticStrings = (kit, checker, node) => {
  const current = unwrap(kit.ts, node);
  if (kit.ts.isStringLiteralLike(current)) return [current.text];
  if (kit.ts.isArrayLiteralExpression(current) && current.elements.every((element) => kit.ts.isStringLiteralLike(element))) return current.elements.map((element) => element.text);
  const value = kit.stringValue(checker, current);
  return value === null ? null : [value];
};

const jwksArgument = (kit, checker, node) => {
  const current = unwrap(kit.ts, node);
  if (kit.ts.isCallExpression(current)) return importedFrom(kit, checker, current.expression, new Set(['jose']), new Set(['createRemoteJWKSet']));
  if (!kit.ts.isIdentifier(current)) return false;
  return kit.declarationsOf(checker, current).some((declaration) => kit.ts.isVariableDeclaration(declaration) && declaration.initializer
    && jwksArgument(kit, checker, declaration.initializer));
};

export function checkBackendJwt(input) {
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const integrations = [...input.graph.files.values()].filter((file) => file.slot === BE_SUPABASE_SLOT);
  if (!integrations.length) return { violations, coverage: { status: 'not-applicable', integrationFiles: 0, verifiedCalls: 0 } };
  let verifyCalls = 0;
  let verifiedCalls = 0;
  for (const file of input.graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, (node) => {
      if (ts.isCallExpression(node)) {
        const binding = kit.importBinding(checker, node.expression);
        if (binding && JWT_MODULES.has(binding.module) && ['decode', 'decodeJwt', 'jwtDecode'].includes(binding.name)) {
          reportAt(violations, kit, BE_JWT_VERIFIED, file, node, `${binding.module}.${binding.name} decodes a token without proving its signature; use the Supabase JWKS verifier.`, { module: binding.module, method: binding.name });
        }
        if (binding?.module === 'jose' && binding.name === 'jwtVerify') {
          verifyCalls += 1;
          if (file.slot !== BE_SUPABASE_SLOT) {
            reportAt(violations, kit, BE_JWT_VERIFIED, file, node, `jwtVerify is called outside ${BE_SUPABASE_SLOT}; the integration is the one token verifier.`);
            return true;
          }
          const options = objectLiteral(kit, checker, node.arguments[2]);
          const property = (name) => options ? kit.propertyOf(options, name) : null;
          const values = (name) => {
            const entry = property(name);
            return entry ? staticStrings(kit, checker, kit.valueOfProperty(entry)) : null;
          };
          const issuer = property('issuer');
          const audience = values('audience');
          const algorithms = values('algorithms');
          const good = jwksArgument(kit, checker, node.arguments[1]) && issuer !== null && audience?.includes('authenticated')
            && algorithms !== null && algorithms.length > 0;
          if (!good) {
            reportAt(violations, kit, BE_JWT_VERIFIED, file, node, 'Supabase jwtVerify must use createRemoteJWKSet(...) and pin issuer, audience `authenticated`, and a non-empty algorithms list; jwtVerify then enforces signature and exp.');
          } else verifiedCalls += 1;
        }
      }
      if (ts.isPropertyAccessExpression(node) && CLAIM_NAMES.has(node.name.text)) {
        const parts = chainParts(ts, node.expression);
        if (parts.includes('body')) reportAt(violations, kit, BE_JWT_VERIFIED, file, node, `${node.name.text} is read from the request body; authorization claims come only from the verified token or the database.`, { claim: node.name.text });
      }
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && chainParts(ts, node.initializer).includes('body')) {
        for (const element of node.name.elements) {
          const property = element.propertyName ?? element.name;
          if (ts.isIdentifier(property) && CLAIM_NAMES.has(property.text)) reportAt(violations, kit, BE_JWT_VERIFIED, file, element, `${property.text} is destructured from the request body; authorization claims come only from the verified token or the database.`, { claim: property.text });
        }
      }
      return true;
    });
  }
  if (verifyCalls === 0) {
    const anchor = integrations.find((file) => path.posix.basename(file.rel).endsWith('.jwks.ts')) ?? integrations[0];
    reportAt(violations, kit, BE_JWT_VERIFIED, anchor, anchor.sourceFile, `${BE_SUPABASE_SLOT} has no jose.jwtVerify call backed by createRemoteJWKSet.`);
  }
  return { violations, coverage: { status: 'checked', integrationFiles: integrations.length, verifyCalls, verifiedCalls } };
}
