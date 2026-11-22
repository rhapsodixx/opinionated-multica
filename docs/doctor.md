# Potato doctor

Use doctor before installation, after bundle preparation and before assigning a task.
It inspects prerequisites and configuration. It does not prove that a product change passes its tests.

From a checkout:

```sh
node bin/potato.mjs doctor
node bin/potato.mjs doctor --bundle ./bundles/worker-01 --repo ../ronda
node bin/potato.mjs doctor --bundle ./bundles/worker-01 --repo ../ronda --json
```

The same arguments work with the package's `potato` executable.
The package is not yet published to npm; do not invoke an unrelated public package named `potato`.

Inside a coding container, use repository-only scope. This preserves the no-Docker-socket boundary:

```sh
potato doctor --repo /home/runner/workspaces/ronda --repo-only
potato doctor --repo /home/runner/workspaces/ronda --repo-only --probe --json
```

`--repo-only` requires `--repo` and cannot combine with `--bundle`.
It checks the current runtime's Node/platform/workspace and repository, without contacting Docker.
The image build now includes this CLI; real image certification remains a separate acceptance step.

## Checks

| Area | Inspection |
| --- | --- |
| Machine | Node version, supported OS/architecture, writable current directory, disk availability, host memory, Docker/Compose and native engine architecture |
| Capacity | Requested CPU/memory against Docker VM capacity; optional operator-supplied minimum free disk |
| Bundle | Expected file inventory, content hashes, policy assets against this CLI release, pinned tool catalog, immutable image, resource limits and isolated mounts |
| Repository | Git metadata, guidance files, project manifests/lockfiles, declared check commands, coverage paths and UI applicability |
| Browser | Declared Node/Python Playwright configuration; optional installed-version and synthetic browser assertion probe |

On macOS, Docker VM memory differs from physical RAM. Doctor measures both and checks limits against the VM.
Host free memory is advisory; it does not measure all reclaimable memory or certify safe concurrency.
Disk output describes the current workspace filesystem, not Docker VM storage or a complete image/cache budget.
Measure image and job peaks before setting a disk threshold:

```sh
node bin/potato.mjs doctor --cpus 2 --memory 4g --min-free-disk 20g
```

Those values illustrate an operator-selected budget. They are not platform-wide requirements.
Doctor does not start Colima or change its configuration. A stopped engine or broken Compose plugin fails the check.
Remote or emulated Docker environments require separate certification; matching architecture alone does not prove local execution.

## Results and exit status

Doctor prints `PASS`, `WARN`, `FAIL`, `NOT CHECKED` or `N/A` for each check.
JSON output contains `schema`, `scope`, `ready`, `configurationReady`, `checks` and `limits`.
Each check includes its ID, status, whether it is required, whether it concerns live operation, detail and a remedy.

- Exit `0`: all required checks in the selected preflight scope passed.
- Exit `1`: a required check failed or remains unchecked, or command arguments are invalid.
- `configurationReady: true`: required configuration checks passed; required live probes may still remain unchecked.
- `ready: true`: all required checks listed in this report passed. This is preflight readiness, not approval to merge or deploy.

Warnings do not block a report. Required unchecked results do.
Repository commands and coverage outputs are declarations until the approved local test gate executes them.
Doctor does not read arbitrary report files and convert their claims into a pass.

Bundle inspection always reports native extension, authentication and connectivity acceptance as `NOT CHECKED`.
The current tool cannot certify actual skill/plugin/hook/MCP behavior or the logged-in Claude/Multica identity.
Therefore a bundle report can have `configurationReady: true` and still exit `1` with `ready: false`.
Keep this gap visible until real runtime acceptance supplies those checks; do not waive it by editing JSON or treating discovery as execution.

## Repository profile

Create and review `.potato/repository.json` in each product repository.
Start from [the example](../config/repository.example.json). Replace every example command and output path with the repository's approved values.
The example is not a working test configuration and does not install `pre-commit` or any other dependency.

The schema version is `1`:

