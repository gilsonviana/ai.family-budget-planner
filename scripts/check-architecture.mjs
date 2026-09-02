import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import ts from "typescript";

import {
  validateDependency,
  workspacePackages,
} from "./architecture-policy.mjs";

const dependencyFields = ["dependencies", "optionalDependencies"];

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath);
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.includes(".test.")
      ) {
        return [entryPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function collectModuleSpecifiers(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

const violations = [];

for (const [packageName, policy] of Object.entries(workspacePackages)) {
  const manifestPath = path.join(policy.directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const field of dependencyFields) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      const violation = validateDependency(packageName, dependency);
      if (violation) {
        violations.push(`${manifestPath} (${field}): ${violation}`);
      }
    }
  }

  const sourceDirectory = path.join(policy.directory, "src");
  for (const filePath of await collectTypeScriptFiles(sourceDirectory)) {
    const sourceText = await readFile(filePath, "utf8");
    for (const specifier of collectModuleSpecifiers(sourceText, filePath)) {
      const violation = validateDependency(packageName, specifier);
      if (violation) {
        violations.push(`${filePath}: ${violation}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("Architecture dependency boundaries are valid.");
}
