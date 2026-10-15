import { createRequire } from "node:module";
import path from "node:path";
import { ScaffoldError, pascalOf } from "./service.mjs";
import { feName, readFeContext, readFeFile, requireNewFeOwner, planFeCatalogs, writeFePlan } from "./add-fe-page.mjs";

function loadTypeScript(root) {
  try { return createRequire(path.join(root, "package.json"))("typescript"); } catch {
    throw new ScaffoldError("HFS_ADD_TYPESCRIPT_MISSING", "add overlay reads the host page with its installed TypeScript compiler");
  }
}

function pageArrow(ts, source, symbol) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const candidate = statement.declarationList.declarations.find((declaration) => declaration.name.getText(source) === symbol);
    if (candidate?.initializer && ts.isArrowFunction(candidate.initializer)) return candidate.initializer;
  }
  return null;
}

function pageRender(ts, arrow) {
  if (!arrow) return null;
  if (!ts.isBlock(arrow.body)) {
    let body = arrow.body;
    while (ts.isParenthesizedExpression(body)) body = body.expression;
    return body;
  }
  const returns = arrow.body.statements.filter(ts.isReturnStatement);
  const unconditional = arrow.body.statements.every((statement) => ts.isVariableStatement(statement) || ts.isExpressionStatement(statement) || ts.isReturnStatement(statement));
  if (!unconditional || returns.length !== 1) return null;
  let render = returns[0].expression;
  while (render && ts.isParenthesizedExpression(render)) render = render.expression;
  return render;
}

function mountOverlay({ ts, before, relative, pageSymbol, symbol }) {
  const source = ts.createSourceFile(relative, before, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const client = source.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client");
  const render = pageRender(ts, pageArrow(ts, source, pageSymbol));
  const isJsx = render && (ts.isJsxElement(render) || ts.isJsxSelfClosingElement(render) || ts.isJsxFragment(render));
  if (source.parseDiagnostics.length || client || !isJsx) {
    throw new ScaffoldError("HFS_ADD_WIRE_INVALID", `${relative} must export the server ${pageSymbol} arrow with one unconditional JSX return`);
  }
  if (before.split(/[^A-Za-z0-9_]/).includes(symbol)) {
    throw new ScaffoldError("HFS_ADD_EXISTS", `${relative} already references ${symbol}`);
  }
  const from = render.getStart(source);
  const wrapped = ["(", "        <>", `            ${before.slice(from, render.end)}`, `            <${symbol} />`, "        </>", "    )"].join("\n");
  const body = before.slice(0, from) + wrapped + before.slice(render.end);
  const imports = source.statements.filter(ts.isImportDeclaration);
  const last = imports.at(-1)?.end ?? 0;
  const importLine = `import { ${symbol} } from "@/features/overlays/${symbol}"`;
  return `${body.slice(0, last)}\n${importLine}${body.slice(last)}`;
}

function overlaySources(symbol, namespace) {
  return {
    entry: `"use client"

import { useTranslations } from "next-intl"
import { ${symbol}Base } from "./component"

/** Resolve the overlay's copy at its client interaction boundary. */
export const ${symbol} = () => {
    const t = useTranslations(${JSON.stringify(namespace)})
    return <${symbol}Base props={{ title: t("title"), open: t("open"), close: t("close"), description: t("description") }} />
}
`,
    component: `import { Button, Dialog, Text } from "@starci/grammar/common"

/** Settled labels and content for the overlay's accessible dialog. */
export interface ${symbol}BaseProps {
    readonly props: {
        readonly title: string
        readonly open: string
        readonly close: string
        readonly description: string
    }
}

/** Draw an accessible dialog with an intrinsic trigger and dismissal. */
export const ${symbol}Base = (props: ${symbol}BaseProps) => (
    <Dialog
        title={props.props.title}
        closeLabel={props.props.close}
        trigger={<Button>{props.props.open}</Button>}
    >
        <Text>{props.props.description}</Text>
    </Dialog>
)
`,
  };
}

/** Add a localized client overlay and mount its public entry in a server feature page. */
export function addFeOverlay({ root, app, name, page, messages, ts }) {
  feName(name, "overlay name");
  if (page === undefined) throw new ScaffoldError("HFS_ADD_OPTION_MISSING", "add overlay needs --page naming its server feature page");
  feName(page, "host page name");
  const context = readFeContext({ root, app });
  const symbol = `${pascalOf(name)}Overlay`;
  const owner = `${context.source}/features/overlays/${symbol}`;
  requireNewFeOwner(context, owner);
  const pageSymbol = `${pascalOf(page)}Page`;
  const relative = `${context.source}/features/pages/${pageSymbol}/index.tsx`;
  const before = readFeFile(context, relative);
  const body = mountOverlay({ ts: ts ?? loadTypeScript(context.root), before, relative, pageSymbol, symbol });
  const catalogs = planFeCatalogs(context, {
    group: "overlays", name, messages,
    defaults: {
      vi: { title: "Th\u00f4ng tin", open: "M\u1edf th\u00f4ng tin", close: "\u0110\u00f3ng", description: "Xem th\u00f4ng tin c\u1ee7a trang n\u00e0y." },
      en: { title: "Information", open: "Open information", close: "Close", description: "View information about this page." },
    },
  });
  const sources = overlaySources(symbol, catalogs.namespace);
  const created = [
    { relative: `${owner}/index.tsx`, body: sources.entry },
    { relative: `${owner}/component.tsx`, body: sources.component },
  ];
  const updates = [...catalogs.updates, { relative, before, body }];
  return { ...writeFePlan(context, created, updates), registered: { app: context.app, overlay: symbol, page: pageSymbol } };
}