- `projects`: one or more project entries, supporting `typescript`, `javascript`, `python` and `go`.
- Each project declares a repository-relative `path`, nonempty `manifests`, and `lockfiles` relative to that project.
- Go may declare no lockfile when it has no external dependencies. Other languages require a lockfile.
- `checks`: nonempty argument arrays for `full`, `fast`, `lint`, `types`, `unit`, `integration`, `security` and `hooks`.
- `coverage`: nonempty output-path arrays for `unit` and `integration`; also `ui` when UI tests apply.
- `ui.required`: a boolean. If false, provide a nonempty `ui.reason`.

Paths cannot escape the repository or project directory. Existing symlinks cannot bypass this boundary.
An approved profile declares commands; doctor does not run them, parse every package manager's lock semantics or install dependencies.
Version 1 requires the named check categories. A repository missing a required category remains a readiness gap rather than receiving a fabricated pass.
Human review must confirm that the full command includes the declared checks and produces real line/branch and scenario coverage.
Instruction-file presence does not prove that guidance is correct or engine-agnostic.
Command declarations do not prove that hooks are installed, chained or effective.

For Node Playwright:

```json
{
  "required": true,
  "binding": "node",
  "path": "web",
  "package": "@playwright/test",
  "browser": "chromium",
  "command": ["npm", "run", "test:e2e"]
}
```

Declare an exact Playwright version in that project's package manifest and commit its corresponding lockfile.
The package can be `@playwright/test` or `playwright`.

For Ronda's existing Python harness, use the installed version approved by its lockfile:

```json
{
  "required": true,
  "binding": "python",
  "path": ".",
  "python": ".venv/bin/python",
  "version": "1.58.2",
  "browser": "chromium",
  "command": ["uv", "run", "pytest", "tests/browser"]
}
```

The version and command above are examples, not a freshly verified Ronda configuration.
A venv executable may be a symlink to its installed interpreter; its parent directory must remain inside the project.
For both bindings, declare `chromium`, `firefox` or `webkit` as the probe browser.
The product test command still owns the full browser/viewport/role/state matrix.

## Explicit probes

```sh
node bin/potato.mjs doctor --bundle ./bundles/worker-01 --repo ../ronda --probe
```

`--probe` permits two additional operations:

1. Run the existing Python version doctor in a disposable container from the already-present approved image.
2. Execute the repository's installed Playwright binding, compare its installed version, launch the selected browser and assert synthetic page content.

The image probe never pulls an image. It uses no network, a read-only root filesystem, bounded temporary storage and dropped capabilities.
It does not mount the runner's identity volume or read its token path.
Native extension and authentication acceptance still remain unchecked.

The browser probe uses an empty local page. It does not start an app server, request the product URL or execute the declared test command.
It does execute installed repository packages. Use `--probe` only for an approved checkout in the intended runner environment.
It does not independently prove Python lock resolution, all browser revisions or the complete product matrix.
Missing packages, browser libraries, executable paths, version drift, launch errors and assertion failures block the browser check.

Normal diagnostic commands have 15-second limits; the image probe has four minutes and the browser probe has 30 seconds.
Bounded local probes terminate their process group on timeout on supported POSIX hosts.
The image itself is resource-limited; stopping a Docker client does not guarantee the daemon immediately removes its container.
Inspect and remove only a leftover task-owned probe container if an interrupted daemon operation leaves one.
Doctor hides raw subprocess errors to avoid leaking credentials or browser state. It provides a named check and remedy instead.

## Installer integration

Setup always checks Docker/Compose and whether requested runner limits fit the engine before building.
It continues to run the image's version doctor after the build and validate Compose after preparation.
To inspect an approved repository profile before building:

```sh
bash setup.sh --repo ../ronda
```

Missing or failed required configuration checks block setup. Pending live probes do not prevent bundle preparation.
Setup does not run browser probes, repository tests, login or daemon startup.
Run doctor again after preparation, then complete real runtime acceptance and the approved product test gate.
