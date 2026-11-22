# Potato setup design

The owner approved this design on 22 November 2026: build the image and prepare the runner bundle; login and startup stay explicit.
The framework is Potato. Multica remains its coordinator. The existing repository URL stays unchanged.

## Approach

Use one dependency-free Node CLI, exposed as `potato` through an npm package and a shell wrapper.
The CLI checks an existing Docker engine and either Compose command form, builds the pinned shared-tool image,
checks its tool versions, and invokes the existing Python bundle helper inside that image.
This avoids installing language runtimes into the worker host. Node 22.8+ and Docker/Compose are host prerequisites.
The shell wrapper reports a missing Node installation; it does not silently install host packages or start Colima.

A host-wide tool installer would create drift and conflict with the selected container model.
A bundle-only wrapper would leave the tools uninstalled. The selected image-build approach owns both tools and runner assets.

## Behavior

- Interactive setup asks for server, workspace, output and token-file path, then confirms the build.
- `--yes` supports automation; `--plan` prints the plan without running Docker or writing a bundle.
- The ASCII mascot and spinner animate only in an interactive terminal. `--no-animation`, `NO_COLOR` and redirected output stay readable.
- Validate arguments before any mutation. Never read a token or put its contents into command arguments or output.
- Stage temporary files beside the destination, inside the same Docker-shared host path. Publish a validated bundle only after every step passes.
- Support rootful and rootless Docker UID mappings for the one-off preparer.
- Refuse nonempty output directories and symlinks. Stop on missing prerequisites, build failures or a failed version doctor.
- Use the build's immutable image ID for local setup. Fleet rollout requires one certified published image digest and private extension release.
- Never log in, start the daemon, publish images/packages, enable hosted CI or change repository protection.
- Private skills/plugins/MCP credentials remain operator-supplied. Building the public image does not certify those extensions.

The setup works on Linux and macOS Docker hosts; Windows users use WSL. Real image build and native runtime acceptance are separate from mocked CLI tests.

## Verification

Use Node's built-in test runner and coverage for installer logic, with fake Docker commands for failure paths and command ordering.
Keep Python helper tests. Exercise the shell wrapper, package contents, plan mode, animation fallback and secret-safe arguments.
Inspect the square manga logo and README references. Review the whole change before pushing.
