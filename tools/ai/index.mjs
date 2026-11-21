// Parse pack scripts without importing or executing them.
import { readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const [root, pack] = process.argv.slice(2);
const scripts = path.join(pack, "scripts");
const rows = [];
const errors = [];
const modules = new Set();
const textures = new Set();

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
  const file = path.relative(root, filename).split(path.sep).join("/");
  const source = program.getSourceFile(filename);
  const line = (position) => source.getLineAndCharacterOfPosition(position).line + 1;
  const text = (node) => node?.getText(source);
  const compact = (node) => text(node)?.replace(/\s+/g, " ").slice(0, 100);
  const imports = new Map();

  function collect(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      if (name.startsWith("@minecraft/")) modules.add(name);
      if (name === "@minecraft/server" && node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)) {
        for (const entry of node.importClause.namedBindings.elements) {
          imports.set(entry.name.text, entry.propertyName?.text ?? entry.name.text);
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
    if (ts.isStringLiteralLike(node) && node.text.startsWith("textures/")) textures.add(node.text);
    if ((ts.isPropertyAssignment(node) && ["fog", "fogId"].includes(node.name.text)) ||
        (ts.isVariableDeclaration(node) && /(?:^|_)FOG_ID$/.test(node.name.text ?? ""))) {
      const id = literal(node.initializer);
      if (typeof id === "string" && /^[\w.-]+:[\w./-]+$/.test(id)) add("fog", id, node);
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ||
        ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) && node.name) {
      add("symbol", compact(node.name), node, { type: ts.SyntaxKind[node.kind], end: line(node.end) });
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
      if (method === "runCommand" || method === "runCommandAsync") {
        // Recognize literal IDs in command strings and templates with a dynamic target.
        const command = text(first) ?? "";
        if (command.startsWith('"') || command.startsWith("'") || command.startsWith("`")) {
          const fog = command.match(/^.[/]?fog\s+(?:\$\{[^}]+\}|\S+)\s+push\s+([\w.-]+:[\w./-]+)/);
          const sound = command.match(/^.[/]?playsound\s+([\w.:-]+)(?=\s|["'`])/);
          if (fog) add("fog", fog[1], node);
          if (sound) add("sound", sound[1], node);
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

console.log(JSON.stringify({ files: scriptFiles.length, rows, errors, modules: [...modules].sort(), textures: [...textures].sort() }));
