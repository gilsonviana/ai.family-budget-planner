import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  process.stderr.write("Usage: pnpm release:version <semver>\n");
  process.exit(2);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const directory of ["apps/cli", "apps/mcp"]) {
  const path = join(root, directory, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.version = version;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
let previousTag = "";
try {
  previousTag = execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
} catch {
  // The first release includes all commits.
}
const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
const changes =
  execFileSync("git", ["log", "--pretty=format:- %s", range], {
    cwd: root,
    encoding: "utf8",
  }).trim() || "- No user-facing changes recorded.";
const date = new Date().toISOString().slice(0, 10);
const path = join(root, "CHANGELOG.md");
const changelog = readFileSync(path, "utf8");
const marker = "\n## ";
const insertion = `\n## ${version} - ${date}\n\n${changes}\n`;
const at = changelog.indexOf(marker);
writeFileSync(
  path,
  at < 0
    ? `${changelog.trimEnd()}${insertion}`
    : `${changelog.slice(0, at)}${insertion}${changelog.slice(at)}`,
);
process.stdout.write(
  `Set CLI and MCP versions to ${version} and generated its changelog entry.\n`,
);
