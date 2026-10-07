import { relativePath, UNPROVEN_FRAMEWORK, unwrapExpression } from './typescript.mjs';
import { constructedDecoratorKind, mutableDecoratorKind, nodeDecorators, tracedFrameworkKinds, violation } from './ast-walks.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
/** Check the adopted domain-first backend source layout without inferring semantic ownership from folder names alone. */
export function createBackendSourceShapeChecker(helpers) {
  const {
    absoluteRoots, canonical, frameworkTargets, locatedRoot, sourceRole, kebabSourceBase, exportedDeclarations,
    classValueStatus, objectContractStatus, companionInterfaceAllowed, hasModifier, graphqlField, graphqlArgument,
    graphqlEnumRegistration, selectedCallKind, callsNamedHelper, implementsFramework, implementedPortNames, decoratorKind,
    SOURCE_LAYOUT_RULE_ID, SOURCE_NAME_RULE_ID, APPLICATION_ROLES, TRANSPORT_ROLES, APPLICATION_LAYER_ROLES,
    TRANSPORT_LAYER_ROLES, CLASS_ROLE_SUFFIX, TRANSPORT_OBJECT_SUFFIX, NON_CLASS_ROLES, SPECIAL_BASENAMES, TRACE_NEW,
  } = helpers;

  function locateSource(config, context, sourceFile, featureRoots, moduleRoots, localFiles, state) {
    const fileName = canonical(sourceFile.fileName);
    const featureRoot = locatedRoot(featureRoots, fileName);
    const moduleRoot = locatedRoot(moduleRoots, fileName);
    if (!featureRoot && !moduleRoot) return null;
    state.checkedFiles += 1;
    const checker = context.checkerFor(fileName);
    if (!state.frameworkByChecker.has(checker)) state.frameworkByChecker.set(checker, frameworkTargets(config, context, checker, localFiles));
    const framework = state.frameworkByChecker.get(checker);
    const relativeToOwner = relativePath(featureRoot ?? moduleRoot, fileName);
    const parts = relativeToOwner.split('/');
    const directories = parts.slice(0, -1).map(part => part.toLowerCase());
    const applicationIndex = directories.indexOf('application');
    const transportIndex = directories.indexOf('transport');
    const inApplication = applicationIndex >= 0;
    const inTransport = transportIndex >= 0;
    const role = sourceRole(context.ts, sourceFile);
    const relative = relativePath(config.root, fileName);
    const migrationName = /^\d{10,}-[A-Z][A-Za-z0-9]*$/.test(role.base);
    const persistencePath = !role.spec && (migrationName || directories.includes('migrations'));
    const special = SPECIAL_BASENAMES.has(role.base.toLowerCase()) || migrationName
      || ['constants', 'enums', 'errors', 'migrations'].some(folder => directories.includes(folder));
    const publicDeclarations = exportedDeclarations(context.ts, checker, sourceFile);
    return { config, context, sourceFile, fileName, featureRoot, moduleRoot, checker, framework, directories, transportIndex,
      inApplication, inTransport, role, relative, migrationName, persistencePath, special, publicDeclarations };
  }

  function reportSourceName(info, state) {
    const { config, sourceFile, migrationName, role, relative } = info;
    if (!migrationName && !kebabSourceBase(role.base)) state.violations.push(violation(config, sourceFile, sourceFile, SOURCE_NAME_RULE_ID,
      `Source basename ${role.base} must use kebab-case segments plus an explicit role suffix.`));
    if (!role.role && !info.special) state.namingReasons.push(`${relative} has no statically identifiable source role`);
  }

  function reportFeatureRoleConflicts(info, state) {
    const { config, sourceFile, role, directories, inApplication, inTransport, transportIndex } = info;
    const { violations } = state;
    if (inApplication && inTransport) violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
      'A feature source cannot belong to both application and transport layers.'));
    if (role.role && APPLICATION_ROLES.has(role.role) && !inApplication) violations.push(violation(config, sourceFile, sourceFile,
      SOURCE_LAYOUT_RULE_ID, `${role.role} source belongs under the feature application/ layer.`));
    if (role.role && TRANSPORT_ROLES.has(role.role) && !inTransport) violations.push(violation(config, sourceFile, sourceFile,
      SOURCE_LAYOUT_RULE_ID, `${role.role} source belongs under the feature transport/<protocol>/ layer.`));
    if (inApplication && role.role && TRANSPORT_ROLES.has(role.role)) violations.push(violation(config, sourceFile, sourceFile,
      SOURCE_LAYOUT_RULE_ID, `Transport role ${role.role} cannot live in application/.`));
    if (inTransport && role.role && APPLICATION_ROLES.has(role.role)) violations.push(violation(config, sourceFile, sourceFile,
      SOURCE_LAYOUT_RULE_ID, `Application role ${role.role} cannot live in transport/.`));
    if (inTransport && transportIndex >= directories.length - 1) violations.push(violation(config, sourceFile, sourceFile,
      SOURCE_LAYOUT_RULE_ID, 'Feature transport source must name a protocol below transport/.'));
  }

  function reportFeatureRoleSelection(info, state) {
    const { role, relative, directories, inApplication, inTransport, persistencePath } = info;
    const topLevelFeatureFile = directories.length === 1 && (role.base === 'index' || role.role === 'module' || role.spec);
    if (inApplication && role.base !== 'index' && (!role.role || !APPLICATION_LAYER_ROLES.has(role.role))
      && !(role.role && (TRANSPORT_ROLES.has(role.role) || role.role === 'entity'))) {
      state.layoutReasons.push(`${relative} role ${role.role ?? '(unclassified)'} is not a selected application-layer role`);
    }
    if (inTransport && role.base !== 'index' && (!role.role || !TRANSPORT_LAYER_ROLES.has(role.role))
      && !(role.role && (APPLICATION_ROLES.has(role.role) || role.role === 'entity'))) {
      state.layoutReasons.push(`${relative} role ${role.role ?? '(unclassified)'} is not a selected transport-layer role`);
    }
    if (!inApplication && !inTransport && !topLevelFeatureFile && role.role && role.role !== 'entity'
      && !APPLICATION_ROLES.has(role.role) && !TRANSPORT_ROLES.has(role.role)) {
      state.layoutReasons.push(`${relative} role ${role.role} has no statically selected feature layer`);
    }
    if (!inApplication && !inTransport && !topLevelFeatureFile && !role.role && !persistencePath) {
      state.layoutReasons.push(`${relative} has no statically selected feature layer`);
    }
  }

  function reportFeatureSchemaPlacement(info, state) {
    const { config, sourceFile, role, persistencePath } = info;
    if (persistencePath) state.violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
      'Migration source cannot be owned by a feature; place it under the declared persistence module.'));
    if (role.role === 'entity') state.violations.push(violation(config, sourceFile, sourceFile, SOURCE_LAYOUT_RULE_ID,
      'Entity source cannot be owned by a feature; place schema under the declared persistence module.'));
  }

  function reportFeatureLayout(info, state) {
    if (!info.featureRoot) return;
    reportFeatureRoleConflicts(info, state);
    reportFeatureRoleSelection(info, state);
    reportFeatureSchemaPlacement(info, state);
  }

  function inspectClassPlacement(info, declaration, kinds, state) {
    const { config, context, sourceFile, featureRoot, inTransport, directories, transportIndex, checker, framework } = info;
    const { ts } = context;
    const graphQlDto = kinds.some(kind => kind === 'ArgsType' || kind === 'InputType' || kind === 'ObjectType');
    if (graphQlDto && (!featureRoot || !inTransport || directories[transportIndex + 1] !== 'graphql')) {
      state.violations.push(violation(config, sourceFile, declaration.name ?? declaration, SOURCE_LAYOUT_RULE_ID,
        'GraphQL DTO classes belong under a feature transport/graphql/ boundary.'));
    }
    const persistenceSchema = kinds.includes('Entity') || kinds.includes('ViewEntity')
      || implementsFramework(ts, checker, declaration, framework.bySymbol, 'MigrationInterface');
    if (persistenceSchema && featureRoot) state.violations.push(violation(config, sourceFile, declaration.name ?? declaration, SOURCE_LAYOUT_RULE_ID,
      'TypeORM entities and migrations cannot be owned by a feature; place schema under its declared persistence module.'));
  }

  function inspectClassName(info, declaration, state) {
    const { config, sourceFile, role, relative, checker } = info;
    const { ts } = info.context;
    const { publicDeclarations } = info;
    const classSuffix = role.role && !NON_CLASS_ROLES.has(role.role) ? CLASS_ROLE_SUFFIX.get(role.role) : null;
    if (publicDeclarations.has(declaration) && !declaration.name) state.namingReasons.push(`${relative} exports an anonymous class whose role name cannot be proved`);
    else if (publicDeclarations.has(declaration) && declaration.name && classSuffix && !declaration.name.text.endsWith(classSuffix)
      && !implementedPortNames(ts, checker, declaration).some(port => declaration.name.text.endsWith(port))) {
      state.violations.push(violation(config, sourceFile, declaration.name, SOURCE_NAME_RULE_ID,
        `Exported class ${declaration.name.text} must end in ${classSuffix} for a ${role.role} source file, or in the name of the port it implements.`));
    } else if (publicDeclarations.has(declaration) && declaration.name && role.role && !NON_CLASS_ROLES.has(role.role) && !classSuffix) {
      state.namingReasons.push(`${relative} declares exported class ${declaration.name.text} with unclassified file role ${role.role}`);
    }
  }

  function inspectClass(info, declaration, state) {
    const { ts } = info.context;
    const { checker, framework } = info;
    const declarationDecorators = nodeDecorators(ts, declaration);
    const kinds = declarationDecorators.map(decorator => decoratorKind(ts, checker, decorator, framework.bySymbol)).filter(Boolean);
    inspectClassPlacement(info, declaration, kinds, state);
    inspectClassName(info, declaration, state);
  }

  function inspectClasses(info, state) {
    const declarations = info.sourceFile.statements.filter(statement => info.context.ts.isClassDeclaration(statement));
    for (const declaration of declarations) inspectClass(info, declaration, state);
  }

  function inspectClassValue(info, declaration, state) {
    const { config, sourceFile, relative, role, checker, publicDeclarations } = info;
    const { ts } = info.context;
    if (!publicDeclarations.has(declaration) || !declaration.initializer) return;
    const classValue = classValueStatus(ts, checker, declaration.initializer);
    if (classValue.status === 'unavailable') {
      state.namingReasons.push(`${relative} exports a class-valued declaration whose role identity is not statically proved`);
      return;
    }
    if (classValue.status !== 'class') return;
    const classSuffix = role.role && !NON_CLASS_ROLES.has(role.role) ? CLASS_ROLE_SUFFIX.get(role.role) : null;
    if (!classSuffix || !ts.isIdentifier(declaration.name)) {
      state.namingReasons.push(`${relative} exports a class-valued declaration without a statically selected class role`);
      return;
    }
    const names = [declaration.name.text, ...classValue.names];
    const invalid = names.find(name => !name.endsWith(classSuffix));
    if (invalid) state.violations.push(violation(config, sourceFile, declaration.name, SOURCE_NAME_RULE_ID,
      `Exported class value ${invalid} must end in ${classSuffix} for a ${role.role} source file.`));
  }

  function inspectClassValues(info, state) {
    const { ts } = info.context;
    const { sourceFile } = info;
    for (const statement of sourceFile.statements) if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) inspectClassValue(info, declaration, state);
    }
  }

  function inspectEnumMembers(info, statement, state) {
    const { config, sourceFile } = info;
    const { ts } = info.context;
    for (const member of statement.members) {
      const name = ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name) ? member.name.text : null;
      const initializer = member.initializer && unwrapExpression(ts, member.initializer);
      if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name) || !initializer || !ts.isStringLiteralLike(initializer)) {
        state.violations.push(violation(config, sourceFile, member.name, SOURCE_NAME_RULE_ID,
          'Enum members must use PascalCase names with explicit static string values.'));
      }
    }
  }

  function inspectObjectContract(info, statement, state) {
    const { config, sourceFile, role, checker, publicDeclarations } = info;
    const { ts } = info.context;
    const contractStatus = objectContractStatus(ts, checker, statement);
    const transportSuffix = TRANSPORT_OBJECT_SUFFIX.get(role.role);
    if (contractStatus === 'object' && publicDeclarations.has(statement) && transportSuffix && !role.spec
      && !statement.name.text.endsWith(transportSuffix) && !companionInterfaceAllowed(ts, sourceFile, statement.name.text)) {
      state.violations.push(violation(config, sourceFile, statement.name, SOURCE_NAME_RULE_ID,
        `Public object contract ${statement.name.text} in a ${role.role} source file must end in ${transportSuffix}.`));
    }
  }

  function inspectEnumAndContract(info, statement, state) {
    const { config, sourceFile } = info;
    const { ts } = info.context;
    if (ts.isEnumDeclaration(statement)) {
      if (hasModifier(ts, statement, ts.SyntaxKind.ConstKeyword) || !/^[A-Z][A-Za-z0-9]*$/.test(statement.name.text)) {
        state.violations.push(violation(config, sourceFile, statement.name, SOURCE_NAME_RULE_ID,
          'Enums must be non-const declarations with PascalCase names.'));
      }
      inspectEnumMembers(info, statement, state);
    }
    inspectObjectContract(info, statement, state);
  }

  function inspectEnumsAndContracts(info, state) {
    for (const statement of info.sourceFile.statements) inspectEnumAndContract(info, statement, state);
  }

  function inspectDynamicDecorator(info, dynamic, state) {
    const detail = `${info.relative} uses a mutable or constructed ${dynamic} decorator identity`;
    if (['Entity', 'ViewEntity', 'ArgsType', 'InputType', 'ObjectType', 'multiple framework', 'unproven framework'].includes(dynamic)) state.layoutReasons.push(detail);
    if (!['Entity', 'ViewEntity'].includes(dynamic)) state.namingReasons.push(detail);
  }

  function inspectDecorator(info, node, decorator, state) {
    const { ts } = info.context;
    const { checker, framework } = info;
    const kind = decoratorKind(ts, checker, decorator, framework.bySymbol);
    if (!kind) {
      const dynamic = mutableDecoratorKind(ts, checker, decorator, framework.bySymbol)
        ?? constructedDecoratorKind(ts, checker, decorator, framework.bySymbol, TRACE_NEW);
      if (dynamic) inspectDynamicDecorator(info, dynamic, state);
    }
    if (kind === 'Mutation' || kind === 'Query') graphqlField({ config: info.config, context: info.context, sourceFile: info.sourceFile,
      node, decorator, kind, namingReasons: state.namingReasons, violations: state.violations });
    if (kind === 'Args') graphqlArgument(info.config, info.context, info.sourceFile, node, decorator, state.namingReasons, state.violations);
  }

  function inspectNodeDecorators(info, node, state) {
    for (const decorator of nodeDecorators(info.context.ts, node)) inspectDecorator(info, node, decorator, state);
  }

  function inspectEnumCalls(info, node, state) {
    const { ts } = info.context;
    const { checker, framework } = info;
    if (!ts.isCallExpression(node)) return;
    if (selectedCallKind(ts, checker, node, framework.bySymbol) === 'registerEnumType') {
      graphqlEnumRegistration(info.config, info.context, info.sourceFile, node, state.namingReasons, state.violations);
    } else if (callsNamedHelper(ts, checker, node, 'createEnumType')) {
      state.namingReasons.push(`${info.relative} calls a project GraphQL enum adapter whose emitted type name is not statically proved`);
    }
  }

  function inspectConstructedSource(info, node, state) {
    const { ts } = info.context;
    const { checker, framework, publicDeclarations, featureRoot } = info;
    const exportedFactoryCall = ts.isCallExpression(node) && ts.isVariableDeclaration(node.parent) && publicDeclarations.has(node.parent);
    if ((ts.isNewExpression(node) || exportedFactoryCall) && featureRoot) {
      const constructed = tracedFrameworkKinds(ts, checker, node, framework.bySymbol, TRACE_NEW);
      if (constructed.has('EntitySchema')) state.violations.push(violation(info.config, info.sourceFile, node.expression, SOURCE_LAYOUT_RULE_ID,
        'TypeORM EntitySchema cannot be owned by a feature; place schema under its declared persistence module.'));
      if (constructed.has(UNPROVEN_FRAMEWORK)) state.layoutReasons.push(`${info.relative} has a constructed provider identity beyond the bounded static trace`);
    }
  }

  function visitSourceNode(info, node, state) {
    inspectNodeDecorators(info, node, state);
    inspectEnumCalls(info, node, state);
    inspectConstructedSource(info, node, state);
    info.context.ts.forEachChild(node, child => visitSourceNode(info, child, state));
  }

  function inspectSourceFile(config, context, sourceFile, featureRoots, moduleRoots, localFiles, state) {
    const info = locateSource(config, context, sourceFile, featureRoots, moduleRoots, localFiles, state);
    if (!info) return;
    reportSourceName(info, state);
    reportFeatureLayout(info, state);
    inspectClasses(info, state);
    inspectClassValues(info, state);
    inspectEnumsAndContracts(info, state);
    visitSourceNode(info, sourceFile, state);
  }

  function coverageFor(state) {
    for (const framework of state.frameworkByChecker.values()) {
      state.layoutReasons.push(...framework.reasons);
      state.namingReasons.push(...framework.reasons.filter(reason => reason.includes('@nestjs/graphql')));
    }
    if (state.checkedFiles === 0) {
      state.layoutReasons.push('the checked TypeScript program contains no configured backend feature or module source');
      state.namingReasons.push('the checked TypeScript program contains no configured backend feature or module source');
    }
    return {
      files: state.checkedFiles,
      layout: state.layoutReasons.length
        ? { status: 'unavailable', reason: 'one or more backend source placement relations are not statically proved', details: [...new Set(state.layoutReasons)].sort(byCodeUnit) }
        : { status: 'checked' },
      naming: state.namingReasons.length
        ? { status: 'unavailable', reason: 'one or more backend source naming relations are not statically proved', details: [...new Set(state.namingReasons)].sort(byCodeUnit) }
        : { status: 'checked' },
    };
  }

  return function checkBackendSourceShape(config, context) {
    const featureRoots = absoluteRoots(config.root, config.backend.features);
    const moduleRoots = absoluteRoots(config.root, config.backend.modules);
    const localFiles = new Set(context.files.map(file => canonical(file.fileName)));
    const state = { frameworkByChecker: new Map(), violations: [], layoutReasons: [], namingReasons: [], checkedFiles: 0 };
    for (const sourceFile of context.files) inspectSourceFile(config, context, sourceFile, featureRoots, moduleRoots, localFiles, state);
    return { violations: state.violations, coverage: coverageFor(state) };
  };
}
