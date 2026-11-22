# Runner image toolchain

The installer builds `potato-runner:0.1.0` from this repository. It does not log in,
start the daemon, start Docker/Colima, install private extensions, or deploy a
runner. The image has no credentials or personal settings. Its default command
is a shell; the prepared Compose bundle supplies the runner entrypoint later.

`config/toolchain.json` records exact versions, the immutable multi-platform
Python/Debian base image, official download URLs and SHA-256 hashes for Linux
amd64 and arm64. Other image architectures fail explicitly. Legacy Docker builders may leave TARGETARCH empty;
the installer then detects amd64/arm64 from the image's native platform. The amd64 Bun build
uses the baseline CPU target. Claude Code uses the official native executable at
`/usr/local/bin/claude`; the deprecated npm package is not installed.

Python 3.12 is the common Python baseline, matching the selected pilot
repository. The common tools are Claude Code, Multica CLI, Python, Node (including npm/npx),
Bun/Bunx, Go, uv/uvx, Git, gopls, Gitleaks, golangci-lint, govulncheck, GitHub CLI
and jq. Go tools that are built from source use exact module versions, the public
Go proxy and its checksum database. `GOTOOLCHAIN=local` prevents an implicit Go
upgrade. Claude auto-updates and uv's implicit Python downloads are disabled.

Debian dependencies resolve against the fixed snapshot in the catalog. Debian
repository signatures remain required; the historical snapshot's expiry check
is disabled. The image includes C/C++ build tools, SSH, ripgrep, Xvfb, fonts and
Linux browser shared libraries. Browser binaries, Playwright versions, test
runners, language dependencies and lockfiles belong to each repository. Install
the browser revision required by that repository's pinned test package. There is
no global mutable ESLint, Jest, pytest or Playwright environment.

The final image runs as UID/GID `10001:10001` and owns `/home/runner`. A prepared
bundle mounts a persistent volume there. Approved credentials and extensions
must be provisioned separately. `.dockerignore` sends only the public image
build files and required runtime helpers to Docker, even when the checkout also
contains private local state.

## Build and inspect

From the repository root, with Docker already running:

```sh
docker build -f runner/Dockerfile -t potato-runner:0.1.0 .
docker image inspect potato-runner:0.1.0
```

The build downloads fixed artifacts, checks their SHA-256 values before
installation and verifies Claude's official manifest and Multica's published
checksum list. It then runs every configured version command as the nonroot
runner user. A missing tool, failed command or unexpected version fails the
build. No tool installation occurs on container startup.

The image contains `/opt/potato/runner_setup.py`, the runner assets,
`/opt/potato/config/toolchain.json`, and the prepare/doctor scripts. After the
installer creates a release document for the built image, its independent doctor
can be repeated with that document mounted read-only:

```sh
docker run --rm --entrypoint python3 \
  --mount type=bind,source="$PWD/runner-bundle/release.json",target=/tmp/release.json,readonly \
  potato-runner:0.1.0 /opt/potato/scripts/doctor-runner.py --release /tmp/release.json
```

A registry deployment must publish the reviewed image and use its immutable
registry digest. Local installation may use the immutable local image identifier
recorded by the installer. A successful version check establishes installed tool
versions; it does not certify private skill/plugin/MCP delivery or product
behavior. Native extension execution, real feature and bug workflows, browser
scenarios and synthetic alert replay remain acceptance work.

## Updating pins

Change the catalog and Dockerfile base reference together. Resolve the new base
tag to its multi-platform registry digest; confirm both target architectures.
Read the official versioned release metadata, replace artifact hashes and the
pinned Claude/Multica manifests, and update the Debian snapshot deliberately.
Build and run the doctor on each architecture before promoting the image. Retain
the prior image digest for rollback. A fixed snapshot preserves reviewed OS
packages; security updates require a new image release.

Sources used for the initial catalog:

- [Python official image sources](https://github.com/docker-library/python) and
  [Docker Registry HTTP API](https://distribution.github.io/distribution/spec/api/).
- [Node release downloads](https://nodejs.org/dist/v24.22.3/SHASUMS256.txt) and
  [Go downloads](https://go.dev/dl/?mode=json).
- [Claude native setup](https://code.claude.com/docs/en/setup) and the
  [versioned official native manifest](https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases/2.1.330/manifest.json).
- [Multica 0.11.1 release](https://github.com/multica-ai/multica/releases/tag/v0.11.1)
  and its [checksum list](https://github.com/multica-ai/multica/releases/download/v0.11.1/checksums.txt).
- Official releases for [Bun](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.5),
  [uv](https://github.com/astral-sh/uv/releases/tag/0.13.9),
  [Gitleaks](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1),
  [golangci-lint](https://github.com/golangci/golangci-lint/releases/tag/v2.15.0),
  [GitHub CLI](https://github.com/cli/cli/releases/tag/v2.105.0),
  [jq](https://github.com/jqlang/jq/releases/tag/jq-1.8.2) and
  [Git](https://www.kernel.org/pub/software/scm/git/sha256sums.asc).
- [Go module authentication](https://go.dev/ref/mod#authenticating),
  [gopls source](https://go.googlesource.com/tools/+/refs/tags/gopls/v0.24.0/gopls/),
  [govulncheck source](https://go.googlesource.com/vuln/+/refs/tags/v1.10.0/) and
  [Debian snapshots](https://snapshot.debian.org/).
