# Security

## Supply chain / dependency resolution

- Every internal package is `"private": true` — none can be published to a
  public registry by accident (`pnpm publish` refuses private packages).
- Every internal cross-package dependency uses the `workspace:*` protocol
  (verified: no `@controldeck/*` dependency in any `package.json` uses a
  plain semver range). `workspace:*` resolves exclusively against this
  monorepo's local packages and fails the install rather than falling
  through to the public npm registry if a matching local package isn't
  found — so a typosquat or dependency-confusion package published under
  the `@controldeck` npm scope cannot be silently substituted for an
  internal package during install.
- `pnpm-workspace.yaml` scopes workspace resolution to `apps/*` and
  `packages/*` only.
- The package manager is pinned exactly (`packageManager: "pnpm@10.34.5"`
  in the root `package.json`) and `pnpm-lock.yaml` is committed, so CI and
  local installs resolve the identical dependency graph.
- **The `@controldeck` npm scope has not been published to or reserved.**
  This project makes no claim on that namespace beyond this repository;
  no placeholder package has been (or should be) published to reserve it.
- `pnpm audit --prod` and a zero-dependency secret scan
  (`scripts/secret-scan.mjs`, `pnpm secret-scan`) both run as part of the
  standard verification pass (see `README.md` → Testing) and are clean as
  of the current `HEAD`.

## Reporting

This is a Week-4 learning-sprint submission, not a maintained public
package with a formal disclosure process. Open an issue on the repository
for anything found.
