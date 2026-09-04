import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = ["apps/cli", "apps/mcp"];
const manifests = packages.map((directory) => ({
  directory,
  value: JSON.parse(
    readFileSync(join(root, directory, "package.json"), "utf8"),
  ),
}));
const versions = new Set(manifests.map(({ value }) => value.version));
if (versions.size !== 1)
  throw new Error("CLI and MCP package versions must match");
const [version] = versions;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
  throw new Error(`Invalid release version: ${version}`);
for (const { directory, value } of manifests) {
  if (value.private !== false)
    throw new Error(`${directory} must be publishable`);
  if (value.engines?.node !== ">=22")
    throw new Error(`${directory} must require Node >=22`);
  if (
    value.repository?.url !==
    "git+https://github.com/gilsonviana/ai.family-budget-planner.git"
  )
    throw new Error(
      `${directory} must declare the provenance source repository`,
    );
  for (const dependency of Object.values(value.dependencies ?? {}))
    if (String(dependency).startsWith("workspace:"))
      throw new Error(
        `${directory} has a non-publishable workspace dependency`,
      );
  const dryRun = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: join(root, directory),
      encoding: "utf8",
    }),
  );
  const files = dryRun[0]?.files?.map((file) => file.path) ?? [];
  if (
    !files.includes("package.json") ||
    files.some((file) => /(^|\/)(src|scripts|.*\.test\.)/.test(file))
  )
    throw new Error(
      `${directory} dry run contains invalid publication files: ${files.join(", ")}`,
    );
}
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## ${version} -`))
  throw new Error(`CHANGELOG.md has no entry for ${version}`);
const tag =
  process.env.GITHUB_REF_TYPE === "tag"
    ? process.env.GITHUB_REF_NAME
    : undefined;
if (tag && tag !== `v${version}`)
  throw new Error(`Tag ${tag} does not match package version v${version}`);
process.stdout.write(`Release check passed for v${version}\n`);
