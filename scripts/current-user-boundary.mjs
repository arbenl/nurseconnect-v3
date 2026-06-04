#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceFile = /^(?:apps\/web\/src|packages|scripts)\/.+\.(?:ts|tsx|js|mjs)$/;
const testFile = /(?:^|\/)(?:__tests__\/.+|.+\.(?:test|spec)\.(?:ts|tsx|js|mjs))$/;
const approvedFiles = new Set([
  "packages/domain-identity/src/domain-user.ts",
  "scripts/current-user-boundary.mjs",
]);
const approvedPrefixes = [
  "packages/database/src/schema/",
];

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function trackedSourceFiles() {
  return git(["ls-files"])
    .split("\n")
    .filter(Boolean)
    .filter((file) => sourceFile.test(file))
    .filter((file) => existsSync(path.join(repoRoot, file)));
}

function isApprovedFile(file) {
  return testFile.test(file) || approvedFiles.has(file) || approvedPrefixes.some((prefix) => file.startsWith(prefix));
}

export function findCurrentUserBoundaryViolations(file, text) {
  if (isApprovedFile(file)) return [];

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const userAliases = new Set();
  const violations = [];

  function line(node) {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  }

  function textOfName(name) {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return "";
  }

  function expressionIsSchemaUsers(expression) {
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "users" &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "schema"
    );
  }

  function record(node, label) {
    violations.push({ file, line: line(node), label });
  }

  function collectAliases(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (moduleName === "@nurseconnect/database/schema" || moduleName === "@nurseconnect/database") {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const specifier of bindings.elements) {
            if ((specifier.propertyName?.text ?? specifier.name.text) === "users") {
              userAliases.add(specifier.name.text);
            }
          }
        }
      }
    }

    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      if (
        expressionIsSchemaUsers(node.initializer) ||
        (ts.isIdentifier(node.initializer) && userAliases.has(node.initializer.text))
      ) {
        userAliases.add(node.name.text);
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === "schema" &&
      ts.isObjectBindingPattern(node.name)
    ) {
      for (const element of node.name.elements) {
        if (textOfName(element.propertyName ?? element.name) === "users" && ts.isIdentifier(element.name)) {
          userAliases.add(element.name.text);
        }
      }
    }

    ts.forEachChild(node, collectAliases);
  }

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "authId") {
      if (ts.isIdentifier(node.expression) && userAliases.has(node.expression.text)) {
        record(node, `direct ${node.expression.text}.authId lookup outside identity projection`);
      } else if (expressionIsSchemaUsers(node.expression)) {
        record(node, "direct schema.users.authId lookup outside identity projection");
      }
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "authId" &&
      ts.isIdentifier(node.expression) &&
      userAliases.has(node.expression.text)
    ) {
      record(node, `direct ${node.expression.text}["authId"] lookup outside identity projection`);
    }

    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "authId" &&
      expressionIsSchemaUsers(node.expression)
    ) {
      record(node, 'direct schema.users["authId"] lookup outside identity projection');
    }

    ts.forEachChild(node, visit);
  }

  collectAliases(source);
  visit(source);

  return violations;
}

export function checkCurrentUserBoundary(files, readText) {
  return files.flatMap((file) => findCurrentUserBoundaryViolations(file, readText(file)));
}

function main() {
  const violations = checkCurrentUserBoundary(trackedSourceFiles(), (file) =>
    readFileSync(path.join(repoRoot, file), "utf8")
  );

  if (violations.length > 0) {
    process.stderr.write(
      `[current-user-boundary] FAIL (${violations.length})\n${violations
        .map((violation) => `- ${violation.file}:${violation.line} ${violation.label}`)
        .join("\n")}\n`,
    );
    process.exit(1);
  }

  process.stdout.write("[current-user-boundary] PASS\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
