import { machineKit } from './machine-ast.mjs';

/**
 * R41 `default-deny-app-guard` (BE_DEFAULT_DENY). Every api app root provides its `APP_GUARD` entries in the order
 * throttler -> CSRF origin guard -> AuthGuard, each exactly once, so no request reaches a handler before it was
 * rate-limited, origin-checked and authenticated. A guard is classified by where its class is declared (or what it
 * extends): the throttler guard is a class of @nestjs/throttler or one that extends it; the CSRF guard is declared in
 * platform/http-security; AuthGuard is the `AuthGuard` class declared in domain/identity. Other guards are permitted
 * between them; a missing, repeated or reordered one of the three is a finding.
 */
export const DEFAULT_DENY_RULE_IDS = ['BE_DEFAULT_DENY'];

const RULE = 'BE_DEFAULT_DENY';
const ORDER = ['throttler', 'csrf', 'auth'];
const LABEL = { throttler: 'the throttler guard', csrf: 'the CSRF origin guard of platform/http-security', auth: 'AuthGuard of domain/identity' };

export function checkDefaultDeny(input) {
  const { config } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  let apps = 0;

  const extendsThrottler = (declaration, depth = 0) => {
    if (!ts.isClassDeclaration(declaration) || depth > 8) return false;
    const checker = kit.checkerOf(declaration.getSourceFile());
    if (!checker) return false;
    for (const clause of declaration.heritageClauses ?? []) {
      for (const type of clause.types) {
        if (kit.isImportOf(checker, type.expression, 'ThrottlerGuard', '@nestjs/throttler')) return true;
        if (kit.declarationsOf(checker, type.expression).some(parent => parent !== declaration && extendsThrottler(parent, depth + 1))) return true;
      }
    }
    return false;
  };

  const classify = (checker, node) => {
    if (!node) return null;
    if (kit.importBinding(checker, node)?.module === '@nestjs/throttler') return 'throttler';
    for (const declaration of kit.declarationsOf(checker, node)) {
      const owner = kit.ownerOfDeclaration(declaration);
      if (owner?.tier === 'platform' && owner.name === 'http-security') return 'csrf';
      if (owner?.tier === 'domain' && owner.name === 'identity' && ts.isClassDeclaration(declaration) && declaration.name?.text === 'AuthGuard') return 'auth';
      if (extendsThrottler(declaration)) return 'throttler';
    }
    return null;
  };

  for (const app of config.apps.filter(item => item.kind === 'api')) {
    const root = kit.appRoot(app.name);
    if (!root) continue;
    apps += 1;
    const guards = kit.providersOf(root, 'APP_GUARD', '@nestjs/core');
    const roles = guards.map(guard => ({ guard, role: classify(guard.checker, guard.useClass) }));
    const anchor = guards[0]?.node ?? root.sourceFile.statements[0] ?? root.sourceFile;
    const finding = (node, message) => violations.push({ ruleId: RULE, path: root.rel, ...kit.at(root.rel, root.sourceFile, node), app: app.name, message });
    for (const role of ORDER) {
      const entries = roles.filter(item => item.role === role);
      if (entries.length === 0) finding(anchor, `App ${app.name} does not provide ${LABEL[role]} as an APP_GUARD; an api app is denied by default: throttler, then CSRF origin guard, then AuthGuard.`);
      else if (entries.length > 1) finding(entries[1].guard.node, `App ${app.name} provides ${LABEL[role]} more than once as an APP_GUARD.`);
    }
    const indexes = ORDER.map(role => roles.findIndex(item => item.role === role));
    if (indexes.every(index => index >= 0)) {
      for (let i = 1; i < indexes.length; i += 1) {
        if (indexes[i] < indexes[i - 1]) finding(roles[indexes[i]].guard.node, `App ${app.name} provides ${LABEL[ORDER[i]]} before ${LABEL[ORDER[i - 1]]}; the APP_GUARD order is throttler, CSRF origin guard, AuthGuard.`);
      }
    }
  }
  return { violations, coverage: { status: 'checked', apps } };
}
