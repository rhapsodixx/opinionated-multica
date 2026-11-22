# Potato setup validation

Validated locally on 23 November 2026. These checks cover setup and doctor tooling, not a deployed Multica installation.

| Mode | Python unit | Python CLI integration | Node unit | Node CLI integration |
| --- | --- | --- | --- | --- |
| Full | 33 passed | 4 passed | 30 passed | 8 passed |
| Fast | Not run separately | Not run | Not run separately | Not run |

No selected tests failed, skipped, remained TODO or were cancelled. Bash syntax checks passed.

| Measured source | Line coverage | Branch coverage |
| --- | --- | --- |
| Python setup/image helpers and Node-result parser | 99.47% | 98.57% |
| Node installer, system, doctor and terminal helpers (`lib/*.mjs`) | 100% | 87.95% |

CLI entry points have separate behavior tests. Coverage does not establish that a real image or product test passed.
Functional product UI coverage is N/A because this repository contains setup helpers, not a product UI.

The full command runs both language unit and integration suites. Fast mode explicitly omits both integration suites:

```bash
uv sync --locked
uv run --locked python scripts/check.py full
uv run --locked python scripts/check.py fast
```

The npm tarball contains the Docker build inputs and excludes local bytecode/private fixtures.
The new doctor integration suite packs and extracts the actual npm artifact, runs it from an empty directory,
parses its JSON with Docker unavailable, and verifies that the directory stays empty.
A local `npm exec --offline --package=<tarball> -- potato --plan` smoke passed without Docker calls or bundle writes.
The pinned GitHub archive npx entry point also passed plan-mode smoke at commit `05e2c89add4a2946a5eb4bca970bd1c438a54128`.

The image catalog's 21 downloaded official artifacts matched their pinned SHA-256 hashes for amd64/arm64.
The official base manifest and signed Debian snapshot metadata were checked. This verifies sources, not executable compatibility.

Independent review found path interpolation/quoting, Colima mount placement, legacy architecture detection,
rootless UID mapping, partial-output retry, package inclusion, host-runtime and incomplete-test-result gaps.
Regression tests and fixes cover the important findings. Output paths with literal shell syntax remain literal.

Earlier validation confirmed Docker Compose 5.8.0 accepts the prepared configuration.
The new read-only machine doctor passed its required checks on the Mac; memory headroom and an unspecified disk budget remain warnings.
Tests cover configuration drift, rehashed unsafe bundles, path escapes, missing profiles, absent Docker, timeouts,
Playwright package-version drift and repository-only inspection without a Docker socket.
Image/browser execution boundaries use controlled test doubles; no real image or product browser certification is claimed.
A real Docker image build, nonroot image doctor, daemon startup and private skill/plugin/MCP acceptance remain unverified.
No VM, runner service or production application was started or changed. No npm or image publication occurred.
