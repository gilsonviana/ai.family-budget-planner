# Releasing

The CLI and MCP server use one version and are published together. Releases are
immutable Git tags; only the tag-triggered GitHub workflow may publish.

1. Start from a clean `main` branch after verification succeeds.
2. Run `pnpm release:version 0.2.0`. This updates both package manifests and
   generates a changelog entry from commits since the latest tag.
3. Edit the generated changelog bullets for clarity, then run `pnpm install` to
   refresh the lockfile.
4. Run `pnpm release:check` and both package smoke tests.
5. Commit the version, changelog, and lockfile; open and merge a pull request.
6. From the verified merge commit, create and push the matching tag, such as
   `v0.2.0`.

The release workflow installs with the frozen lockfile, reruns formatting,
architecture/lint, typecheck, tests, build, and clean-install smoke tests. It
then rejects mismatched tags/package versions, absent changelog entries,
workspace production dependencies, and development files in npm dry runs.

Publication uses npm trusted publishing through the protected `npm` GitHub
environment and requests npm provenance attestations. Configure the npm package
trusted publisher for this repository and workflow; do not add a long-lived npm
token. Environment protection can require a human reviewer before the two
publish commands execute.

If either publication fails, do not move or reuse the tag. Determine whether one
package reached npm. Correct the problem in a new commit and publish a new patch
version so package and source provenance remain unambiguous.
