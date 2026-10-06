import { machineKit } from './machine-ast.mjs';

/**
 * R39 `error-masked` (BE_ERROR_MASKED). Every api app root provides exactly one `APP_FILTER`, its class declared in
 * platform/errors (the one ExceptionFilter that masks everything that is not a DomainError), and every GraphQL module
 * registration of the program passes the `formatError` platform/errors exports. Filters and format functions defined
 * anywhere else, a second filter, or a GraphQL registration without `formatError` leak internal errors to the client.
 */
export const ERROR_MASKED_RULE_IDS = ['BE_ERROR_MASKED'];

const RULE = 'BE_ERROR_MASKED';

export function checkErrorMasked(input) {
  const { config, graph } = input;
  const kit = machineKit(input);
  const { ts } = kit;
  const violations = [];
  const inErrors = (checker, node) => kit.declarationsOf(checker, node).map(kit.ownerOfDeclaration).some(owner => owner?.tier === 'platform' && owner.name === 'errors');
  let apps = 0;
  for (const app of config.apps.filter(item => item.kind === 'api')) {
    const root = kit.appRoot(app.name);
    if (!root) continue;
    apps += 1;
    const filters = kit.providersOf(root, 'APP_FILTER', '@nestjs/core');
    const anchor = filters[0]?.node ?? root.sourceFile.statements[0] ?? root.sourceFile;
    if (filters.length !== 1) {
      violations.push({ ruleId: RULE, path: root.rel, ...kit.at(root.rel, root.sourceFile, anchor), app: app.name,
        message: `App ${app.name} provides ${filters.length} APP_FILTER entries; an api app provides exactly one, the ExceptionFilter of platform/errors.` });
    }
    for (const filter of filters) {
      if (!filter.useClass || !inErrors(filter.checker, filter.useClass)) {
        violations.push({ ruleId: RULE, path: root.rel, ...kit.at(root.rel, root.sourceFile, filter.node), app: app.name,
          message: 'The APP_FILTER must be `useClass` of the filter declared in platform/errors; any other filter can let an undeclared error reach the client unmasked.' });
      }
    }
  }
  let graphql = 0;
  for (const file of graph.files.values()) {
    const checker = kit.checkerOf(file.sourceFile);
    kit.walk(file.sourceFile, node => {
      if (!(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['forRoot', 'forRootAsync'].includes(node.expression.name.text)
        && kit.isImportOf(checker, node.expression.expression, 'GraphQLModule', '@nestjs/graphql'))) return;
      graphql += 1;
      let masked = false;
      for (const argument of node.arguments) {
        kit.walk(argument, inner => {
          if ((ts.isPropertyAssignment(inner) || ts.isShorthandPropertyAssignment(inner)) && kit.propertyNameText(inner.name) === 'formatError'
            && inErrors(checker, kit.valueOfProperty(inner))) masked = true;
        });
      }
      if (!masked) {
        violations.push({ ruleId: RULE, path: file.rel, ...kit.at(file.rel, file.sourceFile, node),
          message: `GraphQLModule.${node.expression.name.text} must pass the \`formatError\` exported by platform/errors; without it a resolver error reaches the client with its internal message.` });
      }
    });
  }
  return { violations, coverage: { status: 'checked', apps, graphqlRegistrations: graphql } };
}
