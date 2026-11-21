// Parse pack scripts without importing or executing them.
import { readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const [root, pack, lookupArg] = process.argv.slice(2);
const lookup = lookupArg && JSON.parse(lookupArg);
const scripts = path.join(pack, "scripts");
const rows = [];
const errors = [];
const modules = new Set();
const textures = new Set();
const dependencies = [];
const references = [];
const identifiers = new Set();
const moduleImports = new Map();
const relative = (file) => path.relative(root, file).split(path.sep).join("/");

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(filename);
    return entry.isFile() && /\.(?:js|mjs|cjs)$/.test(filename) ? [filename] : [];
  });
}

const scriptFiles = files(scripts).sort();
const program = ts.createProgram(scriptFiles, { allowJs: true, noResolve: true, noLib: true, types: [] });
const checker = program.getTypeChecker();

for (const filename of scriptFiles) {
  const file = relative(filename);
  const source = program.getSourceFile(filename);
  const line = (position) => source.getLineAndCharacterOfPosition(position).line + 1;
  const text = (node) => node?.getText(source);
  const compact = (node) => text(node)?.replace(/\s+/g, " ").slice(0, 100);
  const imports = new Map();

  function collect(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      if (name.startsWith("@minecraft/")) {
        modules.add(name);
        const clause = node.importClause;
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const entry of clause.namedBindings.elements) {
            const exported = entry.propertyName?.text ?? entry.name.text;
            imports.set(entry.name.text, exported);
            moduleImports.set(entry.name.text, { module: name, exported });
          }
        } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          moduleImports.set(clause.namedBindings.name.text, { module: name, exported: null });
        } else if (clause?.name) {
          moduleImports.set(clause.name.text, { module: name, exported: "default" });
        }
      }
    }
    ts.forEachChild(node, collect);
  }

  function constant(node) {
    const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
    if (declaration && ts.isVariableDeclaration(declaration) &&
        (declaration.parent.flags & ts.NodeFlags.Const)) return declaration.initializer;
  }

  function literal(node, seen = new Set()) {
    if (!node || seen.has(node)) return undefined;
    seen.add(node);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isIdentifier(node)) return literal(constant(node), seen);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      let object = constant(node.expression);
      if (object && ts.isCallExpression(object) && text(object.expression) === "Object.freeze") {
        [object] = object.arguments;
      }
      if (object && ts.isObjectLiteralExpression(object)) {
        const property = object.properties.find((entry) =>
          ts.isPropertyAssignment(entry) && entry.name.text === node.name.text);
        return literal(property?.initializer, seen);
      }
    }
    return undefined;
  }

  function add(kind, name, node, details = {}) {
    rows.push({ kind, name, file, line: line(node.getStart(source)), ...details });
  }

  function eventName(node) {
    if (!node || !ts.isPropertyAccessExpression(node)) return undefined;
    const signal = node.expression;
    if (!ts.isPropertyAccessExpression(signal) ||
        !["beforeEvents", "afterEvents"].includes(signal.name.text)) return undefined;
    const receiver = imports.get(text(signal.expression)) ?? text(signal.expression);
    if (receiver === "system" || receiver === "world") {
      return [receiver, signal.name.text, node.name.text].join(".");
    }
  }

  function visit(node) {
    const isLiteral = ts.isStringLiteralLike(node);
    if (isLiteral && node.text.startsWith("textures/")) textures.add(node.text);
    if (isLiteral && (/^[a-z][a-z0-9_.-]*:[a-z0-9_./-]+$/.test(node.text) ||
                      /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(node.text))) identifiers.add(node.text);
    if (lookup && (isLiteral || (lookup.contains && ts.isTemplateLiteralToken(node)))) {
      const match = node.text === lookup.query || (lookup.contains && node.text.includes(lookup.query));
      if (match) {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        references.push({ file, line: position.line + 1, column: position.character + 1, kind: "js-literal" });
      }
    }
    const dynamic = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    if (dynamic || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = dynamic ? node.arguments[0] : node.moduleSpecifier;
      if (specifier && ts.isStringLiteralLike(specifier)) {
        dependencies.push({ file, line: line(specifier.getStart(source)), specifier: specifier.text, dynamic });
      }
    }
    if ((ts.isPropertyAssignment(node) && ["fog", "fogId"].includes(node.name.text)) ||
        (ts.isVariableDeclaration(node) && /(?:^|_)FOG_ID$/.test(node.name.text ?? ""))) {
      const id = literal(node.initializer);
      if (typeof id === "string" && /^[\w.-]+:[\w./-]+$/.test(id)) add("fog", id, node);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ||
        ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      add("symbol", compact(node.name), node, { type: ts.SyntaxKind[node.kind], end: line(node.end) });
    }
    // In-memory state stores a future agent must know about before editing.
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isNewExpression(node.initializer)) {
      const storeType = text(node.initializer.expression);
      if (["Map", "Set", "WeakMap"].includes(storeType) && ts.isIdentifier(node.name)) {
        add("store", node.name.text, node, { type: storeType, end: line(node.end) });
      }
    }
    // Per-module export surface for impact-style reasoning.
    const exported = ts.canHaveModifiers(node) &&
      (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) add("export", declaration.name.text, declaration, { end: line(declaration.end) });
        }
      } else if (node.name) {
        add("export", compact(node.name), node, { end: line(node.end) });
      }
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) add("export", element.name.text, element);
    }
    if (ts.isExportAssignment(node)) add("export", "default", node);
    // Script API member usage on @minecraft imports, e.g. system.runInterval.
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const info = moduleImports.get(node.expression.text);
      if (info && info.exported) {
        add("api", `${info.module}.${info.exported}.${node.name.text}`, node,
          { module: info.module, object: info.exported, member: node.name.text });
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression)) {
      const info = moduleImports.get(node.expression.expression.text);
      if (info && !info.exported) {
        add("api", `${info.module}.${node.expression.name.text}.${node.name.text}`, node,
          { module: info.module, object: node.expression.name.text, member: node.name.text });
      }
    }
    if (ts.isNewExpression(node) && text(node.expression) === "ItemStack") {
      const id = literal(node.arguments?.[0]);
      if (typeof id === "string") add("item", id, node);
    }
    if (ts.isCallExpression(node)) {
      const target = node.expression;
      const method = ts.isPropertyAccessExpression(target) ? target.name.text : undefined;
      const receiver = method ? text(target.expression) : undefined;
      const [first, second] = node.arguments;
      if (method === "subscribe" || text(target) === "subscribe") {
        const name = eventName(method ? target.expression : first);
        if (name) add("event", name, node, { callback: compact(method ? first : second) });
      }
      if ((imports.get(receiver) ?? receiver) === "system" &&
          ["run", "runInterval", "runTimeout", "runJob", "clearRun", "clearJob"].includes(method)) {
        const ticks = literal(second);
        add("schedule", method, node, {
          callback: compact(first),
          ...(ticks === undefined ? { expression: compact(second) } : { ticks }),
        });
      }
      if (/^(?:get|set|clear).*DynamicPropert/.test(method ?? "")) {
        const key = literal(first);
        add("state", typeof key === "string" ? key : compact(first) ?? method, node,
          { method, receiver, resolved: typeof key === "string" });
      }
      if (method === "registerCustomDimension") {
        const id = literal(first);
        add("dimension", id ?? compact(first) ?? method, node, { resolved: typeof id === "string" });
      }
      if (method === "playSound" && typeof literal(first) === "string") {
        add("sound", literal(first), node);
      }
      if (method === "spawnParticle" && typeof literal(first) === "string") {
        add("particle", literal(first), node);
      }
      if (method === "spawnEntity" && typeof literal(first) === "string") {
        add("entity", literal(first), node);
      }
      if (["place", "load"].includes(method) && /structureManager$/.test(text(target.expression) ?? "")) {
        const id = literal(first);
        if (typeof id === "string") add("structure", id, node, { method });
      }
      if (method === "runCommand" || method === "runCommandAsync") {
        // Recognize literal IDs in command strings and templates with a dynamic target.
        const command = text(first) ?? "";
        if (command.startsWith('"') || command.startsWith("'") || command.startsWith("`")) {
          const fog = command.match(/^.[/]?fog\s+(?:\$\{[^}]+\}|\S+)\s+push\s+([\w.-]+:[\w./-]+)/);
          const sound = command.match(/^.[/]?playsound\s+([\w.:-]+)(?=\s|["'`])/);
          const structure = command.match(/^.[/]?structure\s+(?:load|place)\s+([\w.-]+:[\w./-]+)/);
          if (fog) add("fog", fog[1], node);
          if (sound) add("sound", sound[1], node);
          if (structure) add("structure", structure[1], node, { method: "runCommand" });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  for (const diagnostic of source.parseDiagnostics) {
    errors.push({ file, line: line(diagnostic.start), message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") });
  }
  collect(source);
  visit(source);
}

console.log(JSON.stringify({
  files: scriptFiles.length, rows, errors, modules: [...modules].sort(), textures: [...textures].sort(),
  identifiers: [...identifiers].sort(),
  scriptPaths: scriptFiles.map(relative), dependencies, references,
}));
