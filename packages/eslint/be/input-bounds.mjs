/**
 * The rules that keep input bounded (R42 `BE_INPUT_BOUNDED`).
 *
 * `dto-needs-validator` refuses an input class whose property carries no `class-validator` decorator. A property with
 * no validator accepts any value the wire delivers: a string of any length, a number of any size, an array of any
 * count. The transport layer states what it accepts; the use case never re-checks shape.
 *
 * An input class is one decorated `@InputType` or `@ArgsType`, or declared in a file named `*.dto.ts`, `*.input.ts`,
 * `*.args.ts` or `*.request.ts`. A class decorated `@ObjectType` is a response and is left alone. A decorator counts as
 * a validator only when it is imported from `class-validator`, so a `@Field` or a `@Type` does not satisfy the rule.
 */
import { decoratorName } from "./lib/ast.mjs"
import { isDeclarationFile, isTestLane, normalizePath } from "./lib/path.mjs"

const INPUT_FILE = /\.(?:dto|input|args|request)\.ts$/

const decoratorsOf = (node) => node.decorators ?? []

/** Names imported from `class-validator`, by local name. */
const validatorImports = (program) => {
  const names = new Set()
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "class-validator") continue
    for (const specifier of statement.specifiers) names.add(specifier.local.name)
  }
  return names
}

/** Every property of an input class has a validator. */
export const dtoNeedsValidator = {
  meta: {
    type: "problem",
    docs: { description: "A property of an input class carries a `class-validator` decorator." },
    schema: [],
    messages: {
      missing:
        "`{{name}}` has no `class-validator` decorator, so the wire may deliver any value here: a string of any length, a number of any size, an array of any count. Add the validators the field needs (`@IsString() @MaxLength(n)`, `@IsInt() @Min(0) @Max(n)`, `@IsArray() @ArrayMaxSize(n)`, `@IsOptional()` for a nullable field).",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (isTestLane(filename) || isDeclarationFile(filename)) return {}
    const sourceCode = context.sourceCode || context.getSourceCode()
    let validators = null
    return {
      Program(node) {
        validators = validatorImports(node)
      },
      ClassDeclaration(node) {
        checkClass(node)
      },
      ClassExpression(node) {
        checkClass(node)
      },
    }
    function checkClass(node) {
      const decorators = decoratorsOf(node).map(decoratorName)
      const target = node.parent?.type === "ExportNamedDeclaration" || node.parent?.type === "ExportDefaultDeclaration" ? node.parent : node
      const classDecorators = [...decorators, ...decoratorsOf(target).map(decoratorName)]
      if (classDecorators.includes("ObjectType")) return
      const isInput = classDecorators.includes("InputType") || classDecorators.includes("ArgsType") || INPUT_FILE.test(filename)
      if (!isInput) return
      for (const member of node.body.body) {
        if (member.type !== "PropertyDefinition" || member.static || member.computed) continue
        if (member.key.type !== "Identifier") continue
        const validated = decoratorsOf(member).some((decorator) => {
          const name = decoratorName(decorator)
          return name !== null && validators.has(name)
        })
        if (!validated) context.report({ node: member.key, messageId: "missing", data: { name: sourceCode.getText(member.key) } })
      }
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "dto-needs-validator": dtoNeedsValidator,
}

/** Starts at error: no baseline exists, and the repositories' fix lanes clear the debt. */
export const recommended = {
  "starci-be/dto-needs-validator": "error",
}
