export const workspacePackages = {
  "@family-finance/application": {
    directory: "packages/application",
    allowedWorkspaceDependencies: [
      "@family-finance/domain",
      "@family-finance/shared",
    ],
    allowedExternalDependencies: [],
  },
  "@family-finance/cli": {
    directory: "apps/cli",
    allowedWorkspaceDependencies: [
      "@family-finance/application",
      "@family-finance/config",
      "@family-finance/infrastructure",
      "@family-finance/shared",
    ],
    allowedExternalDependencies: "*",
  },
  "@family-finance/config": {
    directory: "packages/config",
    allowedWorkspaceDependencies: ["@family-finance/shared"],
    allowedExternalDependencies: ["zod"],
  },
  "@family-finance/domain": {
    directory: "packages/domain",
    allowedWorkspaceDependencies: ["@family-finance/shared"],
    allowedExternalDependencies: [],
  },
  "@family-finance/infrastructure": {
    directory: "packages/infrastructure",
    allowedWorkspaceDependencies: [
      "@family-finance/application",
      "@family-finance/config",
      "@family-finance/domain",
      "@family-finance/shared",
    ],
    allowedExternalDependencies: "*",
  },
  "@family-finance/mcp": {
    directory: "apps/mcp",
    allowedWorkspaceDependencies: [
      "@family-finance/application",
      "@family-finance/config",
      "@family-finance/infrastructure",
      "@family-finance/shared",
    ],
    allowedExternalDependencies: "*",
  },
  "@family-finance/shared": {
    directory: "packages/shared",
    allowedWorkspaceDependencies: [],
    allowedExternalDependencies: [],
  },
};

const workspacePackageNames = new Set(Object.keys(workspacePackages));

export function dependencyPackageName(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }

  return specifier.split("/")[0];
}

export function validateDependency(sourcePackage, specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return null;
  }

  const policy = workspacePackages[sourcePackage];
  if (!policy) {
    return `Unknown workspace package: ${sourcePackage}`;
  }

  const dependency = dependencyPackageName(specifier);
  if (workspacePackageNames.has(dependency)) {
    if (!policy.allowedWorkspaceDependencies.includes(dependency)) {
      return `${sourcePackage} cannot depend on ${dependency}`;
    }

    return null;
  }

  if (
    policy.allowedExternalDependencies !== "*" &&
    !policy.allowedExternalDependencies.includes(dependency)
  ) {
    return `${sourcePackage} cannot depend on external package ${dependency}`;
  }

  return null;
}
